"""
MWPs 题库表迁移：创建 mwps 表。
应用启动时自动执行，也可手动运行：python migrate_mwps.py
"""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def _exec(conn, sql: str):
    conn.execute(text(sql))


def migrate_mwps_schema(db: Session) -> list[str]:
    """幂等创建 mwps 表，返回已执行步骤说明。"""
    conn = db.connection()
    inspector = inspect(conn)
    steps: list[str] = []

    if not _table_exists(inspector, "mwps"):
        _exec(
            conn,
            """
            CREATE TABLE mwps (
                id INT PRIMARY KEY COMMENT '题目ID（数据集原始 id）',
                raw_text TEXT NOT NULL COMMENT '题目原文',
                api_response_process TEXT COMMENT '模型解题过程',
                api_response_result TEXT COMMENT '模型原始结果',
                answer_e VARCHAR(128) COMMENT '规范答案 E',
                answer_ans VARCHAR(128) COMMENT '答案 ans',
                original_text TEXT COMMENT '分词后文本',
                pos TEXT COMMENT '词性标注序列',
                answer_quality VARCHAR(32) COMMENT '答案质量 exact/format_diff',
                score_l DOUBLE COMMENT '难度分 L',
                score_m DOUBLE COMMENT '难度分 M',
                score_w DOUBLE COMMENT '难度分 W',
                composite_score DOUBLE COMMENT '综合难度分',
                `rank` INT COMMENT '排名',
                level5 VARCHAR(16) COMMENT '五档难度',
                composite_score_critic DOUBLE,
                composite_score_flat_entropy DOUBLE,
                patched_by VARCHAR(64) COMMENT '修补模型',
                patched_at VARCHAR(64) COMMENT '修补时间',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mwps_level5 (level5),
                INDEX idx_mwps_rank (`rank`),
                INDEX idx_mwps_composite_score (composite_score),
                INDEX idx_mwps_answer_quality (answer_quality)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数学应用题题库'
            """,
        )
        steps.append("created mwps")

    db.commit()
    return steps


if __name__ == "__main__":
    from database import SessionLocal

    session = SessionLocal()
    try:
        applied = migrate_mwps_schema(session)
        print("Migration completed:", applied or ["no changes needed"])
    finally:
        session.close()
