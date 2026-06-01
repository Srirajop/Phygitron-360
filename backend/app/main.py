from contextlib import asynccontextmanager
import os
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import init_db
from app.routers import auth, source, verify, forge, deploy, admin, journey, onboarding, notifications, platform

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    await source.start_resume_parse_workers()
    try:
        yield
    finally:
        await source.stop_resume_parse_workers()


app = FastAPI(
    title="PHYGITRON 360 API",
    description="Unified AI-Driven Talent Lifecycle Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Global exception handler — prevents silent connection drops that show as "Network Error"
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": f"Internal server error: {str(exc)}"},
    )

# CORS — allow all dev/prod frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Serve locally stored uploads (S3 fallback)
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include all routers
app.include_router(auth.router)
app.include_router(source.router)
app.include_router(verify.router)
app.include_router(forge.router)
app.include_router(deploy.router)
app.include_router(admin.router)
app.include_router(journey.router)
app.include_router(onboarding.router)
app.include_router(notifications.router)
app.include_router(platform.router)


@app.get("/")
async def root():
    return {"platform": "PHYGITRON 360", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
