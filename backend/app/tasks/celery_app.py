from celery import Celery
from app.config import settings

celery_app = Celery(
    "phygitron360",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.resume_tasks",
        "app.tasks.assessment_tasks",
        "app.tasks.learning_tasks",
        "app.tasks.deploy_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_max_retries=3,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "skill-decay-check-daily": {
            "task": "app.tasks.deploy_tasks.skill_decay_check_task",
            "schedule": 86400.0,  # Every 24 hours
        },
        "send-deadline-reminders": {
            "task": "app.tasks.learning_tasks.send_reminder_email_task",
            "schedule": 3600.0,  # Every hour
        },
    },
)
