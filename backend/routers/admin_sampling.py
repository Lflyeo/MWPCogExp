"""管理端：分层动态覆盖抽样 — 运行、预览、导入实验流。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from routers.admin import get_admin_token
from schemas.admin import (
    AdminSamplingImportRequest,
    AdminSamplingRunRequest,
)
from sampling.constants import VALID_MODES
from sampling.import_to_experiment import (
    build_import_plan,
    import_assignments_to_db,
    import_plan_to_preview_dict,
    load_assignments,
)
from sampling.pipeline import list_output_seeds, resolve_run_dir, run_sampling_pipeline

router = APIRouter(prefix="/admin/experiment-sampling", tags=["管理员-实验抽样"])

_ALLOWED_FILES = {
    "assignments.json",
    "assignments.csv",
    "data_quality_report.csv",
    "sampling_quality_report.md",
    "sampling_quality_report.json",
    "fig1_trials_by_level.png",
    "fig2_unique_by_level.png",
    "fig3_usage_hist.png",
}


@router.post("/run")
def admin_run_sampling(
    req: AdminSamplingRunRequest,
    _: str = Depends(get_admin_token),
):
    if req.mode not in VALID_MODES:
        return {"errCode": 400, "errMsg": f"mode 必须是 {VALID_MODES}", "data": None}
    try:
        result = run_sampling_pipeline(
            seed=req.seed,
            mode=req.mode,
            n_participants=req.n_participants,
            per_level=req.per_level,
            include_format_diff=req.include_format_diff,
            allow_missing_composite_score=req.allow_missing_composite_score,
            avoid_adjacent_same_level=req.avoid_adjacent_same_level,
        )
        return {"errCode": 0, "errMsg": "success", "data": result.to_dict()}
    except Exception as e:
        return {"errCode": 500, "errMsg": f"抽样失败: {e}", "data": None}


@router.get("/outputs")
def admin_list_sampling_outputs(_: str = Depends(get_admin_token)):
    return {"errCode": 0, "errMsg": "success", "data": list_output_seeds()}


@router.get("/outputs/{run_id}")
def admin_get_sampling_output(run_id: str, _: str = Depends(get_admin_token)):
    try:
        out_dir = resolve_run_dir(run_id)
    except ValueError as e:
        return {"errCode": 400, "errMsg": str(e), "data": None}
    assignments_path = out_dir / "assignments.json"
    if not assignments_path.exists():
        return {"errCode": 404, "errMsg": f"未找到产物 {run_id}，请先运行抽样", "data": None}

    assignments = load_assignments(assignments_path)
    plan = build_import_plan(assignments)

    report_json_path = out_dir / "sampling_quality_report.json"
    coverage = None
    if report_json_path.exists():
        try:
            coverage = json.loads(report_json_path.read_text(encoding="utf-8"))
        except Exception:
            coverage = None

    participants = []
    for p in assignments.get("participants", []):
        items = []
        for it in p.get("items", []):
            text = str(it.get("raw_text") or "")
            items.append(
                {
                    "trial_index": it.get("trial_index"),
                    "mwp_id": it.get("mwp_id"),
                    "level5": it.get("level5"),
                    "composite_score": it.get("composite_score"),
                    "raw_text_preview": text[:80] + ("…" if len(text) > 80 else ""),
                }
            )
        participants.append(
            {
                "participant_id": p.get("participant_id"),
                "flow_id": f"flow-{str(p.get('participant_id', '')).lower()}",
                "items": items,
            }
        )

    meta = assignments.get("meta") or {}
    return {
        "errCode": 0,
        "errMsg": "success",
        "data": {
            "run_id": run_id,
            "seed": meta.get("seed", run_id.split("-", 1)[0]),
            "out_dir": str(out_dir),
            "meta": assignments.get("meta"),
            "n_participants": len(participants),
            "participants": participants,
            "preview": import_plan_to_preview_dict(plan, max_flows=1),
            "report": coverage,
            "files": sorted(p.name for p in out_dir.iterdir() if p.is_file() and p.name in _ALLOWED_FILES),
        },
    }


@router.get("/outputs/{run_id}/files/{filename}")
def admin_get_sampling_file(
    run_id: str,
    filename: str,
    _: str = Depends(get_admin_token),
):
    if filename not in _ALLOWED_FILES:
        raise HTTPException(status_code=400, detail="不允许访问该文件")
    try:
        path = resolve_run_dir(run_id) / filename
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")
    media = "application/octet-stream"
    if filename.endswith(".png"):
        media = "image/png"
    elif filename.endswith(".json"):
        media = "application/json"
    elif filename.endswith(".csv"):
        media = "text/csv"
    elif filename.endswith(".md"):
        media = "text/markdown"
    return FileResponse(path, media_type=media, filename=filename)


@router.post("/import")
def admin_import_sampling(
    req: AdminSamplingImportRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    run_id = (req.run_id or "").strip() or (str(req.seed) if req.seed is not None else "")
    if not run_id:
        return {"errCode": 400, "errMsg": "缺少 run_id", "data": None}
    try:
        assignments_path = resolve_run_dir(run_id) / "assignments.json"
    except ValueError as e:
        return {"errCode": 400, "errMsg": str(e), "data": None}
    if not assignments_path.exists():
        return {
            "errCode": 404,
            "errMsg": f"未找到产物 {run_id} 的 assignments.json，请先运行抽样",
            "data": None,
        }
    try:
        result = import_assignments_to_db(
            db,
            assignments_path,
            replace_existing=req.replace_existing,
            enabled=req.enabled,
            rest_break_enabled=req.rest_break_enabled,
            rest_break_seconds=req.rest_break_seconds,
            rest_break_every=req.rest_break_every,
            participant_ids=req.participant_ids,
        )
        return {"errCode": 0, "errMsg": "success", "data": result.to_dict()}
    except Exception as e:
        return {"errCode": 500, "errMsg": f"导入失败: {e}", "data": None}


@router.get("/preview-import")
def admin_preview_import(
    run_id: str = Query(...),
    participant_ids: Optional[str] = Query(None, description="逗号分隔，如 P001,P002"),
    _: str = Depends(get_admin_token),
):
    try:
        assignments_path = resolve_run_dir(run_id) / "assignments.json"
    except ValueError as e:
        return {"errCode": 400, "errMsg": str(e), "data": None}
    if not assignments_path.exists():
        return {"errCode": 404, "errMsg": f"未找到产物 {run_id}", "data": None}
    ids = [x.strip() for x in participant_ids.split(",") if x.strip()] if participant_ids else None
    assignments = load_assignments(assignments_path)
    plan = build_import_plan(assignments, participant_ids=ids)
    return {
        "errCode": 0,
        "errMsg": "success",
        "data": import_plan_to_preview_dict(plan, max_flows=5),
    }
