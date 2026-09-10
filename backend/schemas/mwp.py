from typing import List, Optional
from pydantic import BaseModel, Field


class MWPListItem(BaseModel):
    id: int
    raw_text: str
    answer_e: Optional[str] = None
    answer_ans: Optional[str] = None
    answer_quality: Optional[str] = None
    score_l: Optional[float] = None
    score_m: Optional[float] = None
    score_w: Optional[float] = None
    composite_score: Optional[float] = None
    rank: Optional[int] = None
    level5: Optional[str] = None
    composite_score_critic: Optional[float] = None
    composite_score_flat_entropy: Optional[float] = None


class MWPDetailItem(MWPListItem):
    api_response_result: Optional[str] = None
    api_response_process: Optional[str] = None
    original_text: Optional[str] = None
    pos: Optional[str] = None
    patched_by: Optional[str] = None
    patched_at: Optional[str] = None


class MWPListData(BaseModel):
    total: int = 0
    page: int = 1
    page_size: int = 20
    items: List[MWPListItem] = Field(default_factory=list)


class MWPListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: MWPListData = Field(default_factory=MWPListData)


class MWPDetailResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[MWPDetailItem] = None


class MWPStatsData(BaseModel):
    total: int = 0
    by_level5: dict = Field(default_factory=dict)


class MWPStatsResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: MWPStatsData = Field(default_factory=MWPStatsData)


class MWPRandomResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[MWPListItem] = Field(default_factory=list)
