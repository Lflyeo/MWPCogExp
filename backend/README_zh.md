# MWPCogExp 后端（FastAPI + MySQL）

数学解题认知实验系统 API：用户认证、个人资料、认知实验流/题目/会话，以及管理端用户管理、实验数据与可选抽样。

**不包含**解题大模型、知识点/语义识别、解题记录与收藏接口。

---

## 技术栈

- **框架**：FastAPI  
- **数据库**：MySQL（PyMySQL）  
- **ORM**：SQLAlchemy 2  
- **校验**：Pydantic 2  
- **认证**：JWT（PyJWT）+ bcrypt  
- **配置**：python-dotenv  
- **上传**：python-multipart  

---

## 目录结构

```text
backend/
├─ main.py                 # 入口：路由、uploads、启动迁移/种子
├─ config.py               # DB / JWT / CORS / ADMIN_SECRET
├─ database.py
├─ init_db.sql             # 建库建表
├─ requirements.txt
├─ .env.example
├─ user_profile.py
├─ models/
│  ├─ user.py
│  ├─ experiment_flow.py
│  ├─ experiment_question.py
│  ├─ experiment_session.py
│  └─ mwp.py               # 题库（抽样辅助）
├─ schemas/
│  ├─ auth.py / admin.py / experiment.py / mwp.py
├─ routers/
│  ├─ auth.py              # /api/auth/*
│  ├─ experiment.py        # /api/experiment/*
│  ├─ admin.py             # /api/admin/*（用户 + 实验）
│  ├─ admin_sampling.py    # /api/admin/experiment-sampling/*
│  └─ mwps.py              # 题库只读（抽样用）
└─ sampling/               # 分层覆盖抽样流水线
```

---

## 环境要求

- Python 3.10+  
- MySQL 5.7+ / 8.0+  

---

## 配置（.env）

```bash
cd backend
cp .env.example .env
```

主要项（见 `config.py`）：

| 变量 | 说明 |
|------|------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | 数据库 |
| `JWT_SECRET` / `JWT_EXPIRE_MINUTES` | 用户 JWT（生产务必改密钥） |
| `ADMIN_SECRET` | 管理端 `X-Admin-Token` / Bearer |
| `UPLOAD_DIR` | 上传目录（相对 backend） |

本地 MySQL 步骤见 [SETUP_LOCAL_MYSQL.md](./SETUP_LOCAL_MYSQL.md)。

---

## 初始化数据库

```bash
cd backend
mysql -u root -p < init_db.sql
```

表：

- `users` — 用户与个人资料  
- `experiment_flows` — 实验流  
- `experiment_questions` — 流内题目  
- `experiment_sessions` — 实验会话 JSON  
- `mwps` — 题库（可选，供抽样导入）  

---

## 启动

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- 健康检查：`GET /health`  
- API 文档：`/docs`  
- 根路径：`GET /` → MWPCogExp API 说明  

---

## 接口总览（简版）

### 用户端

- **认证**  
  - `POST /api/auth/register`  
  - `POST /api/auth/login`  
  - `GET|PATCH /api/auth/profile`  
  - `POST /api/auth/avatar/upload`  
- **认知实验**  
  - `GET /api/experiment/flows`  
  - `GET /api/experiment/flows/{flow_id}/questions`  
  - `POST /api/experiment/sessions`（提交会话）  
  - 题目图片等静态资源经 `/api/uploads/...`  

### 管理端

Header：`X-Admin-Token: <ADMIN_SECRET>` 或 `Authorization: Bearer <ADMIN_SECRET>`。

- 用户：列表 / 详情 / 新增 / 编辑 / 删 / 重置密码 / 头像  
- 实验流与题目：CRUD、题目图片上传  
- 实验会话：列表 / 详情 / 删除  
- 抽样（可选）：`/api/admin/experiment-sampling/*` 运行、产物、导入到实验流  

---

## CORS

默认允许本地常见前端源（见 `config.py`）。前端开发默认端口 **3000**。

---

## 注意事项

- 生产环境务必修改 `JWT_SECRET`、`ADMIN_SECRET`  
- 勿提交真实 `backend/.env`  
- 上传文件在 `backend/uploads/`，经 `/api/uploads/...` 访问  
