import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from backend.modules.deploy.repositories.user_repo import UserRepository
from passlib.hash import pbkdf2_sha256

# Removed in-memory ACTIVE_SESSIONS, now using DB sessions table via UserRepository

ROLE_ALIASES = {
    'admin': 'org_admin',
    'hr': 'manager',
    'hr_manager': 'manager',
    'management': 'manager',
    'team_lead': 'manager',
    'employee': 'employee',
}

def _resolve_role(role: str) -> str:
    if not role:
        return role
    return ROLE_ALIASES.get(role.lower(), role)

def _resolve_roles(roles: list) -> list:
    if not roles:
        return roles
    return list(set([_resolve_role(r) for r in roles if r]))


class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    def get_password_hash(self, password: str) -> str:
        return pbkdf2_sha256.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pbkdf2_sha256.verify(plain_password, hashed_password)

    def create_session_token(self) -> str:
        return secrets.token_urlsafe(32)

    def login(self, username: str, password: str, tenant_id: str = 'public') -> Optional[dict]:
        user = self.repo.get_user_by_username(username, tenant_id=tenant_id)
        if not user:
            return None
        
        if not user['is_active']:
            raise ValueError("Account is deactivated")
        
        if not self.verify_password(password, user['password_hash']):
            return None
        
        # Update Last Login
        self.repo.update_last_login(username, tenant_id=tenant_id)
        
        # Create Session
        token = self.create_session_token()
        expires = datetime.now() + timedelta(days=1)
        
        # Persistent Session in DB
        self.repo.create_session(token, user['id'], expires, tenant_id=tenant_id)
        
        # Resolve tenant modules
        modules_enabled = self._get_tenant_modules(tenant_id)
        
        resolved_role = _resolve_role(user['role'])
        resolved_roles = _resolve_roles(user['roles'])

        user_info = {
            "id": user['id'],
            "username": user['username'],
            "name": user.get('employee_name') or user['username'],
            "role": resolved_role,
            "roles": resolved_roles,
            "tenant_id": tenant_id,
            "employee_code": user['employee_code'],
            "permissions": self.repo.get_user_permissions(user['id'], user['roles'], tenant_id=tenant_id),
            "modules_enabled": modules_enabled,
            "password_must_change": bool(user.get('password_must_change', 0))
        }
        
        return {"token": token, "user": user_info, "expires": expires}

    def _get_tenant_modules(self, tenant_id: str) -> list:
        """Resolve which modules this tenant has access to from public.tenants."""
        if tenant_id == 'public':
            return ['source', 'forge', 'verify', 'deploy']
        
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO public")
                cur.execute("SELECT modules_enabled FROM tenants WHERE id = %s", (tenant_id,))
                row = cur.fetchone()
                if row and row[0]:
                    return row[0]
                return ['source', 'forge', 'verify', 'deploy']
        except:
            return ['source', 'forge', 'verify', 'deploy']
        finally:
            conn.close()

    def logout(self, token: str):
        if token:
            self.repo.delete_session(token)

    def get_session_user(self, token: str) -> Optional[dict]:
        if not token:
            return None
            
        session = self.repo.get_session_with_user(token)
        if not session:
            return None
            
        # Check Expiration
        expires_at = session['expires_at']
        if isinstance(expires_at, str):
            # Try to handle string if returned (though PG should return datetime)
            try:
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            except:
                pass
        
        if datetime.now() > expires_at:
            self.repo.delete_session(token)
            return None
            
        if not session.get('is_active', 1):
            return None
            
        tenant_id = session.get('tenant_id', 'public')
        modules_enabled = self._get_tenant_modules(tenant_id)
        
        resolved_role = _resolve_role(session['role'])
        resolved_roles = _resolve_roles(session.get('roles') or [session['role']])
        
        return {
            "id": session['user_id'],
            "tenant_id": tenant_id,
            "username": session['username'],
            "name": session.get('employee_name') or session['username'],
            "role": resolved_role,
            "roles": resolved_roles,
            "employee_code": session['employee_code'],
            "permissions": self.repo.get_user_permissions(session['user_id'], session.get('roles') or [session['role']], tenant_id=tenant_id),
            "modules_enabled": modules_enabled
        }

    def create_user(self, username: str, password: str, role: str, employee_code: str = None) -> dict:
        existing = self.repo.get_user_by_username(username)
        if existing:
            raise ValueError(f"User {username} already exists")
            
        password_hash = self.get_password_hash(password)
        self.repo.create_user(username, password_hash, role, employee_code)
        
        return {"success": True, "message": f"User {username} created successfully"}

    def delete_user(self, username: str):
        existing = self.repo.get_user_by_username(username)
        if not existing:
             raise ValueError("User not found")
        self.repo.delete_user(username)
        return True

