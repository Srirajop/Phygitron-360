from fastapi import APIRouter, HTTPException, Depends, Body
from backend.modules.deploy.services.password_service import PasswordService
from backend.core.dependencies import get_current_user, require_permission
from pydantic import BaseModel, EmailStr


router = APIRouter(prefix="/api/auth", tags=["password-reset"])


# Pydantic models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    workspace_id: str = "public"


class VerifyTokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class AdminResetRequest(BaseModel):
    employee_code: str
    reset_type: str  # 'temp_password' or 'reset_link'


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def get_service():
    return PasswordService()


@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    service: PasswordService = Depends(get_service)
):
    """
    User requests password reset (forgot password).
    Always returns success to prevent email enumeration.
    """
    try:
        # Sanitize workspace_id: fallback to public if empty or invalid
        workspace_id = request.workspace_id or "public"
        if workspace_id in ["localhost", "127.0.0.1"] or workspace_id.replace(".", "").isdigit():
            workspace_id = "public"
            
        # Resolve subdomain to actual tenant schema ID
        tenant_context = workspace_id
        if tenant_context != 'public' and not tenant_context.startswith('tenant_'):
            from backend.core.database import get_db_connection
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SET search_path TO public")
                    cur.execute("SELECT id FROM tenants WHERE subdomain = %s", (tenant_context,))
                    row = cur.fetchone()
                    if row:
                        tenant_context = row[0]
                    else:
                        # If invalid workspace, pretend success to prevent enum
                        return {"success": True, "message": "If an account exists with this email, a password reset link has been sent."}
            finally:
                conn.close()
                
        result = service.request_password_reset(request.email, tenant_context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-reset-token")
def verify_reset_token(
    request: VerifyTokenRequest,
    service: PasswordService = Depends(get_service)
):
    """Verify if password reset token is valid"""
    try:
        result = service.verify_reset_token(request.token)
        if not result['valid']:
            raise HTTPException(status_code=400, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    service: PasswordService = Depends(get_service)
):
    """Reset password using token"""
    try:
        result = service.reset_password(request.token, request.new_password)
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin-reset-password", dependencies=[Depends(require_permission("deploy.employees.edit"))])
def admin_reset_password(
    request: AdminResetRequest,
    current_user: dict = Depends(get_current_user),
    service: PasswordService = Depends(get_service)
):
    """
    Admin/HR resets employee password.
    Returns temp password or sends reset link based on reset_type.
    """
    try:
        admin_email = current_user.get('username', 'Admin')
        tenant_id = current_user.get('tenant_id', 'public')
        result = service.admin_reset_password(
            employee_code=request.employee_code,
            reset_type=request.reset_type,
            admin_email=admin_email,
            tenant_id=tenant_id
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    service: PasswordService = Depends(get_service)
):
    """Change password for logged-in user"""
    try:
        email = current_user.get('username')
        if not email:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        tenant_id = current_user.get('tenant_id', 'public')
        result = service.change_password_logged_in(
            email=email,
            current_password=request.current_password,
            new_password=request.new_password,
            tenant_id=tenant_id
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-must-change-password")
def check_must_change_password(
    current_user: dict = Depends(get_current_user),
    service: PasswordService = Depends(get_service)
):
    """Check if user must change password"""
    try:
        email = current_user.get('username')
        tenant_id = current_user.get('tenant_id', 'public')
        must_change = service.check_must_change_password(email, tenant_id=tenant_id)
        return {"must_change": must_change}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
