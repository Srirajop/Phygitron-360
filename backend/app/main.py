from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import init_db
from app.routers import auth, source, verify, forge, deploy, admin

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown


app = FastAPI(
    title="PHYGITRON 360 API",
    description="Unified AI-Driven Talent Lifecycle Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
async def root():
    return {"platform": "PHYGITRON 360", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

