import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# Set up central deploy module router
from backend.modules.deploy.api.auth import router as auth_router
from backend.core.dependencies import require_module
from backend.modules.deploy.api.dashboard import router as dashboard_router
from backend.modules.deploy.api.employees import router as employees_router
from backend.modules.deploy.api.assets import router as assets_router
from backend.modules.deploy.api.attendance import router as attendance_router
from backend.modules.deploy.api.assessments import router as assessments_router
from backend.modules.deploy.api.training import router as training_router
from backend.modules.deploy.api.onboarding import router as onboarding_router
from backend.modules.deploy.api.notifications import router as notifications_router
from backend.modules.deploy.api.password import router as password_router
from backend.modules.deploy.api.payroll import router as payroll_router
from backend.modules.admin.api.admin import router as admin_router
from backend.modules.admin.api.org import router as org_router
from backend.api.billing import router as billing_router
from fastapi import Depends

# Set up Source & Verify modules
from backend.modules.source.api.candidates import router as candidates_router
from backend.modules.source.api.jobs import router as jobs_router
from backend.modules.source.api.offers import router as offers_router

from backend.modules.verify.api.builder import router as verify_builder_router
from backend.modules.verify.api.assignments import router as verify_assignments_router
from backend.modules.verify.api.submissions import router as verify_submissions_router
from backend.modules.verify.api.sandbox import router as verify_sandbox_router
from backend.modules.verify.api.queries import router as verify_queries_router
from backend.modules.verify.api.question_bank import router as verify_question_bank_router
from backend.modules.verify.api.live_monitoring import router as verify_live_monitor_router

app = FastAPI(
    title="PHYGITRON 360",
    description="Multi-tenant Modular Talent Intelligence Platform API",
    version="1.0.0"
)

# Automated Schema Sync (Moved to startup event for non-blocking cold starts)

# CORS configuration
origins = ["*"] # Allow all for network dev

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global API Response
@app.get("/api/health")
def health_check():
    return JSONResponse(content={"status": "online", "message": "PHYGITRON 360 Platform is operational"})

# Static Files
from backend.core.database import DATA_DIR
uploads_dir = os.path.join(DATA_DIR, 'uploads')
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Background Workers
import asyncio
from backend.modules.source.services.candidate_service import CandidateService
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.core.scheduler_jobs import run_missed_clockout_check, run_bimonthly_report

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

@app.on_event("startup")
async def start_background_workers():
    import backend.core.database as db
    db.main_loop = asyncio.get_running_loop()
    from backend.core.database import get_db_connection, create_tables

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SET search_path TO public')
            cur.execute("SELECT id FROM tenants")
            tenant_ids = [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

    print(f"[Startup] Running schema migration for {len(tenant_ids)} tenants: {tenant_ids}", flush=True)

    # Run create_tables() for every tenant as an idempotent migration.
    # This ensures any tables added to new code versions (e.g. bulk_upload_jobs)
    # are created in schemas that were provisioned before the code update.
    for t_id in tenant_ids:
        try:
            create_tables(schema_name=t_id)
            print(f"[Startup] Schema migration OK for {t_id}", flush=True)
        except Exception as e:
            print(f"[Startup] Schema migration FAILED for {t_id}: {e}", flush=True)

    for t_id in tenant_ids:
        svc = CandidateService(tenant_id=t_id)
        asyncio.create_task(svc.process_bulk_upload_queue())
        print(f"[Startup] Bulk-upload worker started for {t_id}", flush=True)

    # Start APScheduler tasks
    scheduler.add_job(run_missed_clockout_check, CronTrigger(hour="17,21", minute=0))
    scheduler.add_job(run_bimonthly_report, CronTrigger(hour=9, minute=0))
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_event():
    if scheduler.running:
        scheduler.shutdown()

# Include Modules
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(employees_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(assets_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(attendance_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(assessments_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(training_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(onboarding_router)
app.include_router(notifications_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(password_router)
app.include_router(payroll_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(admin_router)
app.include_router(org_router)
app.include_router(billing_router)
app.include_router(candidates_router, dependencies=[Depends(require_module("source"))])
app.include_router(jobs_router, dependencies=[Depends(require_module("source"))])
app.include_router(offers_router, dependencies=[Depends(require_module("source"))])

app.include_router(verify_builder_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_assignments_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_submissions_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_sandbox_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_queries_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_question_bank_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_live_monitor_router, dependencies=[Depends(require_module("verify"))])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
