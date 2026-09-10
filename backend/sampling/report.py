"""抽样质量断言、统计报告与可视化。"""

from __future__ import annotations

import csv
import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .constants import LEVEL5_ORDER
from .sampler import SamplingResult


@dataclass
class ValidationIssue:
    severity: str  # error | warning
    code: str
    message: str


@dataclass
class CoverageStats:
    total_trials: int
    unique_items: int
    duplicate_trials: int
    database_size: int
    eligible_size: int
    coverage_vs_database: float
    coverage_vs_eligible: float
    by_level: dict[str, dict[str, Any]]
    usage_histogram: dict[int, int]  # usage_count -> number_of_items
    max_usage: int
    participant_level_ok: bool
    participant_unique_ok: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)


def validate_and_compute(
    result: SamplingResult,
    *,
    database_size: int,
    eligible_by_level: dict[str, list],
    expected_n_participants: Optional[int] = None,
) -> CoverageStats:
    expected_n = expected_n_participants if expected_n_participants is not None else result.n_participants
    expected_trials = expected_n * len(LEVEL5_ORDER) * result.per_level
    issues: list[ValidationIssue] = []

    if len(result.participants) != expected_n:
        issues.append(
            ValidationIssue(
                "error",
                "participant_count",
                f"被试数量={len(result.participants)}，期望={expected_n}",
            )
        )

    all_ids: list[int] = []
    level_trial_counts: Counter = Counter()
    level_unique: dict[str, set[int]] = {lv: set() for lv in LEVEL5_ORDER}
    participant_level_ok = True
    participant_unique_ok = True

    for p in result.participants:
        ids = [it.mwp_id for it in p.items]
        all_ids.extend(ids)

        if len(set(ids)) != len(ids) or len(ids) != len(LEVEL5_ORDER) * result.per_level:
            participant_unique_ok = False
            issues.append(
                ValidationIssue(
                    "error",
                    "within_participant_duplicate",
                    f"{p.participant_id}: unique={len(set(ids))} total={len(ids)}，期望={len(LEVEL5_ORDER) * result.per_level}",
                )
            )

        level_counts = Counter(it.level5 for it in p.items)
        dist = " / ".join(str(level_counts.get(lv, 0)) for lv in LEVEL5_ORDER)
        ok = all(level_counts.get(lv, 0) == result.per_level for lv in LEVEL5_ORDER)
        if not ok:
            participant_level_ok = False
            issues.append(
                ValidationIssue(
                    "error",
                    "level_quota",
                    f"{p.participant_id}: 复杂度分布 {dist}，期望每档 {result.per_level}",
                )
            )

        for it in p.items:
            level_trial_counts[it.level5] += 1
            level_unique[it.level5].add(it.mwp_id)

    total_trials = len(all_ids)
    if total_trials != expected_trials:
        issues.append(
            ValidationIssue(
                "error",
                "total_trials",
                f"总 trial={total_trials}，期望={expected_trials}",
            )
        )

    unique_items = len(set(all_ids))
    duplicate_trials = total_trials - unique_items
    eligible_size = sum(len(v) for v in eligible_by_level.values())

    by_level: dict[str, dict[str, Any]] = {}
    for lv in LEVEL5_ORDER:
        trials = level_trial_counts.get(lv, 0)
        uniq = len(level_unique[lv])
        elig = len(eligible_by_level.get(lv, []))
        by_level[lv] = {
            "total_trials": trials,
            "unique_items": uniq,
            "duplicate_trials": trials - uniq,
            "eligible_size": elig,
            "coverage_rate": (uniq / elig) if elig else 0.0,
        }
        expected_level_trials = expected_n * result.per_level
        if trials != expected_level_trials:
            issues.append(
                ValidationIssue(
                    "error",
                    "level_trials",
                    f"层「{lv}」trial={trials}，期望={expected_level_trials}",
                )
            )
        if uniq < expected_level_trials:
            issues.append(
                ValidationIssue(
                    "warning",
                    "level_unique_lt_trials",
                    f"层「{lv}」unique={uniq} < trials={trials}，存在跨被试重复",
                )
            )

    # usage histogram：含未使用题（usage=0）基于 eligible
    usage = Counter(all_ids)
    usage_histogram: Counter = Counter()
    for lv, pool in eligible_by_level.items():
        for item in pool:
            c = usage.get(int(item["id"]), 0)
            usage_histogram[c] += 1

    max_usage = max(usage.values()) if usage else 0
    if max_usage > 1:
        issues.append(
            ValidationIssue(
                "warning",
                "max_usage",
                f"题目最大使用次数 max(c_i)={max_usage}",
            )
        )

    excluded_ratio = 1.0 - (eligible_size / database_size) if database_size else 0.0
    if excluded_ratio > 0.2:
        issues.append(
            ValidationIssue(
                "warning",
                "high_exclusion_rate",
                f"合格题池过滤比例={excluded_ratio:.1%}（excluded={database_size - eligible_size}/{database_size}）",
            )
        )

    return CoverageStats(
        total_trials=total_trials,
        unique_items=unique_items,
        duplicate_trials=duplicate_trials,
        database_size=database_size,
        eligible_size=eligible_size,
        coverage_vs_database=(unique_items / database_size) if database_size else 0.0,
        coverage_vs_eligible=(unique_items / eligible_size) if eligible_size else 0.0,
        by_level=by_level,
        usage_histogram=dict(sorted(usage_histogram.items())),
        max_usage=max_usage,
        participant_level_ok=participant_level_ok,
        participant_unique_ok=participant_unique_ok,
        issues=issues,
    )


