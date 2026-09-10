from typing import List, Optional
from pydantic import BaseModel, Field

from schemas.auth import UserProfileFields


class AdminUserItem(UserProfileFields):
    id: str
    username: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class AdminUserListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminUserItem] = []
    total: int = 0


class AdminUserDetailResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminUserItem] = None


class AdminCommonResponse(BaseModel):
    """通用返回：仅包含 errCode/errMsg 与字典 data（如 {'id': xxx} 或空对象）。"""

    errCode: int = 0
    errMsg: str = "success"
    data: dict = Field(default_factory=dict)


class AdminUserUpdateRequest(BaseModel):
    avatar_url: Optional[str] = Field(None, max_length=512)
    real_name: Optional[str] = Field(None, max_length=64)
    age: Optional[int] = Field(None, ge=1, le=150)
    gender: Optional[str] = Field(None, max_length=16)
    contact: Optional[str] = Field(None, max_length=128)
    college: Optional[str] = Field(None, max_length=128)
    major: Optional[str] = Field(None, max_length=128)
    student_id: Optional[str] = Field(None, max_length=64)


class AdminUserCreateRequest(BaseModel):
    """管理员创建用户，请求体与普通注册保持一致（用户名 + 密码）。"""

    username: str = Field(..., min_length=2, max_length=64, description="姓名")
    password: str = Field(..., min_length=6, max_length=64, description="密码")
    real_name: Optional[str] = Field(None, max_length=64)
    age: Optional[int] = Field(None, ge=1, le=150)
    gender: Optional[str] = Field(None, max_length=16)
    contact: Optional[str] = Field(None, max_length=128)
    college: Optional[str] = Field(None, max_length=128)
    major: Optional[str] = Field(None, max_length=128)
    student_id: Optional[str] = Field(None, max_length=64)


class AdminUserPasswordUpdateRequest(BaseModel):
    """管理员重置用户密码。"""

    password: str = Field(..., min_length=6, max_length=64, description="新密码")


class AdminUniapiConfig(BaseModel):
    """解题 / 知识点 / 语义 三套接口配置（可在管理后台分别调整）。"""

    # 解题模型 API（主配置）
    base_url: str = Field(..., max_length=512, description="解题模型 UniAPI 基础地址")
    token: str = Field(..., max_length=512, description="解题模型 UniAPI Token")
    model: Optional[str] = Field(
        default=None,
        max_length=128,
        description="默认解题模型 ID（UNIAPI_MODEL），为空时使用后端默认值",
    )
    # 知识点识别模型 API（独立配置，为空则调用时回退到解题的 base_url/token）
    base_url_knowledge: Optional[str] = Field(
        default=None,
        max_length=512,
        description="知识点识别模型 API 基础地址，为空则使用解题配置",
    )
    token_knowledge: Optional[str] = Field(
        default=None,
        max_length=512,
        description="知识点识别模型 API Token，为空则使用解题配置",
    )
    model_knowledge: Optional[str] = Field(
        default=None,
        max_length=128,
        description="知识点识别模型 ID（UNIAPI_MODEL_KNOWLEDGE），为空时与解题模型一致",
    )
    # 语义情境识别模型 API（独立配置，为空则回退到解题的 base_url/token）
    base_url_semantic: Optional[str] = Field(
        default=None,
        max_length=512,
        description="语义情境模型 API 基础地址，为空则使用解题配置",
    )
    token_semantic: Optional[str] = Field(
        default=None,
        max_length=512,
        description="语义情境模型 API Token，为空则使用解题配置",
    )
    model_semantic: Optional[str] = Field(
        default=None,
        max_length=128,
        description="语义情境识别模型 ID（UNIAPI_MODEL_SEMANTIC），为空时与解题模型一致",
    )


class AdminUniapiConfigResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminUniapiConfig] = None


class AdminUniapiConfigUpdateRequest(BaseModel):
    """仅传需要更新的字段；None 表示不修改，空字符串表示清空该配置（回退到解题/环境变量）。"""

    base_url: Optional[str] = Field(None, max_length=512, description="解题模型 API 基础地址")
    token: Optional[str] = Field(None, max_length=512, description="解题模型 API Token")
    model: Optional[str] = Field(None, max_length=128, description="默认解题模型 ID")
    base_url_knowledge: Optional[str] = Field(None, max_length=512, description="知识点模型 API 基础地址")
    token_knowledge: Optional[str] = Field(None, max_length=512, description="知识点模型 API Token")
    model_knowledge: Optional[str] = Field(None, max_length=128, description="知识点识别模型 ID")
    base_url_semantic: Optional[str] = Field(None, max_length=512, description="语义情境模型 API 基础地址")
    token_semantic: Optional[str] = Field(None, max_length=512, description="语义情境模型 API Token")
    model_semantic: Optional[str] = Field(None, max_length=128, description="语义情境识别模型 ID")


class AdminSolveModelItem(BaseModel):
    id: int
    model_id: str
    display_name: str
    sort_order: int = 0
    enabled: bool = True
    created_at: Optional[str] = None


class AdminSolveModelListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminSolveModelItem] = []


class AdminSolveModelUpsertResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminSolveModelItem] = None


