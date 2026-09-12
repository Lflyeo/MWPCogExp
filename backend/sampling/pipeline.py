"""抽样流水线：供 CLI 与管理端 API 共用。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from .constants import DEFAULT_MODE, DEFAULT_N_PARTICIPANTS, DEFAULT_PER_LEVEL, DEFAULT_SEED, LEVEL5_ORDER
from .data_quality import (
    assert_pool_sufficient,
    build_eligible_pool,
    load_mwps_json,
    write_quality_report_csv,
)
from .report import (
    assert_hard_constraints,
    generate_figures,
    validate_and_compute,
    write_assignments_csv,
    write_assignments_json,
    write_sampling_quality_report,
)
from .sampler import sample_assignments


def backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_mwps_path() -> Path:
    return backend_root() / "MWPs.json"


_RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


def output_root(base: Optional[Path] = None) -> Path:
    return base or (backend_root() / "sampling" / "output")


def output_dir_for_seed(seed: int, base: Optional[Path] = None) -> Path:
    """兼容旧路径 output/{seed}。新抽样请用 allocate_output_dir，避免覆盖。"""
    return output_root(base) / str(seed)


def resolve_run_dir(run_id: str, base: Optional[Path] = None) -> Path:
    rid = (run_id or "").strip()
    if not _RUN_ID_RE.match(rid):
        raise ValueError("非法产物 ID")
    return output_root(base) / rid


def allocate_output_dir(seed: int, base: Optional[Path] = None) -> tuple[str, Path]:
    """为一次抽样分配新目录，同一种子再次运行时追加 -2、-3…，不覆盖已有结果。"""
    root = output_root(base)
    root.mkdir(parents=True, exist_ok=True)
    base_id = str(seed)
    first = root / base_id
    if not first.exists():
        return base_id, first
    n = 2
    while True:
        run_id = f"{base_id}-{n}"
        candidate = root / run_id
        if not candidate.exists():
            return run_id, candidate
        n += 1


@dataclass
class PipelineResult:
    seed: int
    run_id: str
    mode: str
    out_dir: Path
    total_trials: int
    unique_items: int
    duplicate_trials: int
    database_size: int
    eligible_size: int
    coverage_vs_database: float
    coverage_vs_eligible: float
    eligible_by_level: dict[str, int]
    warnings: list[str]
    files: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "seed": self.seed,
            "run_id": self.run_id,
            "mode": self.mode,
            "out_dir": str(self.out_dir),
            "total_trials": self.total_trials,
            "unique_items": self.unique_items,
            "duplicate_trials": self.duplicate_trials,
            "database_size": self.database_size,
            "eligible_size": self.eligible_size,
            "coverage_vs_database": self.coverage_vs_database,
            "coverage_vs_eligible": self.coverage_vs_eligible,
            "eligible_by_level": self.eligible_by_level,
            "warnings": self.warnings,
            "files": self.files,
        }


def run_sampling_pipeline(
    *,
    seed: int = DEFAULT_SEED,
    mode: str = DEFAULT_MODE,
    n_participants: int = DEFAULT_N_PARTICIPANTS,
    per_level: int = DEFAULT_PER_LEVEL,
    include_format_diff: bool = False,
    allow_missing_composite_score: bool = False,
    avoid_adjacent_same_level: bool = False,
    mwps_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
) -> PipelineResult:
    mwps_path = Path(mwps_path) if mwps_path else default_mwps_path()
    if output_dir is not None:
        out_dir = Path(output_dir)
        if out_dir.exists() and any(out_dir.iterdir()):
            raise RuntimeError(f"输出目录已存在且非空，拒绝覆盖: {out_dir}")
        run_id = out_dir.name
        out_dir.mkdir(parents=True, exist_ok=True)
    else:
        run_id, out_dir = allocate_output_dir(seed)
        out_dir.mkdir(parents=True, exist_ok=False)

    raw_items = load_mwps_json(mwps_path)
    quality = build_eligible_pool(
        raw_items,
        exclude_format_diff=not include_format_diff,
        require_composite_score=not allow_missing_composite_score,
    )
    write_quality_report_csv(quality, out_dir / "data_quality_report.csv")
    assert_pool_sufficient(quality.eligible_by_level, per_level)

    result = sample_assignments(
        quality.eligible_by_level,
        seed=seed,
        n_participants=n_participants,
        per_level=per_level,
        mode=mode,
        avoid_adjacent_same_level=avoid_adjacent_same_level,
    )
    result.run_id = run_id

    stats = validate_and_compute(
        result,
        database_size=quality.raw_count,
        eligible_by_level=quality.eligible_by_level,
        expected_n_participants=n_participants,
    )
    assert_hard_constraints(stats)

    write_assignments_json(result, out_dir / "assignments.json")
    write_assignments_csv(result, out_dir / "assignments.csv")
    write_sampling_quality_report(result, stats, out_dir / "sampling_quality_report.md")

    warnings = [i.message for i in stats.issues if i.severity == "warning"]
    files = {
        "assignments_json": "assignments.json",
        "assignments_csv": "assignments.csv",
        "data_quality_report": "data_quality_report.csv",
        "sampling_quality_report_md": "sampling_quality_report.md",
        "sampling_quality_report_json": "sampling_quality_report.json",
    }
    try:
        figs = generate_figures(result, stats, out_dir)
        files["fig1"] = figs["fig1"].name
        files["fig2"] = figs["fig2"].name
        files["fig3"] = figs["fig3"].name
    except Exception as e:
        warnings.append(f"可视化图片未生成: {e}")

    return PipelineResult(
        seed=seed,
        run_id=run_id,
        mode=mode,
        out_dir=out_dir,
        total_trials=stats.total_trials,
        unique_items=stats.unique_items,
        duplicate_trials=stats.duplicate_trials,
        database_size=stats.database_size,
        eligible_size=stats.eligible_size,
        coverage_vs_database=stats.coverage_vs_database,
        coverage_vs_eligible=stats.coverage_vs_eligible,
        eligible_by_level={lv: len(quality.eligible_by_level[lv]) for lv in LEVEL5_ORDER},
        warnings=warnings,
        files=files,
    )


def list_output_seeds(base: Optional[Path] = None) -> list[dict[str, Any]]:
    root = base or (backend_root() / "sampling" / "output")
    if not root.exists():
        return []
    items: list[dict[str, Any]] = []
    for p in root.iterdir():
        if not p.is_dir():
            continue
        assignments = p / "assignments.json"
        report = p / "sampling_quality_report.json"
        created_at = None
        stamp_path = assignments if assignments.exists() else (report if report.exists() else p)
        try:
            created_at = stamp_path.stat().st_mtime
        except OSError:
            created_at = None
        seed_from_dir = p.name.split("-", 1)[0]
        meta: dict[str, Any] = {
            "run_id": p.name,
            "seed": seed_from_dir,
            "path": str(p),
            "has_assignments": assignments.exists(),
            "created_at": created_at,
        }
        if report.exists():
            import json

            try:
                data = json.loads(report.read_text(encoding="utf-8"))
                meta["coverage"] = data.get("coverage")
                report_meta = data.get("meta") or {}
                meta["meta"] = report_meta
                if report_meta.get("seed") is not None:
                    meta["seed"] = report_meta.get("seed")
                if report_meta.get("run_id"):
                    meta["run_id"] = report_meta.get("run_id")
            except Exception:
                pass
        items.append(meta)
    items.sort(key=lambda x: (x.get("created_at") or 0, str(x.get("seed"))), reverse=True)
    return items
