"""
管理员端：用户管理、认知实验管理。
认证方式：请求头 X-Admin-Token 或 Authorization: Bearer <ADMIN_SECRET>，与 config.ADMIN_SECRET 一致即通过。
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Header, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional
from pathlib import Path
import uuid

from config import settings
from database import get_db
from models.user import User
from models.experiment_flow import ExperimentFlow
from models.experiment_question import ExperimentQuestion
from models.experiment_session import ExperimentSession
from user_profile import user_profile_fields_dict, apply_profile_update, user_keyword_filter, name_taken, user_display_name
from schemas.admin import (
    AdminUserItem,
    AdminUserListResponse,
    AdminUserDetailResponse,
    AdminUserUpdateRequest,
    AdminUserCreateRequest,
    AdminUserPasswordUpdateRequest,
    AdminCommonResponse,
    AdminExperimentFlowItem,
    AdminExperimentFlowListResponse,
    AdminExperimentFlowUpsertResponse,
    AdminExperimentFlowCreateRequest,
    AdminExperimentFlowUpdateRequest,
    AdminExperimentQuestionItem,
    AdminExperimentQuestionListResponse,
    AdminExperimentQuestionUpsertResponse,
    AdminExperimentQuestionCreateRequest,
    AdminExperimentQuestionUpdateRequest,
    AdminExperimentSessionItem,
    AdminExperimentSessionListResponse,
    AdminExperimentSessionDetailItem,
    AdminExperimentSessionDetailResponse,
)
from .auth import hash_password

router = APIRouter(prefix="/admin", tags=["管理员"])


def get_admin_token(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    authorization: Optional[str] = Header(None),
) -> str:
    """从请求头获取管理员 token，校验通过返回 token。"""
    token = x_admin_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if not token or token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="管理员认证失败")
    return token


@router.get("/users", response_model=AdminUserListResponse)
def admin_list_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """用户列表（分页）。"""
    query = db.query(User)
    if keyword and keyword.strip():
        query = query.filter(user_keyword_filter(keyword))
    total = query.count()
    offset = (page - 1) * pageSize
    users = query.order_by(User.created_at.desc()).offset(offset).limit(pageSize).all()
    data = [
        AdminUserItem(
            id=u.id,
            username=u.username,
            nickname=u.nickname,
            avatar_url=u.avatar_url,
            created_at=u.created_at.isoformat() if u.created_at else None,
            real_name=user_display_name(u),
            age=u.age,
            gender=u.gender,
            contact=u.contact,
            college=u.college,
            major=u.major,
            student_id=u.student_id,
        )
        for u in users
    ]
    return AdminUserListResponse(data=data, total=total)


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def admin_get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """用户详情。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return AdminUserDetailResponse(errCode=404, errMsg="用户不存在", data=None)
    return AdminUserDetailResponse(
        errCode=0,
        errMsg="success",
        data=AdminUserItem(
            id=user.id,
            username=user.username,
            nickname=user.nickname,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat() if user.created_at else None,
            real_name=user_display_name(user),
            age=user.age,
            gender=user.gender,
            contact=user.contact,
            college=user.college,
            major=user.major,
            student_id=user.student_id,
        ),
    )


@router.patch("/users/{user_id}", response_model=AdminCommonResponse)
def admin_update_user(
    user_id: str,
    req: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """更新用户资料。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return AdminCommonResponse(errCode=404, errMsg="用户不存在", data={})
    err = apply_profile_update(user, req, db)
    if err:
        return AdminCommonResponse(errCode=400, errMsg=err, data={})
    try:
        db.commit()
        db.refresh(user)
        return AdminCommonResponse(errCode=0, errMsg="success", data={"id": user.id})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"更新失败: {str(e)}", data={})


@router.delete("/users/{user_id}", response_model=AdminCommonResponse)
def admin_delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """删除用户。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return AdminCommonResponse(errCode=404, errMsg="用户不存在", data={})
    try:
        db.delete(user)
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"删除失败: {str(e)}", data={})


