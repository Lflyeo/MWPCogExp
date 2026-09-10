"""分层动态覆盖抽样：unused-first / deal。"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Optional

from .constants import LEVEL5_ORDER, VALID_MODES


@dataclass
class SampledItem:
    mwp_id: int
    level5: str
    raw_text: str
    composite_score: Optional[float]
    rank: Optional[int] = None
    answer_quality: Optional[str] = None
    trial_index: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "trial_index": self.trial_index,
            "mwp_id": self.mwp_id,
            "level5": self.level5,
            "raw_text": self.raw_text,
            "composite_score": self.composite_score,
            "rank": self.rank,
            "answer_quality": self.answer_quality,
        }


@dataclass
class ParticipantAssignment:
    participant_id: str
    items: list[SampledItem] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "participant_id": self.participant_id,
            "items": [it.to_dict() for it in self.items],
        }


@dataclass
class SamplingResult:
    seed: int
    mode: str
    n_participants: int
    per_level: int
    participants: list[ParticipantAssignment]
    usage_counts: dict[int, int]  # mwp_id -> count across all participants
    eligible_sizes: dict[str, int]
    run_id: Optional[str] = None

    def to_assignments_dict(self) -> dict[str, Any]:
        meta: dict[str, Any] = {
            "seed": self.seed,
            "n_participants": self.n_participants,
            "per_level": self.per_level,
            "mode": self.mode,
            "levels": list(LEVEL5_ORDER),
            "eligible_sizes": self.eligible_sizes,
        }
        if self.run_id:
            meta["run_id"] = self.run_id
        return {
            "meta": meta,
            "participants": [p.to_dict() for p in self.participants],
        }


def _item_to_sampled(item: dict[str, Any], trial_index: int = 0) -> SampledItem:
    return SampledItem(
        mwp_id=int(item["id"]),
        level5=str(item["level5"]),
        raw_text=str(item["raw_text"]),
        composite_score=item.get("composite_score"),
        rank=item.get("rank"),
        answer_quality=item.get("answer_quality"),
        trial_index=trial_index,
    )


def _weighted_choice(
    rng: random.Random,
    candidates: list[dict[str, Any]],
    usage: Counter,
) -> dict[str, Any]:
    weights = [1.0 / (1.0 + usage[int(c["id"])]) for c in candidates]
    total = sum(weights)
    if total <= 0:
        raise RuntimeError("加权抽样权重和为 0")
    r = rng.random() * total
    acc = 0.0
    for cand, w in zip(candidates, weights):
        acc += w
        if r <= acc:
            return cand
    return candidates[-1]


def _pick_unused_first(
    rng: random.Random,
    pool: list[dict[str, Any]],
    usage: Counter,
    exclude_ids: set[int],
) -> dict[str, Any]:
    available = [c for c in pool if int(c["id"]) not in exclude_ids]
    if not available:
        raise RuntimeError("当前复杂度层在排除本被试已选题后无可抽题目")

    unused = [c for c in available if usage[int(c["id"])] == 0]
    if unused:
        return rng.choice(unused)
    return _weighted_choice(rng, available, usage)


def _levels_non_adjacent(items: list[SampledItem]) -> bool:
    for a, b in zip(items, items[1:]):
        if a.level5 == b.level5:
            return False
    return True


def _shuffle_presentation(
    rng: random.Random,
    items: list[SampledItem],
    *,
    avoid_adjacent_same_level: bool = False,
    max_attempts: int = 50,
) -> list[SampledItem]:
    order = list(items)
    if not avoid_adjacent_same_level:
        rng.shuffle(order)
        return order

    for _ in range(max_attempts):
        rng.shuffle(order)
        if _levels_non_adjacent(order):
            return order
    # 失败则接受最后一次乱序
    return order


def sample_assignments(
    eligible_by_level: dict[str, list[dict[str, Any]]],
    *,
    seed: int,
    n_participants: int = 50,
    per_level: int = 3,
    mode: str = "unused_first",
    avoid_adjacent_same_level: bool = False,
) -> SamplingResult:
    """
    一次性生成全部被试题单。

    mode:
      - unused_first: 优先均匀抽未用题，不足再按 1/(1+c) 加权
      - deal: 每层洗牌后按被试顺序发牌（覆盖度确定性最优）
    """
    if mode not in VALID_MODES:
        raise ValueError(f"未知 mode={mode!r}，可选 {VALID_MODES}")

    for lv in LEVEL5_ORDER:
        if lv not in eligible_by_level:
            raise ValueError(f"缺少复杂度层: {lv}")
        if len(eligible_by_level[lv]) < per_level:
            raise RuntimeError(
                f"复杂度层「{lv}」合格题量不足：{len(eligible_by_level[lv])} < {per_level}"
            )

    rng = random.Random(seed)
    usage: Counter = Counter()
    eligible_sizes = {lv: len(eligible_by_level[lv]) for lv in LEVEL5_ORDER}

    if mode == "deal":
        return _sample_deal(
            eligible_by_level,
            rng=rng,
            seed=seed,
            n_participants=n_participants,
            per_level=per_level,
            usage=usage,
            eligible_sizes=eligible_sizes,
            avoid_adjacent_same_level=avoid_adjacent_same_level,
        )

    return _sample_unused_first(
        eligible_by_level,
        rng=rng,
        seed=seed,
        n_participants=n_participants,
        per_level=per_level,
        usage=usage,
        eligible_sizes=eligible_sizes,
        avoid_adjacent_same_level=avoid_adjacent_same_level,
    )


def _sample_unused_first(
    eligible_by_level: dict[str, list[dict[str, Any]]],
    *,
    rng: random.Random,
    seed: int,
    n_participants: int,
    per_level: int,
    usage: Counter,
    eligible_sizes: dict[str, int],
    avoid_adjacent_same_level: bool,
) -> SamplingResult:
    participants: list[ParticipantAssignment] = []

    for p_idx in range(1, n_participants + 1):
        pid = f"P{p_idx:03d}"
        selected_ids: set[int] = set()
        picked: list[SampledItem] = []

        for level in LEVEL5_ORDER:
            pool = eligible_by_level[level]
            for _ in range(per_level):
                chosen = _pick_unused_first(rng, pool, usage, selected_ids)
                mid = int(chosen["id"])
                selected_ids.add(mid)
                usage[mid] += 1
                picked.append(_item_to_sampled(chosen))

        if len(selected_ids) != len(LEVEL5_ORDER) * per_level:
            raise RuntimeError(f"{pid} 内部出现重复题目")

        ordered = _shuffle_presentation(
            rng,
            picked,
            avoid_adjacent_same_level=avoid_adjacent_same_level,
        )
        for i, it in enumerate(ordered):
            it.trial_index = i

        participants.append(ParticipantAssignment(participant_id=pid, items=ordered))

    return SamplingResult(
        seed=seed,
        mode="unused_first",
        n_participants=n_participants,
        per_level=per_level,
        participants=participants,
        usage_counts=dict(usage),
        eligible_sizes=eligible_sizes,
    )


def _sample_deal(
    eligible_by_level: dict[str, list[dict[str, Any]]],
    *,
    rng: random.Random,
    seed: int,
    n_participants: int,
    per_level: int,
    usage: Counter,
    eligible_sizes: dict[str, int],
    avoid_adjacent_same_level: bool,
) -> SamplingResult:
    """每层洗牌后发牌；若题不够发满则循环复用并继续按 1/(1+c) 倾向（实际用顺序复用+计数）。"""
    # 预洗每层 deck
    decks: dict[str, list[dict[str, Any]]] = {}
    cursors: dict[str, int] = {}
    for lv in LEVEL5_ORDER:
        deck = list(eligible_by_level[lv])
        rng.shuffle(deck)
        decks[lv] = deck
        cursors[lv] = 0

    participants: list[ParticipantAssignment] = []

    for p_idx in range(1, n_participants + 1):
        pid = f"P{p_idx:03d}"
        selected_ids: set[int] = set()
        picked: list[SampledItem] = []

        for level in LEVEL5_ORDER:
            for _ in range(per_level):
                deck = decks[level]
                # 找下一张本被试未用过的牌；deck 耗尽则重新洗牌并继续
                attempts = 0
                max_attempts = len(deck) * 3 + 10
                chosen = None
                while attempts < max_attempts:
                    if cursors[level] >= len(deck):
                        rng.shuffle(deck)
                        cursors[level] = 0
                    cand = deck[cursors[level]]
                    cursors[level] += 1
                    attempts += 1
                    mid = int(cand["id"])
                    if mid not in selected_ids:
                        chosen = cand
                        break
                if chosen is None:
                    # 极端兜底：层内加权（排除已选）
                    chosen = _pick_unused_first(rng, deck, usage, selected_ids)

                mid = int(chosen["id"])
                selected_ids.add(mid)
                usage[mid] += 1
                picked.append(_item_to_sampled(chosen))

        ordered = _shuffle_presentation(
            rng,
            picked,
            avoid_adjacent_same_level=avoid_adjacent_same_level,
        )
        for i, it in enumerate(ordered):
            it.trial_index = i
        participants.append(ParticipantAssignment(participant_id=pid, items=ordered))

    return SamplingResult(
        seed=seed,
        mode="deal",
        n_participants=n_participants,
        per_level=per_level,
        participants=participants,
        usage_counts=dict(usage),
        eligible_sizes=eligible_sizes,
    )
