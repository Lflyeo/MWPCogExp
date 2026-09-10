from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExperimentFlowItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    question_count: int = 0
    rest_break_enabled: bool = True
    rest_break_seconds: int = 5
    rest_break_every: int = 1


class ExperimentFlowDetailResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[ExperimentFlowItem] = None


class ExperimentFlowListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[ExperimentFlowItem] = []


class ExperimentQuestionItem(BaseModel):
    id: str
    title: Optional[str] = None
    content: str
    mwp_id: Optional[int] = None
    level5: Optional[str] = None


class ExperimentQuestionListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[ExperimentQuestionItem] = []


class ExperimentSessionSubmitRequest(BaseModel):
    sessionId: str = Field(..., max_length=64)
    flowId: str = Field(..., max_length=64)
    startedAt: Optional[int] = None
    endedAt: Optional[int] = None
    status: str = Field(default="ended", max_length=20)
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    strokes: Dict[str, Any] = Field(default_factory=dict)


class ExperimentSessionSubmitResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: dict = Field(default_factory=dict)
