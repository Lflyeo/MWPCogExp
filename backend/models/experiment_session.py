from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class ExperimentSession(Base):
    __tablename__ = "experiment_sessions"

    id = Column(String(64), primary_key=True, comment="会话ID")
    # 仅保存实验流 ID 快照，不设外键。删除实验流后仍可按该 ID 查看历史作答。
    flow_id = Column(String(64), nullable=True, index=True, comment="实验流ID")
    status = Column(String(20), nullable=False, default="ended", comment="实验状态")
    started_at = Column(DateTime, nullable=True, comment="开始时间")
    ended_at = Column(DateTime, nullable=True, comment="结束时间")
    user_id = Column(String(36), nullable=True, comment="关联用户ID")
    payload = Column(Text, nullable=False, comment="完整实验数据 JSON")
    created_at = Column(DateTime, server_default=func.now())

    def to_list_item(self, flow_name: str | None = None):
        return {
            "id": self.id,
            "flow_id": self.flow_id,
            "flow_name": flow_name,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