@router.post("/users", response_model=AdminCommonResponse)
def admin_create_user(
    req: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """管理员创建用户（姓名 + 密码，与注册接口字段一致）。"""
    name = (req.real_name or req.username).strip()
    if not name:
        return AdminCommonResponse(errCode=400, errMsg="请输入姓名", data={})
    if name_taken(db, name):
        return AdminCommonResponse(errCode=400, errMsg="该姓名已被使用", data={})
    user = User(
        username=name,
        password_hash=hash_password(req.password),
        real_name=name,
        age=req.age,
        gender=req.gender.strip() if req.gender else None,
        contact=req.contact.strip() if req.contact else None,
        college=req.college.strip() if req.college else None,
        major=req.major.strip() if req.major else None,
        student_id=req.student_id.strip() if req.student_id else None,
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return AdminCommonResponse(errCode=0, errMsg="success", data={"id": user.id})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"创建失败: {str(e)}", data={})


@router.patch("/users/{user_id}/password", response_model=AdminCommonResponse)
def admin_update_user_password(
    user_id: str,
    req: AdminUserPasswordUpdateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """管理员重置用户密码。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return AdminCommonResponse(errCode=404, errMsg="用户不存在", data={})
    user.password_hash = hash_password(req.password)
    try:
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={"id": user.id})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"重置密码失败: {str(e)}", data={})


def _get_avatar_upload_dir() -> Path:
    """头像保存目录（backend/uploads/avatars），与用户端保持一致。"""
    base = Path(__file__).resolve().parent.parent
    d = base / settings.UPLOAD_DIR / "avatars"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/users/{user_id}/avatar", response_model=AdminCommonResponse)
def admin_upload_user_avatar(
    user_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    """
    管理员上传并更新指定用户头像。

    前端需使用 multipart/form-data 上传文件，成功后返回可访问的 URL（相对路径）。
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return AdminCommonResponse(errCode=404, errMsg="用户不存在", data={})
    if not file.filename:
        return AdminCommonResponse(errCode=400, errMsg="请选择文件", data={})
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.AVATAR_ALLOWED_EXTENSIONS:
        return AdminCommonResponse(
            errCode=400,
            errMsg=f"仅支持图片格式：{', '.join(settings.AVATAR_ALLOWED_EXTENSIONS)}",
            data={},
        )
    content = file.file.read()
    if len(content) > settings.AVATAR_MAX_BYTES:
        return AdminCommonResponse(
            errCode=400,
            errMsg=f"图片大小不能超过 {settings.AVATAR_MAX_BYTES // (1024*1024)}MB",
            data={},
        )
    file.file.seek(0)
    upload_dir = _get_avatar_upload_dir()
    name = f"{user_id}_{uuid.uuid4().hex[:12]}{ext}"
    path = upload_dir / name
    try:
        with open(path, "wb") as f:
            f.write(content)
    except Exception as e:
        return AdminCommonResponse(errCode=500, errMsg=f"保存失败: {e}", data={})
    url_path = f"/api/{settings.UPLOAD_DIR}/avatars/{name}"
    user.avatar_url = url_path
    try:
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={"id": user.id, "url": url_path})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"更新头像失败: {e}", data={})


def _get_experiment_question_upload_dir() -> Path:
    base = Path(__file__).resolve().parent.parent
    d = base / settings.UPLOAD_DIR / "experiment-questions"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/experiment-questions/upload-image", response_model=AdminCommonResponse)
