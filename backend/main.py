# 保证从项目根或 backend 目录启动都能正确解析导入
import sys
from pathlib import Path
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import settings
from database import SessionLocal
from routers import auth, admin, experiment, mwps, admin_sampling
from migrate_experiment import migrate_experiment_schema
from migrate_user_profile import migrate_user_profile_schema
from migrate_mwps import migrate_mwps_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动时：迁移实验/用户资料/题库表结构，并确保默认实验流与操作练习流可用。"""
    db = SessionLocal()
    try:
        migrated = migrate_experiment_schema(db)
        if migrated:
            print(f"[startup] Experiment schema migrated: {', '.join(migrated)}")
        profile_migrated = migrate_user_profile_schema(db)
        if profile_migrated:
            print(f"[startup] User profile schema migrated: {', '.join(profile_migrated)}")
        mwps_migrated = migrate_mwps_schema(db)
        if mwps_migrated:
            print(f"[startup] MWPs schema migrated: {', '.join(mwps_migrated)}")
        eq = experiment.seed_experiment_flows_and_questions(db)
        if eq > 0:
            print(f"[startup] Seeded experiment flow(s) and question(s) ({eq} records).")
        guide = experiment.ensure_guide_experiment_flow(db)
        if guide > 0:
            print(f"[startup] Ensured guide experiment flow ({guide} change(s)).")
    finally:
        db.close()
    yield


app = FastAPI(
    title="MWPCogExp API",
    description="面向认知实验的数学应用题求解模拟系统 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=getattr(settings, "CORS_ORIGIN_REGEX", None),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_sampling.router, prefix=settings.API_V1_PREFIX)
app.include_router(experiment.router, prefix=settings.API_V1_PREFIX)
app.include_router(mwps.router, prefix=settings.API_V1_PREFIX)

_upload_dir = _backend_dir / settings.UPLOAD_DIR
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount(f"/{settings.API_V1_PREFIX.strip('/')}/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")

@app.get("/")
def root():
    return {"message": "MWPCogExp 面向认知实验的数学应用题求解模拟系统 API", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
