import os
from celery import Celery
from dotenv import load_dotenv

# Define BASE_DIR at the very top for cross-platform absolute path resolution
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from absolute path
load_dotenv(os.path.join(BASE_DIR, ".env"))

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery
celery_app = Celery(
    "phygitron360",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "backend.modules.verify.services.assessment_tasks",
        "backend.modules.source.services.ats_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour
)
