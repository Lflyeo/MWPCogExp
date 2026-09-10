"""
认知实验：实验流、题目读取（用户端）、实验数据提交。
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func

from config import settings
from database import get_db
from models.experiment_flow import ExperimentFlow
from models.experiment_question import ExperimentQuestion
from models.experiment_session import ExperimentSession
from routers.auth import get_current_user_optional
from schemas.experiment import (
    ExperimentFlowItem,
    ExperimentFlowListResponse,
    ExperimentFlowDetailResponse,
    ExperimentQuestionItem,
    ExperimentQuestionListResponse,
    ExperimentSessionSubmitRequest,
    ExperimentSessionSubmitResponse,
)

router = APIRouter(prefix="/experiment", tags=["认知实验"])

DEFAULT_FLOW_ID = "flow-default"
GUIDE_FLOW_ID = "flow-guide"

DEFAULT_QUESTIONS = [
    {
        "id": "q-001",
        "title": "分数应用题",
        "content": """**【题目】**

某班共有 40 名学生，其中女生人数是男生人数的 $\\frac{3}{5}$。

(1) 求男生人数；

(2) 求女生人数。""",
        "sort_order": 0,
    },
    {
        "id": "q-002",
        "title": "行程问题",
        "content": """**【题目】**

小明从家到学校需要 20 分钟，平均速度为 60 米/分钟。学校到图书馆的距离是 900 米。

(1) 求家到学校的距离；

(2) 若小明以相同速度从家出发，先到学校再到图书馆，共需多少分钟？""",
        "sort_order": 1,
    },
    {
        "id": "q-003",
        "title": "比例问题",
        "content": """**【题目】**

某工厂生产 A、B 两种产品，A 产品与 B 产品的产量之比为 $3:2$。已知 A 产品比 B 产品多生产 120 件。

(1) 求 A 产品的产量；

(2) 求两种产品的总产量。""",
        "sort_order": 2,
    },
]


GUIDE_QUESTIONS = [
    {
        "id": "guide-q1",
        "title": "练习：熟悉画板",
        "content": """**【操作练习 · 第 1 题】**

请在下方作答区随意画几笔，熟悉画笔工具。

熟悉操作后，请按 **F9** 结束本题。""",
        "sort_order": 0,
    },
    {
        "id": "guide-q2",
        "title": "练习：题间休息",
        "content": """**【操作练习 · 第 2 题】**

请再次在作答区书写。按 **F9** 结束本题后将进入题间休息；休息结束后即完成本次练习。

