## 数学解题认知实验系统（MWPCogExp）V1.0

面向数学解题认知过程采集的实验系统：支持实验流配置、全屏手写作答、笔迹与事件记录、题间休息控制，以及实验会话数据归档与管理。适用于教学与科研场景下的标准化认知实验。


中文说明见 [README_zh.md](./README_zh.md)。

---

### Feature Overview

- **User auth & profile** — register / login / logout; edit name, student ID, college, avatar, etc.
- **Cognitive experiment** — choose a flow (or run the built-in practice tour), confirm profile, enter fullscreen; handwritten canvas; F9 next / rest, F10 end early; capture strokes, events, and question snapshots.
- **Session archival** — submit session payloads to `/api/experiment/sessions` for admin search, detail view, and JSON/CSV export.
- **Admin console** — users; experiment flows & questions; experiment sessions; optional stratified sampling into flows.

---

### Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, React Router 7, Vite 6, Tailwind CSS, Konva / react-konva, KaTeX, sonner |
| Backend | FastAPI, SQLAlchemy 2, MySQL, JWT, bcrypt |
| Package manager | pnpm (frontend), pip (backend) |

---

### Directory Structure (core)

```text
MWPCogExp/
├─ package.json
├─ vite.config.ts
├─ src/
│  ├─ App.tsx                 # User + admin routes
│  ├─ components/Layout.tsx
│  ├─ contexts/authContext.tsx
│  ├─ pages/user/             # Home, Login, Register, MyPage
│  ├─ pages/admin/            # Users, experiment flows/questions/data/sampling
│  ├─ modules/experiment/     # Experiment UI, hooks, drawing, overlays
│  └─ services/               # auth, experiment, admin
└─ backend/                   # FastAPI API (see backend/README.md)
```

---

### Routes

**User**

| Path | Description |
|------|-------------|
| `/` | Home |
| `/login`, `/register` | Auth |
| `/mypage` | Profile (login required) |
| `/experiment` | Experiment home (flows + practice) |
| `/experiment/:flowId/run` | Fullscreen run |

**Admin** (`/admin/login` with `ADMIN_SECRET`)

| Path | Description |
|------|-------------|
| `/admin/users` | User management |
| `/admin/experiment-flows` | Flows & questions |
| `/admin/experiment-data` | Session list / detail / export |
| `/admin/experiment-sampling` | Optional sampling → import to flows |

---

### Local Development

**Prerequisites:** Node.js 18+, pnpm, Python 3.10+, MySQL 8.

**Backend**

```bash
cd backend
cp .env.example .env   # set DB_* , JWT_SECRET, ADMIN_SECRET
mysql -u root -p < init_db.sql
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- Health: `GET http://localhost:8000/health`
- Docs: `http://localhost:8000/docs`
- More: [backend/README.md](./backend/README.md)

**Frontend**

```bash
pnpm install
# optional: VITE_API_BASE_URL=http://localhost:8000
pnpm dev
```

Default UI: `http://localhost:3000`.

**Build**

```bash
pnpm build:client   # → dist/static
# or
pnpm build
```

Serve `dist/static` and fall back unknown paths to `index.html`.

---

### Notes

1. Prefer Chrome / Edge for formal experiments; allow fullscreen.
2. Avoid refresh/close mid-session to keep data complete.
3. Change `JWT_SECRET` and `ADMIN_SECRET` in production; do not commit real `.env`.
