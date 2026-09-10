"""数据质量检查与合格题池构建（不修改原始数据库）。"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .constants import LEVEL5_ORDER


@dataclass
class QualityIssue:
    mwp_id: Any
    issue_type: str
    detail: str
    raw_text_preview: str = ""


@dataclass
class QualityResult:
    raw_count: int
    issues: list[QualityIssue] = field(default_factory=list)
    eligible_by_level: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    excluded_count: int = 0
    duplicate_id_count: int = 0
    duplicate_text_count: int = 0

    @property
    def eligible_count(self) -> int:
        return sum(len(v) for v in self.eligible_by_level.values())

    @property
    def eligible_items(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for level in LEVEL5_ORDER:
            items.extend(self.eligible_by_level.get(level, []))
        return items


def _preview(text: Optional[str], n: int = 80) -> str:
    if not text:
        return ""
    t = str(text).replace("\n", " ").strip()
    return t if len(t) <= n else t[:n] + "…"


def _normalize_item(raw: dict[str, Any]) -> dict[str, Any]:
    """将 JSON / DB 行统一为抽样内部结构。"""
    answer_quality = raw.get("answer_quality")
    if answer_quality is None:
        answer_quality = raw.get("_answer_quality")

    return {
        "id": raw.get("id"),
        "raw_text": (raw.get("raw_text") or "").strip() if raw.get("raw_text") is not None else "",
        "level5": raw.get("level5"),
        "composite_score": raw.get("composite_score"),
        "rank": raw.get("rank"),
        "answer_quality": answer_quality,
        "answer_e": raw.get("answer_e") or raw.get("E"),
        "answer_ans": raw.get("answer_ans") or raw.get("ans"),
        "score_l": raw.get("score_l") if "score_l" in raw else raw.get("score_L"),
        "score_m": raw.get("score_m") if "score_m" in raw else raw.get("score_M"),
        "score_w": raw.get("score_w") if "score_w" in raw else raw.get("score_W"),
    }


def load_mwps_json(path: Path | str) -> list[dict[str, Any]]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"MWPs.json 应为列表，实际类型: {type(data)}")
    return data


def build_eligible_pool(
    items: list[dict[str, Any]],
    *,
    exclude_format_diff: bool = True,
    require_composite_score: bool = True,
) -> QualityResult:
    """
    从全库构建合格题池并按 level5 分层。

    - 不修改原始数据
    - id 重复：记录问题，仅保留首次出现
    - raw_text 空：排除
    - level5 非法：排除
    - composite_score 缺失：默认排除
    - 完全相同 raw_text：保留 rank 更优（更小）或 id 更小的一条
    - answer_quality == format_diff：默认排除
    """
    issues: list[QualityIssue] = []
    seen_ids: set[Any] = set()
    by_text: dict[str, list[dict[str, Any]]] = defaultdict(list)
    candidates: list[dict[str, Any]] = []

    for raw in items:
        item = _normalize_item(raw)
        mid = item["id"]
        text = item["raw_text"]
        level = item["level5"]
        score = item["composite_score"]
        aq = item["answer_quality"]

        if mid is None:
            issues.append(QualityIssue(None, "missing_id", "缺少 id", _preview(text)))
            continue

        if mid in seen_ids:
            issues.append(
                QualityIssue(mid, "duplicate_id", "id 重复，抽样仅保留首次出现", _preview(text))
            )
            continue
        seen_ids.add(mid)

        if not text:
            issues.append(QualityIssue(mid, "empty_raw_text", "raw_text 为空", ""))
            continue

        if level not in LEVEL5_ORDER:
            issues.append(
                QualityIssue(
                    mid,
                    "invalid_level5",
                    f"level5={level!r} 不属于 {LEVEL5_ORDER}",
                    _preview(text),
                )
            )
            continue

        if require_composite_score and score is None:
            issues.append(
                QualityIssue(mid, "missing_composite_score", "composite_score 缺失", _preview(text))
            )
            continue

        if exclude_format_diff and aq == "format_diff":
            issues.append(
                QualityIssue(
                    mid,
                    "format_diff_excluded",
                    "answer_quality=format_diff，默认排除",
                    _preview(text),
                )
            )
            continue

        candidates.append(item)
        by_text[text].append(item)

    # 文本完全重复：保留 rank 最优（None 视为很大），再比 id
    duplicate_text_count = 0
    winners: dict[Any, dict[str, Any]] = {}
    for text, group in by_text.items():
        if len(group) == 1:
            winners[group[0]["id"]] = group[0]
            continue

        def sort_key(x: dict[str, Any]) -> tuple:
            r = x.get("rank")
            rid = x.get("id")
            return (
                r if isinstance(r, (int, float)) else 10**18,
                rid if isinstance(rid, (int, float)) else 10**18,
            )

        group_sorted = sorted(group, key=sort_key)
        keep = group_sorted[0]
        winners[keep["id"]] = keep
        for drop in group_sorted[1:]:
            duplicate_text_count += 1
            issues.append(
                QualityIssue(
                    drop["id"],
                    "duplicate_raw_text",
                    f"与 id={keep['id']} 的 raw_text 完全相同，已排除",
                    _preview(text),
                )
            )

    eligible_by_level: dict[str, list[dict[str, Any]]] = {lv: [] for lv in LEVEL5_ORDER}
    for item in winners.values():
        eligible_by_level[item["level5"]].append(item)

    for lv in LEVEL5_ORDER:
        eligible_by_level[lv].sort(
            key=lambda x: (
                x.get("rank") if isinstance(x.get("rank"), (int, float)) else 10**18,
                x["id"],
            )
        )

    duplicate_id_count = sum(1 for i in issues if i.issue_type == "duplicate_id")
    excluded = len(items) - sum(len(v) for v in eligible_by_level.values())

    return QualityResult(
        raw_count=len(items),
        issues=issues,
        eligible_by_level=eligible_by_level,
        excluded_count=excluded,
        duplicate_id_count=duplicate_id_count,
        duplicate_text_count=duplicate_text_count,
    )


def write_quality_report_csv(result: QualityResult, path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["mwp_id", "issue_type", "detail", "raw_text_preview"],
        )
        writer.writeheader()
        for issue in result.issues:
            writer.writerow(
                {
                    "mwp_id": issue.mwp_id if issue.mwp_id is not None else "",
                    "issue_type": issue.issue_type,
                    "detail": issue.detail,
                    "raw_text_preview": issue.raw_text_preview,
                }
            )


def assert_pool_sufficient(
    eligible_by_level: dict[str, list[dict[str, Any]]],
    per_level: int,
) -> None:
    """任一层 eligible < per_level 则硬失败。"""
    for lv in LEVEL5_ORDER:
        n = len(eligible_by_level.get(lv, []))
        if n < per_level:
            raise RuntimeError(
                f"复杂度层「{lv}」合格题量不足：eligible={n} < per_level={per_level}"
            )
