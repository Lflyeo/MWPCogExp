"""将抽样 assignments 导入 ExperimentFlow。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.experiment_flow import ExperimentFlow
from models.experiment_question import ExperimentQuestion


@dataclass
class ImportPlanItem:
    flow_id: str
    question_id: str
    mwp_id: int
    title: str
    content: str
    level5: str
    sort_order: int
    composite_score: Optional[float]
    participant_id: str


@dataclass
class ImportPlan:
    """描述如何把一份 assignments 映射为实验流题目。"""

    seed: int
    mode: str
    flows: dict[str, list[ImportPlanItem]]  # flow_id -> questions

    @property
    def n_flows(self) -> int:
        return len(self.flows)


def load_assignments(path: Path | str) -> dict[str, Any]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if "meta" not in data or "participants" not in data:
        raise ValueError("assignments.json 缺少 meta / participants")
    return data


def build_import_plan(
    assignments: dict[str, Any],
    *,
    participant_ids: Optional[list[str]] = None,
) -> ImportPlan:
    """
    将 assignments 转为导入计划。

    约定：
    - flow_id = flow-{participant_id.lower()}  例如 flow-p001
    - question_id = mwp-{mwp_id}
    - content = raw_text
    - title = [level5] MWP {mwp_id}
    - sort_order = trial_index
    """
    meta = assignments["meta"]
    allow = set(participant_ids) if participant_ids else None
    flows: dict[str, list[ImportPlanItem]] = {}

    for p in assignments["participants"]:
        pid = p["participant_id"]
        if allow is not None and pid not in allow:
            continue
        flow_id = f"flow-{pid.lower()}"
        questions: list[ImportPlanItem] = []
        for it in p["items"]:
            mwp_id = int(it["mwp_id"])
            level5 = str(it["level5"])
            questions.append(
                ImportPlanItem(
                    flow_id=flow_id,
                    question_id=f"mwp-{mwp_id}",
                    mwp_id=mwp_id,
                    title=f"[{level5}] MWP {mwp_id}",
                    content=str(it["raw_text"]),
                    level5=level5,
                    sort_order=int(it["trial_index"]),
                    composite_score=it.get("composite_score"),
                    participant_id=pid,
                )
            )
        flows[flow_id] = questions

    return ImportPlan(
        seed=int(meta["seed"]),
        mode=str(meta["mode"]),
        flows=flows,
    )


def import_plan_to_preview_dict(plan: ImportPlan, *, max_flows: int = 3) -> dict[str, Any]:
    """便于审阅的预览结构（默认只展开前几个流）。"""
    flow_ids = list(plan.flows.keys())
    preview_ids = flow_ids[:max_flows]
    return {
        "seed": plan.seed,
        "mode": plan.mode,
        "n_flows": plan.n_flows,
        "flow_ids": flow_ids,
        "preview_flows": {
            fid: [
                {
                    "question_id": q.question_id,
                    "mwp_id": q.mwp_id,
                    "title": q.title,
                    "level5": q.level5,
                    "sort_order": q.sort_order,
                    "content_preview": q.content[:60] + ("…" if len(q.content) > 60 else ""),
                }
                for q in plan.flows[fid]
            ]
            for fid in preview_ids
        },
    }


@dataclass
class ImportResult:
    seed: int
    mode: str
    created_flows: int
    updated_flows: int
    created_questions: int
    flow_ids: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "seed": self.seed,
            "mode": self.mode,
            "created_flows": self.created_flows,
            "updated_flows": self.updated_flows,
            "created_questions": self.created_questions,
            "n_flows": len(self.flow_ids),
            "flow_ids": self.flow_ids,
        }


def import_assignments_to_db(
    db: Session,
    assignments_path: Path | str,
    *,
    replace_existing: bool = True,
    enabled: bool = True,
    rest_break_enabled: bool = True,
    rest_break_seconds: int = 5,
    rest_break_every: int = 1,
    participant_ids: Optional[list[str]] = None,
) -> ImportResult:
    """
    将 assignments.json 写入 experiment_flows / experiment_questions。

    - 每位被试一条流：flow-p001 …
    - replace_existing=True：已存在则更新流元数据并重建题目
    - replace_existing=False：已存在则跳过该流
    """
    assignments = load_assignments(assignments_path)
    plan = build_import_plan(assignments, participant_ids=participant_ids)
    if plan.n_flows == 0:
        raise ValueError("没有可导入的被试分配")

    created_flows = 0
    updated_flows = 0
    created_questions = 0
    flow_ids: list[str] = []

    try:
        for idx, (flow_id, questions) in enumerate(plan.flows.items()):
            pid = questions[0].participant_id if questions else flow_id
            existing = db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id).first()
            name = f"被试 {pid}（seed={plan.seed}）"
            desc = (
                f"分层覆盖抽样自动导入 | seed={plan.seed} | mode={plan.mode} | "
                f"participant={pid} | questions={len(questions)}"
            )

            if existing:
                if not replace_existing:
                    continue
                existing.name = name
                existing.description = desc
                existing.enabled = enabled
                existing.rest_break_enabled = rest_break_enabled
                existing.rest_break_seconds = rest_break_seconds
                existing.rest_break_every = max(1, rest_break_every)
                existing.sort_order = 1000 + idx
                db.query(ExperimentQuestion).filter(ExperimentQuestion.flow_id == flow_id).delete()
                updated_flows += 1
            else:
                db.add(
                    ExperimentFlow(
                        id=flow_id,
                        name=name,
                        description=desc,
                        sort_order=1000 + idx,
                        enabled=enabled,
                        rest_break_enabled=rest_break_enabled,
                        rest_break_seconds=rest_break_seconds,
                        rest_break_every=max(1, rest_break_every),
                    )
                )
                created_flows += 1

            for q in questions:
                db.add(
                    ExperimentQuestion(
                        flow_id=flow_id,
                        id=q.question_id,
                        title=q.title,
                        content=q.content,
                        sort_order=q.sort_order,
                        enabled=True,
                        mwp_id=q.mwp_id,
                        level5=q.level5,
                    )
                )
                created_questions += 1
            flow_ids.append(flow_id)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return ImportResult(
        seed=plan.seed,
        mode=plan.mode,
        created_flows=created_flows,
        updated_flows=updated_flows,
        created_questions=created_questions,
        flow_ids=flow_ids,
    )