def admin_upload_experiment_question_image(
    file: UploadFile = File(...),
    _: str = Depends(get_admin_token),
):
    """上传认知实验题目图片，返回可访问 URL。"""
    if not file.filename:
        return AdminCommonResponse(errCode=400, errMsg="请选择文件", data={})
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.AVATAR_ALLOWED_EXTENSIONS:
        return AdminCommonResponse(
            errCode=400,
            errMsg=f"仅支持图片格式：{', '.join(settings.AVATAR_ALLOWED_EXTENSIONS)}",
            data={},
        )
    content = file.file.read()
    if len(content) > settings.AVATAR_MAX_BYTES:
        return AdminCommonResponse(
            errCode=400,
            errMsg=f"图片大小不能超过 {settings.AVATAR_MAX_BYTES // (1024 * 1024)}MB",
            data={},
        )
    upload_dir = _get_experiment_question_upload_dir()
    name = f"{uuid.uuid4().hex}{ext}"
    path = upload_dir / name
    try:
        with open(path, "wb") as f:
            f.write(content)
    except Exception as e:
        return AdminCommonResponse(errCode=500, errMsg=f"保存失败: {e}", data={})
    url_path = f"/api/{settings.UPLOAD_DIR}/experiment-questions/{name}"
    return AdminCommonResponse(errCode=0, errMsg="success", data={"url": url_path})


def _flow_question_count(db: Session, flow_id: str) -> int:
    return db.query(func.count(ExperimentQuestion.id)).filter(ExperimentQuestion.flow_id == flow_id).scalar() or 0


def _experiment_session_counts(payload_raw: str) -> tuple[int, int]:
    try:
        payload = json.loads(payload_raw)
        questions = payload.get("questions") or []
        event_count = sum(len(q.get("events") or []) for q in questions)
        return len(questions), event_count
    except (json.JSONDecodeError, TypeError):
        return 0, 0


def _flow_id_from_payload(payload_raw: str | None) -> str | None:
    if not payload_raw:
        return None
    try:
        data = json.loads(payload_raw)
    except (TypeError, json.JSONDecodeError):
        return None
    fid = data.get("flowId") or data.get("flow_id")
    if fid is None:
        return None
    text_id = str(fid).strip()
    return text_id or None


def _session_flow_id(row: ExperimentSession) -> str | None:
    if row.flow_id and str(row.flow_id).strip():
        return str(row.flow_id).strip()
    return _flow_id_from_payload(row.payload)


def _session_flow_labels(db: Session, row: ExperimentSession) -> tuple[str | None, str | None]:
    fid = _session_flow_id(row)
    if not fid:
        return None, None
    flow = db.query(ExperimentFlow).filter(ExperimentFlow.id == fid).first()
    if flow:
        return fid, flow.name
    return fid, f"{fid}（已删除）"


