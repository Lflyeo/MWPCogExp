from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class ExperimentFlow(Base):
    __tablename__ = "experiment_flows"

    id = Column(String(64), primary_key=True, comment="实验流ID")
    name = Column(String(128), nullable=False, comment="实验流名称")
    description = Column(Text, nullable=True, comment="描述")
    sort_order = Column(Integer, default=0, comment="排序")
    enabled = Column(Boolean, default=True, comment="是否启用")
    rest_break_enabled = Column(Boolean, default=True, comment="题间是否休息")
    rest_break_seconds = Column(Integer, default=5, comment="题间休息秒数")
    rest_break_every = Column(Integer, default=1, comment="每完成多少题休息一次")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self, question_count: int = 0):
        rest_every = int(self.rest_break_every or 1)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "sort_order": self.sort_order,
            "enabled": bool(self.enabled),
            "rest_break_enabled": bool(self.rest_break_enabled),
            "rest_break_seconds": int(self.rest_break_seconds or 5),
            "rest_break_every": rest_every if rest_every > 0 else 1,
            "question_count": question_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
