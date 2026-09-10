"""数学应用题题库 API：列表 / 详情 / 统计 / 按难度随机抽题。"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.mwp import MWP
from schemas.mwp import (
    MWPDetailItem,
    MWPDetailResponse,
    MWPListData,
    MWPListItem,
    MWPListResponse,
    MWPRandomResponse,
    MWPStatsData,
    MWPStatsResponse,
)

router = APIRouter(prefix="/mwps", tags=["题库 MWPs"])


@router.get("", response_model=MWPListResponse)
def list_mwps(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    level5: Optional[str] = Query(None, description="五档难度：易/较易/中等/较难/难"),
    q: Optional[str] = Query(None, description="题目原文关键词"),
    answer_quality: Optional[str] = Query(None, description="exact / format_diff"),
    order_by: str = Query("rank", description="排序字段：rank / composite_score / id"),
    order: str = Query("asc", description="asc / desc"),
    db: Session = Depends(get_db),
):
    query = db.query(MWP)
    if level5:
        query = query.filter(MWP.level5 == level5)
    if answer_quality:
        query = query.filter(MWP.answer_quality == answer_quality)
    if q:
        query = query.filter(MWP.raw_text.contains(q))

    total = query.count()

    sort_col = {
        "rank": MWP.rank,
        "composite_score": MWP.composite_score,
        "id": MWP.id,
    }.get(order_by, MWP.rank)
    query = query.order_by(sort_col.desc() if order.lower() == "desc" else sort_col.asc())

    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [MWPListItem(**r.to_list_dict()) for r in rows]
    return MWPListResponse(
        data=MWPListData(total=total, page=page, page_size=page_size, items=items)
    )


@router.get("/stats", response_model=MWPStatsResponse)
def mwp_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(MWP.id)).scalar() or 0
    rows = (
        db.query(MWP.level5, func.count(MWP.id))
        .group_by(MWP.level5)
        .all()
    )
    by_level5 = {level or "unknown": cnt for level, cnt in rows}
    return MWPStatsResponse(data=MWPStatsData(total=int(total), by_level5=by_level5))


@router.get("/random", response_model=MWPRandomResponse)
def random_mwps(
    n: int = Query(1, ge=1, le=50, description="抽取数量"),
    level5: Optional[str] = Query(None, description="按难度筛选"),
    db: Session = Depends(get_db),
):
    query = db.query(MWP)
    if level5:
        query = query.filter(MWP.level5 == level5)
    rows = query.order_by(func.rand()).limit(n).all()
    return MWPRandomResponse(data=[MWPListItem(**r.to_list_dict()) for r in rows])


@router.get("/{mwp_id}", response_model=MWPDetailResponse)
def get_mwp(
    mwp_id: int,
    include_process: bool = Query(True, description="是否返回解题过程"),
    db: Session = Depends(get_db),
):
    row = db.query(MWP).filter(MWP.id == mwp_id).first()
    if not row:
        return MWPDetailResponse(errCode=404, errMsg=f"题目 {mwp_id} 不存在", data=None)
    return MWPDetailResponse(
        data=MWPDetailItem(**row.to_detail_dict(include_process=include_process))
    )