def _flow_item(db: Session, row: ExperimentFlow, session_count: int = 0) -> AdminExperimentFlowItem:
    return AdminExperimentFlowItem(
        id=row.id,
        name=row.name,
        description=row.description,
        sort_order=row.sort_order,
        enabled=bool(row.enabled),
        rest_break_enabled=bool(getattr(row, "rest_break_enabled", True)),
        rest_break_seconds=int(getattr(row, "rest_break_seconds", 5) or 5),
        rest_break_every=max(1, int(getattr(row, "rest_break_every", 1) or 1)),
        question_count=_flow_question_count(db, row.id),
        session_count=session_count,
        archived=False,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


def _archived_flow_ids_from_sessions(db: Session, existing_ids: set[str]) -> dict[str, int]:
    """已删除实验流仍留在会话里的 ID 及其记录数。"""
    counts: dict[str, int] = {}
    rows = db.query(ExperimentSession.flow_id, ExperimentSession.payload).all()
    for flow_id, payload in rows:
        fid = str(flow_id).strip() if flow_id and str(flow_id).strip() else _flow_id_from_payload(payload)
        if not fid or fid in existing_ids:
            continue
        counts[fid] = counts.get(fid, 0) + 1
    return counts


def _question_item(row: ExperimentQuestion) -> AdminExperimentQuestionItem:
    return AdminExperimentQuestionItem(
        flow_id=row.flow_id,
        id=row.id,
        title=row.title,
        content=row.content,
        sort_order=row.sort_order,
        enabled=bool(row.enabled),
        mwp_id=getattr(row, "mwp_id", None),
        level5=getattr(row, "level5", None),
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.get("/experiment-flows", response_model=AdminExperimentFlowListResponse)
def admin_list_experiment_flows(
    include_archived: bool = Query(False, description="包含已删除但仍有作答记录的实验流"),
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    rows = db.query(ExperimentFlow).order_by(ExperimentFlow.sort_order, ExperimentFlow.id).all()
    session_counts = {
        fid: count
        for fid, count in db.query(ExperimentSession.flow_id, func.count(ExperimentSession.id))
        .filter(ExperimentSession.flow_id.isnot(None), ExperimentSession.flow_id != "")
        .group_by(ExperimentSession.flow_id)
        .all()
    }
    data = [_flow_item(db, r, int(session_counts.get(r.id, 0) or 0)) for r in rows]
    if include_archived:
        archived = _archived_flow_ids_from_sessions(db, {r.id for r in rows})
        for fid in sorted(archived):
            data.append(
                AdminExperimentFlowItem(
                    id=fid,
                    name=f"{fid}（已删除）",
                    description="实验流已删除，以下为保留的作答记录",
                    enabled=False,
                    question_count=0,
                    session_count=archived[fid],
                    archived=True,
                )
            )
    return AdminExperimentFlowListResponse(data=data)


@router.post("/experiment-flows", response_model=AdminExperimentFlowUpsertResponse)
def admin_create_experiment_flow(
    req: AdminExperimentFlowCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    fid = req.id.strip()
    if db.query(ExperimentFlow).filter(ExperimentFlow.id == fid).first():
        return AdminExperimentFlowUpsertResponse(errCode=400, errMsg="实验流 ID 已存在", data=None)
    row = ExperimentFlow(
        id=fid,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        sort_order=req.sort_order,
        enabled=req.enabled,
        rest_break_enabled=req.rest_break_enabled,
        rest_break_seconds=req.rest_break_seconds,
        rest_break_every=req.rest_break_every,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return AdminExperimentFlowUpsertResponse(errCode=0, errMsg="success", data=_flow_item(db, row))
    except Exception as e:
        db.rollback()
        return AdminExperimentFlowUpsertResponse(errCode=500, errMsg=f"新增失败: {str(e)}", data=None)


@router.patch("/experiment-flows/{flow_id}", response_model=AdminExperimentFlowUpsertResponse)
def admin_update_experiment_flow(
    flow_id: str,
    req: AdminExperimentFlowUpdateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    row = db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id).first()
    if not row:
        return AdminExperimentFlowUpsertResponse(errCode=404, errMsg="实验流不存在", data=None)
    if req.name is not None:
        row.name = req.name.strip()
    if req.description is not None:
        row.description = req.description.strip() or None
    if req.sort_order is not None:
        row.sort_order = req.sort_order
    if req.enabled is not None:
        row.enabled = req.enabled
    if req.rest_break_enabled is not None:
        row.rest_break_enabled = req.rest_break_enabled
    if req.rest_break_seconds is not None:
        row.rest_break_seconds = req.rest_break_seconds
    if req.rest_break_every is not None:
        row.rest_break_every = req.rest_break_every
    try:
        db.commit()
        db.refresh(row)
        return AdminExperimentFlowUpsertResponse(errCode=0, errMsg="success", data=_flow_item(db, row))
    except Exception as e:
        db.rollback()
        return AdminExperimentFlowUpsertResponse(errCode=500, errMsg=f"更新失败: {str(e)}", data=None)


@router.delete("/experiment-flows/{flow_id}", response_model=AdminCommonResponse)
def admin_delete_experiment_flow(flow_id: str, db: Session = Depends(get_db), _: str = Depends(get_admin_token)):
    row = db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id).first()
    if not row:
        return AdminCommonResponse(errCode=404, errMsg="实验流不存在", data={})
    try:
        db.delete(row)
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"删除失败: {str(e)}", data={})


@router.get("/experiment-flows/{flow_id}/questions", response_model=AdminExperimentQuestionListResponse)
def admin_list_flow_questions(flow_id: str, db: Session = Depends(get_db), _: str = Depends(get_admin_token)):
    if not db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id).first():
        return AdminExperimentQuestionListResponse(errCode=404, errMsg="实验流不存在", data=[])
    rows = (
        db.query(ExperimentQuestion)
        .filter(ExperimentQuestion.flow_id == flow_id)
        .order_by(ExperimentQuestion.sort_order, ExperimentQuestion.id)
        .all()
    )
    return AdminExperimentQuestionListResponse(data=[_question_item(r) for r in rows])


@router.post("/experiment-flows/{flow_id}/questions", response_model=AdminExperimentQuestionUpsertResponse)
def admin_create_flow_question(
    flow_id: str,
    req: AdminExperimentQuestionCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    if not db.query(ExperimentFlow).filter(ExperimentFlow.id == flow_id).first():
        return AdminExperimentQuestionUpsertResponse(errCode=404, errMsg="实验流不存在", data=None)
    qid = req.id.strip()
    if db.query(ExperimentQuestion).filter(ExperimentQuestion.flow_id == flow_id, ExperimentQuestion.id == qid).first():
        return AdminExperimentQuestionUpsertResponse(errCode=400, errMsg="该实验流下题目 ID 已存在", data=None)
    row = ExperimentQuestion(
        flow_id=flow_id,
        id=qid,
        title=req.title.strip() if req.title else None,
        content=req.content.strip(),
        sort_order=req.sort_order,
        enabled=req.enabled,
        mwp_id=req.mwp_id,
        level5=req.level5.strip() if req.level5 else None,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return AdminExperimentQuestionUpsertResponse(errCode=0, errMsg="success", data=_question_item(row))
    except Exception as e:
        db.rollback()
        return AdminExperimentQuestionUpsertResponse(errCode=500, errMsg=f"新增失败: {str(e)}", data=None)


@router.patch("/experiment-flows/{flow_id}/questions/{question_id}", response_model=AdminExperimentQuestionUpsertResponse)
def admin_update_flow_question(
    flow_id: str,
    question_id: str,
    req: AdminExperimentQuestionUpdateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    row = db.query(ExperimentQuestion).filter(ExperimentQuestion.flow_id == flow_id, ExperimentQuestion.id == question_id).first()
    if not row:
        return AdminExperimentQuestionUpsertResponse(errCode=404, errMsg="题目不存在", data=None)
    if req.title is not None:
        row.title = req.title.strip() or None
    if req.content is not None:
        row.content = req.content.strip()
    if req.sort_order is not None:
        row.sort_order = req.sort_order
    if req.enabled is not None:
        row.enabled = req.enabled
    if req.mwp_id is not None:
        row.mwp_id = req.mwp_id
    if req.level5 is not None:
        row.level5 = req.level5.strip() or None
    try:
        db.commit()
        db.refresh(row)
        return AdminExperimentQuestionUpsertResponse(errCode=0, errMsg="success", data=_question_item(row))
    except Exception as e:
        db.rollback()
        return AdminExperimentQuestionUpsertResponse(errCode=500, errMsg=f"更新失败: {str(e)}", data=None)


@router.delete("/experiment-flows/{flow_id}/questions/{question_id}", response_model=AdminCommonResponse)
def admin_delete_flow_question(
    flow_id: str,
    question_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    row = db.query(ExperimentQuestion).filter(ExperimentQuestion.flow_id == flow_id, ExperimentQuestion.id == question_id).first()
    if not row:
        return AdminCommonResponse(errCode=404, errMsg="题目不存在", data={})
    try:
        db.delete(row)
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"删除失败: {str(e)}", data={})


@router.get("/experiment-sessions", response_model=AdminExperimentSessionListResponse)
def admin_list_experiment_sessions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    keyword: Optional[str] = Query(None, description="按会话ID或用户名搜索"),
    flow_id: Optional[str] = Query(None, description="按实验流过滤"),
    db: Session = Depends(get_db),
    _: str = Depends(get_admin_token),
):
    query = db.query(ExperimentSession).join(User, ExperimentSession.user_id == User.id, isouter=True)
    flow_key = flow_id.strip() if flow_id and flow_id.strip() else ""
    if flow_key:
        query = query.filter(
            or_(
                ExperimentSession.flow_id == flow_key,
                and_(
                    or_(ExperimentSession.flow_id.is_(None), ExperimentSession.flow_id == ""),
                    or_(
                        ExperimentSession.payload.like(f'%"flowId": "{flow_key}"%'),
                        ExperimentSession.payload.like(f'%"flowId":"{flow_key}"%'),
                        ExperimentSession.payload.like(f'%"flow_id": "{flow_key}"%'),
                        ExperimentSession.payload.like(f'%"flow_id":"{flow_key}"%'),
                    ),
                ),
            )
        )
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                ExperimentSession.id.like(kw),
                user_keyword_filter(keyword),
            )
        )
    total = query.count()
    offset = (page - 1) * pageSize
    rows = query.order_by(ExperimentSession.created_at.desc()).offset(offset).limit(pageSize).all()
    data = []
    for row in rows:
        user = db.query(User).filter(User.id == row.user_id).first() if row.user_id else None
        fid, flow_name = _session_flow_labels(db, row)
        q_count, e_count = _experiment_session_counts(row.payload)
        data.append(
            AdminExperimentSessionItem(
                id=row.id,
                flow_id=fid,
                flow_name=flow_name,
                status=row.status,
                started_at=row.started_at.isoformat() if row.started_at else None,
                ended_at=row.ended_at.isoformat() if row.ended_at else None,
                user_id=row.user_id,
                username=user.username if user else None,
                nickname=user.nickname if user else None,
                **user_profile_fields_dict(user),
                question_count=q_count,
                event_count=e_count,
                created_at=row.created_at.isoformat() if row.created_at else None,
            )
        )
    return AdminExperimentSessionListResponse(data=data, total=total)


@router.get("/experiment-sessions/{session_id}", response_model=AdminExperimentSessionDetailResponse)
def admin_get_experiment_session(session_id: str, db: Session = Depends(get_db), _: str = Depends(get_admin_token)):
    row = db.query(ExperimentSession).filter(ExperimentSession.id == session_id).first()
    if not row:
        return AdminExperimentSessionDetailResponse(errCode=404, errMsg="会话不存在", data=None)
    user = db.query(User).filter(User.id == row.user_id).first() if row.user_id else None
    fid, flow_name = _session_flow_labels(db, row)
    try:
        payload = json.loads(row.payload)
    except json.JSONDecodeError:
        payload = {}
    q_count, e_count = _experiment_session_counts(row.payload)
    return AdminExperimentSessionDetailResponse(
        errCode=0,
        errMsg="success",
        data=AdminExperimentSessionDetailItem(
            id=row.id,
            flow_id=fid,
            flow_name=flow_name,
            status=row.status,
            started_at=row.started_at.isoformat() if row.started_at else None,
            ended_at=row.ended_at.isoformat() if row.ended_at else None,
            user_id=row.user_id,
            username=user.username if user else None,
            nickname=user.nickname if user else None,
            **user_profile_fields_dict(user),
            question_count=q_count,
            event_count=e_count,
            created_at=row.created_at.isoformat() if row.created_at else None,
            payload=payload,
        ),
    )


@router.delete("/experiment-sessions/{session_id}", response_model=AdminCommonResponse)
def admin_delete_experiment_session(session_id: str, db: Session = Depends(get_db), _: str = Depends(get_admin_token)):
    row = db.query(ExperimentSession).filter(ExperimentSession.id == session_id).first()
    if not row:
        return AdminCommonResponse(errCode=404, errMsg="会话不存在", data={})
    try:
        db.delete(row)
        db.commit()
        return AdminCommonResponse(errCode=0, errMsg="success", data={})
    except Exception as e:
        db.rollback()
        return AdminCommonResponse(errCode=500, errMsg=f"删除失败: {str(e)}", data={})
