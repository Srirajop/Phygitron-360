from fastapi import APIRouter, HTTPException, Response, Request, Depends
from psycopg2.extras import RealDictCursor

from backend.modules.deploy.services.auth_service import AuthService
from backend.modules.deploy.schemas.auth import LoginRequest, RegisterCompanyRequest, DemoRequestModel
from backend.core.database import create_tables, get_db_connection

# Guards are now canonically defined in backend.core — re-exported here for
# backward compatibility with any remaining imports from this module.
from backend.core.dependencies import (  # noqa: F401
    get_current_user,
    require_permission,
    require_module,
    require_role,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def get_service():
    return AuthService()

# --- Endpoints ---

from backend.modules.admin.services.admin_service import AdminService

@router.post("/register-company")
def register_company(data: RegisterCompanyRequest, service: AuthService = Depends(get_service)):
    try:
        # Use AdminService to handle the heavy lifting including email dispatch
        admin_service = AdminService(tenant_id='public')
        result = admin_service.provision_tenant(
            data.company_name, 
            data.admin_email, 
            data.admin_password, 
            actor="Self Registration"
        )
        
        return {
            "success": True, 
            "message": "Company Workspace Created and Welcome Email Dispatched", 
            "workspace_id": result['workspace_id'],
            "subdomain": result['subdomain'],
            "workspace_url": f"http://{result['subdomain']}.localhost:5173/login"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
def login(credentials: LoginRequest, response: Response, service: AuthService = Depends(get_service)):
    try:
        tenant_context = credentials.workspace_id or 'public'
        
        if tenant_context != 'public' and not tenant_context.startswith('tenant_'):
            # resolve from subdomain
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SET search_path TO public")
                    cur.execute("SELECT id FROM tenants WHERE subdomain = %s", (tenant_context,))
                    row = cur.fetchone()
                    if row:
                        tenant_context = row[0]
                    else:
                        raise ValueError("Invalid workspace/subdomain")
            finally:
                conn.close()

        result = service.login(credentials.username, credentials.password, tenant_id=tenant_context)
        if not result:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=result['token'],
            httponly=True,
            max_age=86400,  # 24 hours
            samesite="lax",
            path="/"
        )
        
        return {
            "success": True,
            "message": "Login successful",
            "user": result['user']
        }
    except ValueError as e: # Account deactivated
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
def logout(request: Request, response: Response, service: AuthService = Depends(get_service)):
    token = request.cookies.get("session_token")
    if token:
        service.logout(token)
    
    response.delete_cookie("session_token", path="/", samesite="lax")
    return {"success": True, "message": "Logged out successfully"}

@router.post("/request-demo")
def request_demo(data: DemoRequestModel):
    # 1. Work Email Validation (Block Personal Domains)
    personal_domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com']
    email_domain = data.work_email.split('@')[-1].lower() if '@' in data.work_email else ""
    
    if email_domain in personal_domains:
        raise HTTPException(
            status_code=400, 
            detail="Please use a work email address. Personal email domains (Gmail, Yahoo, etc.) are not accepted for demo requests."
        )

    # 2. Save to Database (Public Schema)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO public")
            cur.execute("""
                INSERT INTO demo_requests (
                    company_name, contact_name, work_email, job_title, 
                    company_size, modules_requested, current_tools, 
                    discovery_source, message
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data.company_name, data.contact_name, data.work_email, data.job_title,
                data.company_size, data.modules_requested, data.current_tools, 
                data.discovery_source, data.message
            ))
            conn.commit()
            
            # 3. Trigger Notification (Internal)
            # In a real app, we'd send an email to the superadmin here.
            # For now, we log it. If EmailService is configured, we can use it.
            return {"success": True, "message": "Demo request received! Our team will reach out shortly."}
    except Exception as e:
        if "unique_violation" in str(e).lower() or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="A demo request has already been submitted for this email address.")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/demo-requests", dependencies=[Depends(require_permission("manage_system"))])
def get_demo_requests():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET search_path TO public")
            cur.execute("SELECT * FROM demo_requests ORDER BY created_at DESC")
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()

@router.get("/me")

def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "user": current_user
    }


@router.get("/check")
def check_auth(request: Request, service: AuthService = Depends(get_service)):
    token = request.cookies.get("session_token")
    user = service.get_session_user(token)
    
    if not user:
        return {"authenticated": False}
    
    return {
        "authenticated": True,
        "user": user
    }
