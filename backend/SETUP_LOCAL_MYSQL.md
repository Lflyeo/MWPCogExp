# 本地 MySQL 配置指南（MWPCogExp）

## 1. 检查 MySQL 服务是否启动

### Windows

**方法一：服务管理器**
1. 按 `Win + R`，输入 `services.msc`，回车  
2. 找到 `MySQL` 或 `MySQL80` 服务  
3. 确认状态为「正在运行」；未运行则右键 →「启动」

**方法二：命令行**
```powershell
net start | findstr MySQL
# 需管理员权限时可：
net start MySQL80
```

### 测试连接

```bash
mysql -u root -p
```

---

## 2. 配置 .env

确保 `backend/.env` 存在（可由 `.env.example` 复制）：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=mathpro_db
ADMIN_SECRET=MWPCogExp-admin-secret-change-in-production
```

- `DB_HOST`：`localhost` 或 `127.0.0.1`  
- `DB_PORT`：默认 `3306`  
- `ADMIN_SECRET`：管理后台登录密钥  

---

## 3. 创建数据库和表

推荐直接执行完整脚本：

```bash
cd backend
mysql -u root -p < init_db.sql
```

将创建：

- 数据库 `mathpro_db`  
- 表 `users`、`experiment_flows`、`experiment_questions`、`experiment_sessions`、`mwps`  

也可用 Navicat / DBeaver / Workbench 打开并执行 `init_db.sql`。

---

## 4. 测试连接

```bash
cd backend
python test_db_connection.py
```

期望看到 MySQL 连接成功、数据库已存在等提示。

---

## 5. 常见问题

| 现象 | 处理 |
|------|------|
| Can't connect to MySQL server | 启动 MySQL 服务；核对端口 |
| Unknown database 'mathpro_db' | 执行 `init_db.sql` |
| Access denied | 检查 `DB_USER` / `DB_PASSWORD` |

---

## 6. 验证

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

访问 `http://localhost:8000/health` 应返回 `{"status":"ok"}`。

---

## 7. 检查清单

- [ ] MySQL 服务已启动  
- [ ] `.env` 中 DB 与 `ADMIN_SECRET` 已配置  
- [ ] 已执行 `init_db.sql`  
- [ ] `test_db_connection.py` 通过  
- [ ] 后端 `/health` 正常  
