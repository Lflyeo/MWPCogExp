"""
将 backend/MWPs.json 导入到 mwps 表（幂等 upsert）。

用法:
  python import_mwps.py              # 若表已有数据则跳过
  python import_mwps.py --force      # 清空后重新导入
  python import_mwps.py --file path  # 指定 JSON 路径
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal
from migrate_mwps import migrate_mwps_schema

BATCH_SIZE = 500
DEFAULT_JSON = Path(__file__).resolve().parent / "MWPs.json"


def _as_str(value) -> str | None:
    if value is None:
        return None
    return str(value)


def _row_from_item(item: dict) -> dict:
    return {
        "id": int(item["id"]),
        "raw_text": item.get("raw_text") or "",
        "api_response_process": item.get("API_Response_Process"),
        "api_response_result": _as_str(item.get("API_Response_Result")),
        "answer_e": _as_str(item.get("E")),
        "answer_ans": _as_str(item.get("ans")),
        "original_text": item.get("original_text"),
        "pos": item.get("pos"),
        "answer_quality": item.get("_answer_quality"),
        "score_l": item.get("score_L"),
        "score_m": item.get("score_M"),
        "score_w": item.get("score_W"),
        "composite_score": item.get("composite_score"),
        "rank": item.get("rank"),
        "level5": item.get("level5"),
        "composite_score_critic": item.get("composite_score_critic"),
        "composite_score_flat_entropy": item.get("composite_score_flat_entropy"),
        "patched_by": item.get("_patched_by"),
        "patched_at": item.get("_patched_at"),
    }


UPSERT_SQL = text(
    """
    INSERT INTO mwps (
        id, raw_text, api_response_process, api_response_result,
        answer_e, answer_ans, original_text, pos, answer_quality,
        score_l, score_m, score_w, composite_score, `rank`, level5,
        composite_score_critic, composite_score_flat_entropy,
        patched_by, patched_at
    ) VALUES (
        :id, :raw_text, :api_response_process, :api_response_result,
        :answer_e, :answer_ans, :original_text, :pos, :answer_quality,
        :score_l, :score_m, :score_w, :composite_score, :rank, :level5,
        :composite_score_critic, :composite_score_flat_entropy,
        :patched_by, :patched_at
    )
    ON DUPLICATE KEY UPDATE
        raw_text = VALUES(raw_text),
        api_response_process = VALUES(api_response_process),
        api_response_result = VALUES(api_response_result),
        answer_e = VALUES(answer_e),
        answer_ans = VALUES(answer_ans),
        original_text = VALUES(original_text),
        pos = VALUES(pos),
        answer_quality = VALUES(answer_quality),
        score_l = VALUES(score_l),
        score_m = VALUES(score_m),
        score_w = VALUES(score_w),
        composite_score = VALUES(composite_score),
        `rank` = VALUES(`rank`),
        level5 = VALUES(level5),
        composite_score_critic = VALUES(composite_score_critic),
        composite_score_flat_entropy = VALUES(composite_score_flat_entropy),
        patched_by = VALUES(patched_by),
        patched_at = VALUES(patched_at)
    """
)


def import_mwps(
    db: Session,
    json_path: Path | None = None,
    force: bool = False,
    skip_if_not_empty: bool = True,
) -> dict:
    """
    导入 MWPs.json。返回 {imported, skipped, total, path}。
    """
    migrate_mwps_schema(db)

    path = Path(json_path) if json_path else DEFAULT_JSON
    if not path.exists():
        raise FileNotFoundError(f"MWPs.json not found: {path}")

    count = db.execute(text("SELECT COUNT(*) FROM mwps")).scalar() or 0
    if skip_if_not_empty and not force and count > 0:
        return {"imported": 0, "skipped": True, "total": int(count), "path": str(path)}

    if force and count > 0:
        db.execute(text("DELETE FROM mwps"))
        db.commit()

    with path.open("r", encoding="utf-8") as f:
        items = json.load(f)

    if not isinstance(items, list):
        raise ValueError("MWPs.json must be a JSON array")

    imported = 0
    for i in range(0, len(items), BATCH_SIZE):
        batch = [_row_from_item(x) for x in items[i : i + BATCH_SIZE]]
        db.execute(UPSERT_SQL, batch)
        db.commit()
        imported += len(batch)
        print(f"  imported {imported}/{len(items)}")

    total = db.execute(text("SELECT COUNT(*) FROM mwps")).scalar() or 0
    return {"imported": imported, "skipped": False, "total": int(total), "path": str(path)}


def main():
    parser = argparse.ArgumentParser(description="Import MWPs.json into mwps table")
    parser.add_argument("--force", action="store_true", help="清空后重新导入")
    parser.add_argument("--file", type=str, default=None, help="JSON 文件路径")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        print(f"Loading from {args.file or DEFAULT_JSON} ...")
        result = import_mwps(
            session,
            json_path=Path(args.file) if args.file else None,
            force=args.force,
            skip_if_not_empty=not args.force,
        )
        if result["skipped"]:
            print(f"Skipped: mwps already has {result['total']} rows. Use --force to re-import.")
        else:
            print(f"Done: imported {result['imported']} rows, table total={result['total']}")
    except Exception as e:
        session.rollback()
        print(f"Import failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
