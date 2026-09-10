#!/usr/bin/env python3
"""分层动态覆盖抽样 CLI。

示例：
  cd backend
  python -m sampling.run_sampling
  python -m sampling.run_sampling --seed 20260908 --mode deal
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sampling.constants import (  # noqa: E402
    DEFAULT_MODE,
    DEFAULT_N_PARTICIPANTS,
    DEFAULT_PER_LEVEL,
    DEFAULT_SEED,
    LEVEL5_ORDER,
    VALID_MODES,
)
from sampling.pipeline import run_sampling_pipeline  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按 level5 分层做 unused-first / deal 动态覆盖抽样，生成 50×15 实验材料包",
    )
    parser.add_argument("--mwps", type=Path, default=_BACKEND_ROOT / "MWPs.json")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--mode", choices=VALID_MODES, default=DEFAULT_MODE)
    parser.add_argument("--n-participants", type=int, default=DEFAULT_N_PARTICIPANTS)
    parser.add_argument("--per-level", type=int, default=DEFAULT_PER_LEVEL)
    parser.add_argument("--include-format-diff", action="store_true")
    parser.add_argument("--allow-missing-composite-score", action="store_true")
    parser.add_argument("--avoid-adjacent-same-level", action="store_true")
    parser.add_argument("--output", type=Path, default=None)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    result = run_sampling_pipeline(
        seed=args.seed,
        mode=args.mode,
        n_participants=args.n_participants,
        per_level=args.per_level,
        include_format_diff=args.include_format_diff,
        allow_missing_composite_score=args.allow_missing_composite_score,
        avoid_adjacent_same_level=args.avoid_adjacent_same_level,
        mwps_path=args.mwps,
        output_dir=args.output,
    )
    print("=== Done ===")
    print(f"Output dir: {result.out_dir}")
    print(f"Total trials: {result.total_trials}")
    print(f"Unique items: {result.unique_items}")
    print(f"Duplicate trials: {result.duplicate_trials}")
    print(f"Database size: {result.database_size}")
    print(f"Eligible size: {result.eligible_size}")
    print(f"Coverage rate (vs DB): {result.coverage_vs_database:.4%}")
    print(f"Coverage rate (vs eligible): {result.coverage_vs_eligible:.4%}")
    for lv in LEVEL5_ORDER:
        print(f"  [{lv}] eligible={result.eligible_by_level.get(lv, 0)}")
    for w in result.warnings:
        print(f"WARNING: {w}")
    for k, v in result.files.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
