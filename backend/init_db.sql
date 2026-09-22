-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS mathpro_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mathpro_db;

-- 用户表（登录/注册）
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(64) NOT NULL COMMENT '姓名（登录账号）',
    password_hash VARCHAR(128) NOT NULL COMMENT '密码哈希',
    nickname VARCHAR(64) COMMENT '昵称/显示名',
    avatar_url VARCHAR(512) COMMENT '头像URL',
    real_name VARCHAR(64) COMMENT '姓名',
    age INT COMMENT '年龄',
    gender VARCHAR(16) COMMENT '性别',
    contact VARCHAR(128) COMMENT '联系方式（电话/微信号）',
    college VARCHAR(128) COMMENT '学院',
    major VARCHAR(128) COMMENT '专业',
    student_id VARCHAR(64) COMMENT '学号',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 认知实验流表
CREATE TABLE IF NOT EXISTS experiment_flows (
    id VARCHAR(64) PRIMARY KEY COMMENT '实验流ID',
    name VARCHAR(128) NOT NULL COMMENT '实验流名称',
    description TEXT COMMENT '描述',
    sort_order INT DEFAULT 0 COMMENT '排序',
    enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='认知实验流表';

-- 认知实验题目表（归属于实验流）
CREATE TABLE IF NOT EXISTS experiment_questions (
    flow_id VARCHAR(64) NOT NULL COMMENT '实验流ID',
    id VARCHAR(64) NOT NULL COMMENT '题目ID',
    title VARCHAR(128) COMMENT '题目标题',
    content LONGTEXT NOT NULL COMMENT '题目内容',
    sort_order INT DEFAULT 0 COMMENT '排序',
    enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (flow_id, id),
    CONSTRAINT fk_experiment_questions_flow FOREIGN KEY (flow_id) REFERENCES experiment_flows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='认知实验题目表';

-- 认知实验会话数据表
CREATE TABLE IF NOT EXISTS experiment_sessions (
    id VARCHAR(64) PRIMARY KEY COMMENT '会话ID',
    flow_id VARCHAR(64) COMMENT '实验流ID',
    status VARCHAR(20) NOT NULL DEFAULT 'ended' COMMENT '实验状态',
    started_at DATETIME COMMENT '开始时间',
    ended_at DATETIME COMMENT '结束时间',
    user_id VARCHAR(36) COMMENT '关联用户ID',
    payload LONGTEXT NOT NULL COMMENT '完整实验数据 JSON',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_experiment_sessions_created_at (created_at),
    INDEX idx_experiment_sessions_user_id (user_id),
    INDEX idx_experiment_sessions_flow_id (flow_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='认知实验会话数据表';

-- 数学应用题题库（抽样辅助用，可用 python import_mwps.py 导入）
CREATE TABLE IF NOT EXISTS mwps (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数学应用题题库';
