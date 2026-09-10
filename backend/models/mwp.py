from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from sqlalchemy.sql import func
from database import Base


class MWP(Base):
    """数学应用题题库（来自 MWPs.json）。"""

    __tablename__ = "mwps"
    __table_args__ = (
        Index("idx_mwps_level5", "level5"),
        Index("idx_mwps_rank", "rank"),
        Index("idx_mwps_composite_score", "composite_score"),
        Index("idx_mwps_answer_quality", "answer_quality"),
    )

    id = Column(Integer, primary_key=True, comment="题目ID（数据集原始 id）")
    raw_text = Column(Text, nullable=False, comment="题目原文")
    api_response_process = Column(Text, nullable=True, comment="模型解题过程")
    api_response_result = Column(Text, nullable=True, comment="模型原始结果")
    answer_e = Column(String(128), nullable=True, comment="规范答案 E")
    answer_ans = Column(String(128), nullable=True, comment="答案 ans")
    original_text = Column(Text, nullable=True, comment="分词后文本")
    pos = Column(Text, nullable=True, comment="词性标注序列")
    answer_quality = Column(String(32), nullable=True, comment="答案质量 exact/format_diff")
    score_l = Column(Float, nullable=True, comment="难度分 L")
    score_m = Column(Float, nullable=True, comment="难度分 M")
    score_w = Column(Float, nullable=True, comment="难度分 W")
    composite_score = Column(Float, nullable=True, comment="综合难度分")
    rank = Column(Integer, nullable=True, comment="排名")
    level5 = Column(String(16), nullable=True, comment="五档难度")
    composite_score_critic = Column(Float, nullable=True)
    composite_score_flat_entropy = Column(Float, nullable=True)
    patched_by = Column(String(64), nullable=True, comment="修补模型")
    patched_at = Column(String(64), nullable=True, comment="修补时间")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_list_dict(self):
        """列表接口用（不含长文本过程）。"""
        return {
            "id": self.id,
            "raw_text": self.raw_text,
            "answer_e": self.answer_e,
            "answer_ans": self.answer_ans,
            "answer_quality": self.answer_quality,
            "score_l": self.score_l,
            "score_m": self.score_m,
            "score_w": self.score_w,
            "composite_score": self.composite_score,
            "rank": self.rank,
            "level5": self.level5,
            "composite_score_critic": self.composite_score_critic,
            "composite_score_flat_entropy": self.composite_score_flat_entropy,
        }

    def to_detail_dict(self, include_process: bool = True):
        data = self.to_list_dict()
        data.update(
            {
                "api_response_result": self.api_response_result,
                "original_text": self.original_text,
                "pos": self.pos,
                "patched_by": self.patched_by,
                "patched_at": self.patched_at,
            }
        )
        if include_process:
            data["api_response_process"] = self.api_response_process
        return data
