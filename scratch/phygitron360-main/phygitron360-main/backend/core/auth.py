"""
PHYGITRON 360 — Core Authentication Dependency
================================================
Provides get_current_user — the foundational FastAPI dependency that resolves
a session token to a user dict with permissions.

This module has NO dependency on any business-logic service class.
It accesses the DB directly to prevent circular imports.
"""

from __future__ import annotations
from fastapi import Request, HTTPException, Depends
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor
from datetime import datetime


_ROLE_ALIASES = {
    "admin": "org_admin",
    "administrator": "org_admin",
    "hr": "manager",
    "hr_manager": "manager",
    "management": "manager",
    "team_lead": "manager",
}


def _normalize_role(role: str) -> str:
    if not role:
        return role
    return _ROLE_ALIASES.get(role.lower(), role.lower())


def _normalize_roles(roles: list) -> list:
    if not roles:
        return []
    return list({_normalize_role(r) for r in roles if r})


def _resolve_permissions(user_id: int, roles: list, tenant_id: str, cur=None) -> dict:
    """
    Aggregates permissions from role_permissions table then applies
    user-level overrides from user_permissions. Returns {key: True} dict.
    """
    own_conn = False
    if cur is None:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        own_conn = True
        
    try:
        all_perms: set = set()
        cur.execute(f'SET search_path TO "{tenant_id}"')

        # 1. Role-based permissions
        for role in roles:
            cur.execute(
                "SELECT permission FROM role_permissions WHERE role = %s AND is_allowed = 1",
                (role,)
            )
            for row in cur.fetchall():
                all_perms.add(row["permission"])

        # 2. User-specific overrides (add or revoke)
        cur.execute(
            "SELECT permission, is_allowed FROM user_permissions WHERE user_id = %s",
            (user_id,)
        )
        for row in cur.fetchall():
            if row["is_allowed"]:
                all_perms.add(row["permission"])
            else:
                all_perms.discard(row["permission"])

        return {p: True for p in all_perms}
    except Exception:
        return {}
    finally:
        if own_conn:
            cur.close()
            conn.close()


def _resolve_tenant_modules(tenant_id: str, cur=None) -> list:
    """Returns the list of enabled modules for the given tenant."""
    if tenant_id == "public":
        return ["source", "forge", "verify", "deploy"]
        
    own_conn = False
    if cur is None:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        own_conn = True
        
    try:
        cur.execute("SET search_path TO public")
        cur.execute("SELECT modules_enabled FROM tenants WHERE id = %s", (tenant_id,))
        row = cur.fetchone()
        if row and row.get("modules_enabled"):
            return row["modules_enabled"]
        return ["source", "forge", "verify", "deploy"]
    except Exception:
        return ["source", "forge", "verify", "deploy"]
    finally:
        if own_conn:
            cur.close()
            conn.close()


def get_current_user(request: Request) -> dict:
    """
    Core FastAPI dependency. Resolves session_token cookie → authenticated user dict.

    Returns a dict containing:
      id, username, name, role, roles, tenant_id, employee_code,
      permissions (dict), modules_enabled (list)

    Raises 401 if no valid session is found.
    """
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Resolve token to session row (in public schema)
            cur.execute("SET search_path TO public")
            cur.execute(
                "SELECT user_id, tenant_id, expires_at FROM sessions WHERE session_token = %s",
                (session_token,)
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=401, detail="Session not found or expired.")

            # 2. Check expiry
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                except Exception:
                    pass
            if datetime.now() > expires_at:
                cur.execute("DELETE FROM sessions WHERE session_token = %s", (session_token,))
                conn.commit()
                raise HTTPException(status_code=401, detail="Session expired.")

            tenant_id = session.get("tenant_id") or "public"
            user_id   = session["user_id"]

            # 3. Resolve user from tenant schema
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute(
                """
                SELECT u.id, u.username, u.role, u.roles, u.employee_code, u.is_active,
                       e.name AS employee_name
                FROM users u
                LEFT JOIN employees e ON u.employee_code = e.employee_code
                WHERE u.id = %s
                """,
                (user_id,)
            )
            user_row = cur.fetchone()
            
            if not user_row:
                raise HTTPException(status_code=401, detail="User not found.")

            if not user_row.get("is_active", 1):
                raise HTTPException(status_code=403, detail="Account is deactivated.")

            raw_roles  = user_row.get("roles") or [user_row.get("role")]
            norm_roles = _normalize_roles(raw_roles)

            permissions    = _resolve_permissions(user_id, norm_roles, tenant_id, cur)
            modules_enabled = _resolve_tenant_modules(tenant_id, cur)
            
            # Fetch tenant company name
            company_name = tenant_id
            try:
                cur.execute("SET search_path TO public")
                cur.execute("SELECT company_name FROM tenants WHERE id = %s", (tenant_id,))
                row2 = cur.fetchone()
                if row2:
                    company_name = row2.get("company_name", tenant_id)
            except Exception:
                pass
                
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Authentication error.") from exc
    finally:
        conn.close()

    # SECURITY FIX: Tenant-level contractual restrictions must override seeded role permissions.
    # If the database granted 'module.forge.access' to org_admin but the tenant doesn't
    # have 'forge' enabled, we strip the access right entirely from the session.
    modules_lower = [m.lower() for m in modules_enabled]
    for mod in ["source", "forge", "verify", "deploy"]:
        perm_key = f"module.{mod}.access"
        if perm_key in permissions and mod not in modules_lower:
            del permissions[perm_key]

    return {
        "id":             user_row["id"],
        "username":       user_row["username"],
        "name":           user_row.get("employee_name") or user_row["username"],
        "role":           _normalize_role(user_row.get("role", "")),
        "roles":          norm_roles,
        "tenant_id":      tenant_id,
        "employee_code":  user_row.get("employee_code"),
        "permissions":    permissions,
        "modules_enabled": modules_enabled,
        "company_name":   company_name,
    }
