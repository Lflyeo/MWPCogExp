# MWPCogExp Backend (FastAPI + MySQL)

API for the Math Word Problem Cognitive Experiment System: user auth, profiles, experiment flows / questions / sessions, plus admin user management, session data, and optional sampling.

**Does not include** LLM solving, knowledge-point / semantic recognition, solving records, or favorites.

---

## Tech Stack

- **Framework**: FastAPI  
- **Database**: MySQL (PyMySQL)  
- **ORM**: SQLAlchemy 2  
- **Validation**: Pydantic 2  
- **Auth**: JWT (PyJWT) + bcrypt  
- **Config**: python-dotenv  
- **Uploads**: python-multipart  

---

## Directory Structure

```text
backend/
├─ main.py                 # Entry: routers, uploads, startup migrate/seed
├─ config.py               # DB / JWT / CORS / ADMIN_SECRET
├─ database.py
├─ init_db.sql
├─ requirements.txt
├─ .env.example
├─ user_profile.py
├─ models/                 # user, experiment_*, mwp
├─ schemas/                # auth, admin, experiment, mwp
├─ routers/
│  ├─ auth.py
│  ├─ experiment.py
│  ├─ admin.py
│  ├─ admin_sampling.py
│  └─ mwps.py
└─ sampling/               # Stratified coverage sampling pipeline
```

---

## Requirements

- Python 3.10+  
- MySQL 5.7+ / 8.0+  

---

## Configuration (.env)

```bash
cd backend
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `DB_*` | Database connection |
| `JWT_SECRET` / `JWT_EXPIRE_MINUTES` | User JWT (change in production) |
| `ADMIN_SECRET` | Admin `X-Admin-Token` / Bearer |
| `UPLOAD_DIR` | Upload directory (relative to backend) |

See [SETUP_LOCAL_MYSQL.md](./SETUP_LOCAL_MYSQL.md) for local MySQL setup (Chinese).

---

## Initialize Database

```bash
cd backend
mysql -u root -p < init_db.sql
```

Tables: `users`, `experiment_flows`, `experiment_questions`, `experiment_sessions`, `mwps` (optional pool for sampling).

---

## Start

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- Health: `GET /health`  
- Docs: `/docs`  

---

## API Overview

**User:** `/api/auth/*`, `/api/experiment/*` (flows, questions, session submit).  

**Admin** (`X-Admin-Token` or Bearer `ADMIN_SECRET`): users; experiment flows/questions/sessions; optional `/api/admin/experiment-sampling/*`.

---

## Notes

- Change `JWT_SECRET` and `ADMIN_SECRET` in production.  
- Do not commit a real `.env`.  
- Uploads live under `backend/uploads/` and are served at `/api/uploads/...`.  