def assert_hard_constraints(stats: CoverageStats) -> None:
    errors = [i for i in stats.issues if i.severity == "error"]
    if errors:
        msg = "\n".join(f"- [{e.code}] {e.message}" for e in errors)
        raise RuntimeError(f"抽样硬质检失败：\n{msg}")


def write_assignments_json(result: SamplingResult, path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(result.to_assignments_dict(), f, ensure_ascii=False, indent=2)


def write_assignments_csv(result: SamplingResult, path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "participant_id",
                "trial_index",
                "mwp_id",
                "level5",
                "composite_score",
                "rank",
                "answer_quality",
                "raw_text",
            ],
        )
        writer.writeheader()
        for p in result.participants:
            for it in p.items:
                writer.writerow(
                    {
                        "participant_id": p.participant_id,
                        "trial_index": it.trial_index,
                        "mwp_id": it.mwp_id,
                        "level5": it.level5,
                        "composite_score": it.composite_score,
                        "rank": it.rank,
                        "answer_quality": it.answer_quality,
                        "raw_text": it.raw_text,
                    }
                )


def write_sampling_quality_report(
    result: SamplingResult,
    stats: CoverageStats,
    path: Path | str,
) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    lines.append("# Sampling Quality Report")
    lines.append("")
    lines.append("## Meta")
    lines.append("")
    lines.append(f"- seed: `{result.seed}`")
    lines.append(f"- mode: `{result.mode}`")
    lines.append(f"- n_participants: `{result.n_participants}`")
    lines.append(f"- per_level: `{result.per_level}`")
    lines.append("")
    lines.append("## Coverage")
    lines.append("")
    lines.append(f"- Total trials: **{stats.total_trials}**")
    lines.append(f"- Unique items: **{stats.unique_items}**")
    lines.append(f"- Duplicate trials: **{stats.duplicate_trials}**")
    lines.append(f"- Database size: **{stats.database_size}**")
    lines.append(f"- Eligible size: **{stats.eligible_size}**")
    lines.append(f"- Coverage rate (vs database): **{stats.coverage_vs_database:.4%}**")
    lines.append(f"- Coverage rate (vs eligible): **{stats.coverage_vs_eligible:.4%}**")
    lines.append(f"- Max usage count: **{stats.max_usage}**")
    lines.append("")
    lines.append("## Per-participant level distribution")
    lines.append("")
    lines.append("期望：每个被试 `易/较易/中等/较难/难 = 3/3/3/3/3`")
    lines.append("")
    for p in result.participants:
        c = Counter(it.level5 for it in p.items)
        dist = " / ".join(str(c.get(lv, 0)) for lv in LEVEL5_ORDER)
        lines.append(f"- {p.participant_id}: {dist}")
    lines.append("")
    lines.append("## Coverage by level5")
    lines.append("")
    lines.append("| level5 | total trials | unique items | duplicate trials | eligible | coverage |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for lv in LEVEL5_ORDER:
        row = stats.by_level[lv]
        lines.append(
            f"| {lv} | {row['total_trials']} | {row['unique_items']} | "
            f"{row['duplicate_trials']} | {row['eligible_size']} | {row['coverage_rate']:.4%} |"
        )
    lines.append("")
    lines.append("## Usage count distribution")
    lines.append("")
    lines.append("| usage_count | number_of_items |")
    lines.append("| ---: | ---: |")
    for k, v in stats.usage_histogram.items():
        lines.append(f"| {k} | {v} |")
    lines.append("")
    lines.append("## Issues")
    lines.append("")
    if not stats.issues:
        lines.append("无。")
    else:
        for issue in stats.issues:
            lines.append(f"- **{issue.severity}** `{issue.code}`: {issue.message}")
    lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")

    # 同步写 JSON 统计，便于程序读取
    json_path = path.with_suffix(".json")
    payload = {
        "meta": result.to_assignments_dict()["meta"],
        "coverage": {
            "total_trials": stats.total_trials,
            "unique_items": stats.unique_items,
            "duplicate_trials": stats.duplicate_trials,
            "database_size": stats.database_size,
            "eligible_size": stats.eligible_size,
            "coverage_vs_database": stats.coverage_vs_database,
            "coverage_vs_eligible": stats.coverage_vs_eligible,
            "max_usage": stats.max_usage,
            "by_level": stats.by_level,
            "usage_histogram": {str(k): v for k, v in stats.usage_histogram.items()},
        },
        "issues": [
            {"severity": i.severity, "code": i.code, "message": i.message} for i in stats.issues
        ],
    }
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


_LEVEL5_AXIS_LABELS = {
    "易": "Easy",
    "较易": "FairlyEasy",
    "中等": "Medium",
    "较难": "FairlyHard",
    "难": "Hard",
}


def _configure_matplotlib_font() -> None:
    """优先使用系统中文字体；找不到则后续坐标轴用英文标签。"""
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import font_manager, rcParams

    candidates = [
        "Microsoft YaHei",
        "SimHei",
        "SimSun",
        "Noto Sans CJK SC",
        "Arial Unicode MS",
    ]
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in candidates:
        if name in available:
            rcParams["font.sans-serif"] = [name, "DejaVu Sans"]
            rcParams["axes.unicode_minus"] = False
            return


def generate_figures(result: SamplingResult, stats: CoverageStats, out_dir: Path | str) -> dict[str, Path]:
    """生成三张必需图，返回路径字典。"""
    try:
        _configure_matplotlib_font()
        import matplotlib.pyplot as plt
    except ImportError as e:
        raise RuntimeError(
            "需要 matplotlib 才能生成可视化。请执行: pip install matplotlib"
        ) from e

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    # 坐标轴使用英文别名，避免无中文字体环境下缺字
    xlabels = [_LEVEL5_AXIS_LABELS[lv] for lv in LEVEL5_ORDER]

    # 图1：五个复杂度等级的 trial 数量
    fig1, ax1 = plt.subplots(figsize=(8, 4.5))
    trials = [stats.by_level[lv]["total_trials"] for lv in LEVEL5_ORDER]
    ax1.bar(xlabels, trials, color="#4C78A8")
    ax1.axhline(y=result.n_participants * result.per_level, color="#E45756", linestyle="--", linewidth=1)
    ax1.set_xlabel("level5")
    ax1.set_ylabel("total trials")
    ax1.set_title("Trials by complexity level")
    for i, v in enumerate(trials):
        ax1.text(i, v + max(trials) * 0.01, str(v), ha="center", va="bottom", fontsize=9)
    fig1.tight_layout()
    p1 = out_dir / "fig1_trials_by_level.png"
    fig1.savefig(p1, dpi=150)
    plt.close(fig1)
    paths["fig1"] = p1

    # 图2：不同复杂度等级的 unique item 数量
    fig2, ax2 = plt.subplots(figsize=(8, 4.5))
    uniques = [stats.by_level[lv]["unique_items"] for lv in LEVEL5_ORDER]
    ax2.bar(xlabels, uniques, color="#72B7B2")
    ax2.set_xlabel("level5")
    ax2.set_ylabel("unique items")
    ax2.set_title("Unique items by complexity level")
    for i, v in enumerate(uniques):
        ax2.text(i, v + max(uniques) * 0.01, str(v), ha="center", va="bottom", fontsize=9)
    fig2.tight_layout()
    p2 = out_dir / "fig2_unique_by_level.png"
    fig2.savefig(p2, dpi=150)
    plt.close(fig2)
    paths["fig2"] = p2

    # 图3：题目使用次数分布
    fig3, ax3 = plt.subplots(figsize=(8, 4.5))
    xs = sorted(stats.usage_histogram.keys())
    ys = [stats.usage_histogram[x] for x in xs]
    ax3.bar([str(x) for x in xs], ys, color="#F58518")
    ax3.set_xlabel("usage_count")
    ax3.set_ylabel("number_of_items")
    ax3.set_title("Item usage count distribution (eligible pool)")
    fig3.tight_layout()
    p3 = out_dir / "fig3_usage_hist.png"
    fig3.savefig(p3, dpi=150)
    plt.close(fig3)
    paths["fig3"] = p3

    return paths