class AdminSolveModelCreateRequest(BaseModel):
    model_id: str = Field(..., max_length=128)
    display_name: str = Field(..., max_length=128)
    sort_order: int = 0
    enabled: bool = True


class AdminSolveModelUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=128)
    sort_order: Optional[int] = None
    enabled: Optional[bool] = None


class AdminRecordItem(UserProfileFields):
    """管理员查看的解题记录条目（带用户信息简要）"""

    id: str
    question: str
    answer: Optional[str] = None
    created_at: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None


class AdminRecordListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminRecordItem] = []
    total: int = 0


class AdminRecordDetailItem(AdminRecordItem):
    """管理员查看的解题记录详情（包含完整解题过程与标签原始数据）"""

    solution: Optional[str] = None
    knowledge_points: List[str] = Field(default_factory=list)
    semantic_contexts: List[str] = Field(default_factory=list)


class AdminRecordDetailResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminRecordDetailItem] = None


class AdminFavoriteItem(UserProfileFields):
    """管理员查看的收藏条目（带记录与用户信息简要）"""

    id: str
    record_id: str
    question: str
    created_at: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None


class AdminFavoriteListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminFavoriteItem] = []
    total: int = 0


class AdminExperimentFlowItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    enabled: bool = True
    rest_break_enabled: bool = True
    rest_break_seconds: int = 5
    rest_break_every: int = 1
    question_count: int = 0
    session_count: int = 0
    archived: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminExperimentFlowListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminExperimentFlowItem] = []


class AdminExperimentFlowUpsertResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminExperimentFlowItem] = None


class AdminExperimentFlowCreateRequest(BaseModel):
    id: str = Field(..., max_length=64)
    name: str = Field(..., max_length=128)
    description: Optional[str] = None
    sort_order: int = 0
    enabled: bool = True
    rest_break_enabled: bool = True
    rest_break_seconds: int = Field(default=5, ge=0, le=300)
    rest_break_every: int = Field(default=1, ge=1, le=100)


class AdminExperimentFlowUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None
    sort_order: Optional[int] = None
    enabled: Optional[bool] = None
    rest_break_enabled: Optional[bool] = None
    rest_break_seconds: Optional[int] = Field(default=None, ge=0, le=300)
    rest_break_every: Optional[int] = Field(default=None, ge=1, le=100)


class AdminExperimentQuestionItem(BaseModel):
    flow_id: str
    id: str
    title: Optional[str] = None
    content: str
    sort_order: int = 0
    enabled: bool = True
    mwp_id: Optional[int] = None
    level5: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminExperimentQuestionListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminExperimentQuestionItem] = []


class AdminExperimentQuestionUpsertResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminExperimentQuestionItem] = None


class AdminExperimentQuestionCreateRequest(BaseModel):
    id: str = Field(..., max_length=64)
    title: Optional[str] = Field(None, max_length=128)
    content: str = Field(..., min_length=1)
    sort_order: int = 0
    enabled: bool = True
    mwp_id: Optional[int] = None
    level5: Optional[str] = Field(None, max_length=16)


class AdminExperimentQuestionUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=128)
    content: Optional[str] = Field(None, min_length=1)
    sort_order: Optional[int] = None
    enabled: Optional[bool] = None
    mwp_id: Optional[int] = None
    level5: Optional[str] = Field(None, max_length=16)


class AdminSamplingRunRequest(BaseModel):
    seed: int = Field(default=20260907)
    mode: str = Field(default="unused_first", description="unused_first | deal")
    n_participants: int = Field(default=50, ge=1, le=200)
    per_level: int = Field(default=3, ge=1, le=20)
    include_format_diff: bool = False
    allow_missing_composite_score: bool = False
    avoid_adjacent_same_level: bool = False


class AdminSamplingImportRequest(BaseModel):
    run_id: Optional[str] = Field(None, description="产物目录名，如 20260907 或 20260907-2")
    seed: Optional[int] = Field(None, description="兼容旧请求；优先使用 run_id")
    replace_existing: bool = Field(
        default=True,
        description="若 flow-p00x 已存在则替换其题目（并更新流元数据）",
    )
    enabled: bool = Field(default=True, description="导入后的实验流是否启用")
    rest_break_enabled: bool = True
    rest_break_seconds: int = Field(default=5, ge=0, le=300)
    rest_break_every: int = Field(default=1, ge=1, le=100, description="每完成多少题休息一次")
    participant_ids: Optional[List[str]] = Field(
        default=None,
        description="仅导入指定被试，如 ['P001','P002']；为空则全部导入",
    )


class AdminExperimentSessionItem(UserProfileFields):
    id: str
    flow_id: Optional[str] = None
    flow_name: Optional[str] = None
    status: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None
    question_count: int = 0
    event_count: int = 0
    created_at: Optional[str] = None


class AdminExperimentSessionListResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: List[AdminExperimentSessionItem] = []
    total: int = 0


class AdminExperimentSessionDetailItem(AdminExperimentSessionItem):
    payload: dict = Field(default_factory=dict)


class AdminExperimentSessionDetailResponse(BaseModel):
    errCode: int = 0
    errMsg: str = "success"
    data: Optional[AdminExperimentSessionDetailItem] = None
