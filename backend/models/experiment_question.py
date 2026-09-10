from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base


class ExperimentQuestion(Base):
    __tablename__ = "experiment_questions"

    flow_id = Column(String(64), ForeignKey("experiment_flows.id", ondelete="CASCADE"), primary_key=True, comment="实验流ID")
    id = Column(String(64), primary_key=True, comment="题目ID")
    title = Column(String(128), nullable=True, comment="题目标题")
    content = Column(Text, nullable=False, comment="题目内容")
    sort_order = Column(Integer, default=0, comment="排序")
    enabled = Column(Boolean, default=True, comment="是否启用")
    mwp_id = Column(Integer, nullable=True, comment="关联 MWPs 题库 id")
    level5 = Column(String(16), nullable=True, comment="五档难度")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "flow_id": self.flow_id,
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "sort_order": self.sort_order,
            "enabled": bool(self.enabled),
            "mwp_id": self.mwp_id,
            "level5": self.level5,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