也可随时按 **F10** 提前结束整个练习。""",
        "sort_order": 1,
    },
]


def _count_questions(db: Session, flow_id: str) -> int:
    return (
        db.query(func.count(ExperimentQuestion.id))
        .filter(ExperimentQuestion.flow_id == flow_id, ExperimentQuestion.enabled.is_(True))
        .scalar()
        or 0
    )


def ensure_guide_experiment_flow(db: Session) -> int:
    """确保内置操作练习流存在（幂等）。返回新增的记录数。"""
    added = 0
    flow = db.query(ExperimentFlow).filter(ExperimentFlow.id == GUIDE_FLOW_ID).first()
    if not flow:
        flow = ExperimentFlow(
            id=GUIDE_FLOW_ID,
            name="实验操作练习",
            description="熟悉个人信息确认、倒计时、作答、F9/F10 与题间休息等完整流程。",
            sort_order=-1,
            enabled=True,
            rest_break_enabled=True,
            rest_break_seconds=3,
        )
        db.add(flow)
        added += 1
    else:
        flow.name = "实验操作练习"
        flow.description = "熟悉个人信息确认、倒计时、作答、F9/F10 与题间休息等完整流程。"
        flow.sort_order = -1
        flow.enabled = True
        flow.rest_break_enabled = True
        flow.rest_break_seconds = 3

    for item in GUIDE_QUESTIONS:
        row = (
            db.query(ExperimentQuestion)
            .filter(ExperimentQuestion.flow_id == GUIDE_FLOW_ID, ExperimentQuestion.id == item["id"])
            .first()
        )
        if not row:
            db.add(
                ExperimentQuestion(
                    flow_id=GUIDE_FLOW_ID,
                    id=item["id"],
                    title=item["title"],
                    content=item["content"],
                    sort_order=item["sort_order"],
                    enabled=True,
                )
            )
            added += 1
        else:
            row.title = item["title"]
            row.content = item["content"]
            row.sort_order = item["sort_order"]
            row.enabled = True

    db.commit()
    return added


def seed_experiment_flows_and_questions(db: Session) -> int:
    """初始化默认实验流与题目。"""
    if db.query(ExperimentFlow).count() > 0:
        return 0

    flow = ExperimentFlow(
        id=DEFAULT_FLOW_ID,
        name="默认认知实验流",
        description="系统内置示例实验流，包含 3 道数学应用题。",
        sort_order=0,
        enabled=True,
    )
    db.add(flow)
    added = 1

    for item in DEFAULT_QUESTIONS:
        db.add(
            ExperimentQuestion(
                flow_id=DEFAULT_FLOW_ID,
                id=item["id"],
                title=item["title"],
                content=item["content"],
                sort_order=item["sort_order"],
                enabled=True,
            )
        )
        added += 1

    db.commit()
    return added


def _ts_to_datetime(ts: Optional[int]) -> Optional[datetime]:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).replace(tzinfo=None)


def _flow_item(db: Session, row: ExperimentFlow) -> ExperimentFlowItem:
    return ExperimentFlowItem(
        id=row.id,
        name=row.name,
        description=row.description,
        question_count=_count_questions(db, row.id),
        rest_break_enabled=bool(getattr(row, "rest_break_enabled", True)),
        rest_break_seconds=int(getattr(row, "rest_break_seconds", 5) or 5),
        rest_break_every=max(1, int(getattr(row, "rest_break_every", 1) or 1)),
    )


@router.get("/flows", response_model=ExperimentFlowListResponse)
def list_enabled_flows(db: Session = Depends(get_db)):
    """获取已启用的实验流列表。"""
    rows = (
        db.query(ExperimentFlow)
        .filter(ExperimentFlow.enabled.is_(True))
        .order_by(ExperimentFlow.sort_order, ExperimentFlow.id)
        .all()
    )
    data = [
        _flow_item(db, r)
        for r in rows
        if _count_questions(db, r.id) > 0
    ]
    return ExperimentFlowListResponse(data=data)


@router.get("/flows/{flow_id}", response_model=ExperimentFlowDetailResponse)
def get_flow(flow_id: str, db: Session = Depends(get_db)):
    """获取实验流详情（含题间休息配置）。"""
    row = db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id, ExperimentFlow.enabled.is_(True)).first()
    if not row:
        return ExperimentFlowDetailResponse(errCode=404, errMsg="实验流不存在或未启用", data=None)
    return ExperimentFlowDetailResponse(data=_flow_item(db, row))


@router.get("/flows/{flow_id}/questions", response_model=ExperimentQuestionListResponse)
def list_flow_questions(flow_id: str, db: Session = Depends(get_db)):
    """获取指定实验流下已启用的题目。"""
    flow = db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id, ExperimentFlow.enabled.is_(True)).first()
    if not flow:
        return ExperimentQuestionListResponse(errCode=404, errMsg="实验流不存在或未启用", data=[])

    rows = (
        db.query(ExperimentQuestion)
        .filter(ExperimentQuestion.flow_id == flow_id, ExperimentQuestion.enabled.is_(True))
        .order_by(ExperimentQuestion.sort_order, ExperimentQuestion.id)
        .all()
    )
    data = [
        ExperimentQuestionItem(
            id=r.id,
            title=r.title,
            content=r.content,
            mwp_id=getattr(r, "mwp_id", None),
            level5=getattr(r, "level5", None),
        )
        for r in rows
    ]
    return ExperimentQuestionListResponse(data=data)


@router.post("/sessions", response_model=ExperimentSessionSubmitResponse)
def submit_session(
    req: ExperimentSessionSubmitRequest,
    db: Session = Depends(get_db),
    current_user_id: Optional[str] = Depends(get_current_user_optional),
):
    """提交实验会话数据（结束实验时调用）。"""
    if db.query(ExperimentSession).filter(ExperimentSession.id == req.sessionId).first():
        return ExperimentSessionSubmitResponse(errCode=400, errMsg="会话已存在", data={})

    flow = db.query(ExperimentFlow).filter(ExperimentFlow.id == req.flowId).first()
    if not flow:
        return ExperimentSessionSubmitResponse(errCode=404, errMsg="实验流不存在", data={})

    payload = req.model_dump()
    row = ExperimentSession(
        id=req.sessionId,
        flow_id=req.flowId,
        status=req.status,
        started_at=_ts_to_datetime(req.startedAt),
        ended_at=_ts_to_datetime(req.endedAt),
        user_id=current_user_id,
        payload=json.dumps(payload, ensure_ascii=False),
    )
    try:
        db.add(row)
        db.commit()
        return ExperimentSessionSubmitResponse(errCode=0, errMsg="success", data={"id": req.sessionId})
    except Exception as e:
        db.rollback()
        return ExperimentSessionSubmitResponse(errCode=500, errMsg=f"保存失败: {str(e)}", data={})


def _get_experiment_snapshot_upload_dir(flow_id: str, session_id: str) -> Path:
    base = Path(__file__).resolve().parent.parent
    d = base / settings.UPLOAD_DIR / "experiment-snapshots" / flow_id / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/snapshots", response_model=ExperimentSessionSubmitResponse)
def upload_question_snapshot(
    session_id: str = Form(...),
    flow_id: str = Form(...),
    question_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传单题屏幕快照（结束该题前调用）。"""
    _ = db
    if not session_id.strip() or not flow_id.strip() or not question_id.strip():
        return ExperimentSessionSubmitResponse(errCode=400, errMsg="参数不完整", data={})
    if not file.filename:
        return ExperimentSessionSubmitResponse(errCode=400, errMsg="请选择文件", data={})
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.AVATAR_ALLOWED_EXTENSIONS:
        return ExperimentSessionSubmitResponse(
            errCode=400,
            errMsg=f"仅支持图片格式：{', '.join(settings.AVATAR_ALLOWED_EXTENSIONS)}",
            data={},
        )
    content = file.file.read()
    if len(content) > settings.AVATAR_MAX_BYTES * 2:
        return ExperimentSessionSubmitResponse(
            errCode=400,
            errMsg=f"图片大小不能超过 {settings.AVATAR_MAX_BYTES * 2 // (1024 * 1024)}MB",
            data={},
        )
    upload_dir = _get_experiment_snapshot_upload_dir(flow_id.strip(), session_id.strip())
    safe_qid = "".join(c if c.isalnum() or c in "-_" else "_" for c in question_id.strip())
    name = f"{safe_qid}_{uuid.uuid4().hex[:8]}{ext}"
    path = upload_dir / name
    try:
        with open(path, "wb") as f:
            f.write(content)
    except Exception as e:
        return ExperimentSessionSubmitResponse(errCode=500, errMsg=f"保存失败: {e}", data={})
    url_path = f"/api/{settings.UPLOAD_DIR}/experiment-snapshots/{flow_id.strip()}/{session_id.strip()}/{name}"
    return ExperimentSessionSubmitResponse(errCode=0, errMsg="success", data={"url": url_path})
