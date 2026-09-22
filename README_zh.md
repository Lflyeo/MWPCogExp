## 数学解题认知实验系统（MWPCogExp）V1.0

面向数学解题认知过程采集的实验系统：支持实验流配置、全屏手写作答、笔迹与事件记录、题间休息控制，以及实验会话数据归档与管理。适用于教学与科研场景下的标准化认知实验。

> 本软件由原系统中的认知实验及相关用户/认证模块独立抽取形成，**不包含**解题大模型、知识点识别、语义情境识别等模块。

English: [README.md](./README.md)

---

### 特性概览

- **用户认证与个人中心**  
  注册、登录、退出；个人中心可编辑姓名、学号、学院等资料，支持头像上传。
- **认知实验作答**  
  进入实验首页，可先完成内置「实验操作练习」，再选择正式实验流；确认个人信息后进入全屏；手写笔/橡皮作答；默认 **F9** 结束当前题并进入题间休息，**F10** 提前结束整场实验；记录题目起止、笔迹、休息等事件，并可上传题目截图快照。
- **实验数据提交归档**  
  结束后将会话数据提交至 `/api/experiment/sessions`，供管理端检索、查看详情与导出（JSON/CSV）。
- **管理后台**  
  用户管理；实验流与题目管理；实验会话数据管理；可选的分层覆盖抽样并导入实验流。

---

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、TypeScript、React Router 7、Vite 6、Tailwind CSS、Konva / react-konva、KaTeX、sonner |
| 后端 | FastAPI、SQLAlchemy 2、MySQL、JWT、bcrypt |
| 包管理 | 前端 pnpm；后端 pip |

---

### 目录结构（核心）

```text
MWPCogExp/
├─ package.json
├─ vite.config.ts
├─ src/
│  ├─ App.tsx                      # 用户端 + 管理端路由
│  ├─ components/Layout.tsx        # 用户端顶栏布局
│  ├─ contexts/authContext.tsx     # 登录态
│  ├─ pages/user/                  # 首页、登录、注册、个人中心
│  ├─ pages/admin/                 # 用户 / 实验流 / 实验数据 / 抽样
│  ├─ modules/experiment/          # 实验作答 UI、画布、遮罩、钩子
│  └─ services/                    # auth、experiment、admin
└─ backend/                        # FastAPI（详见 backend/README_zh.md）
```

---

### 路由说明

#### 用户端

| 路径 | 说明 |
|------|------|
| `/` | 系统首页 |
| `/login`、`/register` | 登录 / 注册 |
| `/mypage` | 个人中心（需登录） |
| `/experiment` | 认知实验首页（练习流 + 正式流列表） |
| `/experiment/:flowId/run` | 全屏作答页 |

#### 管理端

访问 `/admin/login`，使用配置中的 `ADMIN_SECRET` 登录。

| 路径 | 说明 |
|------|------|
| `/admin/users` | 用户管理 |
| `/admin/experiment-flows` | 实验流与题目管理 |
| `/admin/experiment-data` | 实验会话数据（筛选 / 详情 / 导出） |
| `/admin/experiment-sampling` | 分层覆盖抽样（可选） |

---

### 本地开发

**环境：** Node.js 18+、pnpm、Python 3.10+、MySQL 8。

#### 后端

```bash
cd backend
cp .env.example .env   # 配置 DB_*、JWT_SECRET、ADMIN_SECRET
mysql -u root -p < init_db.sql
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- 健康检查：`GET http://localhost:8000/health`
- API 文档：`http://localhost:8000/docs`
- 详见 [backend/README_zh.md](./backend/README_zh.md)

#### 前端

```bash
pnpm install
# 可选：设置 VITE_API_BASE_URL=http://localhost:8000
pnpm dev
```

默认地址：`http://localhost:3000`。

#### 构建

```bash
pnpm build:client   # 输出到 dist/static
# 或
pnpm build
```

部署时将 `dist/static` 作为静态目录，未命中路由回退到 `index.html`。

---

### 实验流程（简要）

1. 被试登录后进入 `/experiment`，建议先做操作练习。  
2. 选择实验流 → 确认个人信息 → 按提示进入全屏。  
3. 作答区手写；**F9** 切题/休息，**F10** 结束实验。  
4. 结束后提交会话并查看结果摘要，返回实验首页。  
5. 管理员在「认知实验数据」中查看、导出会话。

---

### 注意事项

1. 正式实验建议使用 Chrome 或 Edge，并允许浏览器全屏。  
2. 实验过程中请勿随意刷新或关闭页面，以免会话数据不完整。  
3. 生产环境务必修改 `JWT_SECRET` 与 `ADMIN_SECRET`，勿将真实 `.env` 提交入库。
