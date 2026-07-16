"""
PHYGITRON 360 — Core Permission System
========================================
Single source of truth for:
  - Permission key constants (class P)
  - Default role → permission seed matrix
  - FastAPI dependency guards:
      require_permission(key)  → PBAC gate
      require_module(module)   → module access gate
      require_role(roles)      → legacy RBAC shim (prefer require_permission)
"""

from __future__ import annotations
from typing import List, Dict, Callable
from fastapi import Depends, HTTPException
from backend.core.auth import get_current_user


# ---------------------------------------------------------------------------
# Permission Key Registry
# All permission keys used anywhere in the platform are declared here.
# Modules are responsible for nothing but importing these; no magic strings.
# ---------------------------------------------------------------------------

class P:
    """Canonical permission key constants. Use P.XXX everywhere — never raw strings."""

    # ── Module-level access gates ───────────────────────────────────────────
    MODULE_SOURCE_ACCESS  = "module.source.access"
    MODULE_FORGE_ACCESS   = "module.forge.access"
    MODULE_VERIFY_ACCESS  = "module.verify.access"
    MODULE_DEPLOY_ACCESS  = "module.deploy.access"

    # ── Platform / Admin ────────────────────────────────────────────────────
    MANAGE_SYSTEM         = "manage_system"
    VIEW_REPORTS          = "view_reports"
    MANAGE_OPS            = "manage_ops"
    ADMIN_USERS_MANAGE    = "admin.users.manage"
    ADMIN_ROLES_MANAGE    = "admin.roles.manage"  # Manage role-level permission overrides

    # ── Deploy: Employees ────────────────────────────────────────────────────
    DEPLOY_EMP_VIEW       = "deploy.employees.view"
    DEPLOY_EMP_CREATE     = "deploy.employees.create"
    DEPLOY_EMP_EDIT       = "deploy.employees.edit"
    DEPLOY_EMP_DELETE     = "deploy.employees.delete"
    DEPLOY_EMP_OFFBOARD   = "deploy.employees.offboard"

    # ── Deploy: Assets ───────────────────────────────────────────────────────
    DEPLOY_ASSETS_VIEW    = "deploy.assets.view"
    DEPLOY_ASSETS_MANAGE  = "deploy.assets.manage"

    # ── Deploy: Attendance ───────────────────────────────────────────────────
    DEPLOY_ATT_PERSONAL   = "deploy.attendance.view_personal"
    DEPLOY_ATT_TEAM       = "deploy.attendance.view_team"
    DEPLOY_ATT_MANAGE     = "deploy.attendance.manage"

    # ── Deploy: Onboarding ───────────────────────────────────────────────────
    DEPLOY_ONBOARD_VIEW   = "deploy.onboarding.view"
    DEPLOY_ONBOARD_MANAGE = "deploy.onboarding.manage"

    # ── Deploy: Learning / Performance ───────────────────────────────────────
    DEPLOY_ASSESS_VIEW    = "deploy.assessments.view"
    DEPLOY_ASSESS_MANAGE  = "deploy.assessments.manage"
    DEPLOY_TRAIN_VIEW     = "deploy.training.view"
    DEPLOY_TRAIN_MANAGE   = "deploy.training.manage"
    DEPLOY_PERF_VIEW      = "deploy.performance.view"
    DEPLOY_PERF_MANAGE    = "deploy.performance.manage"

    # ── Deploy: Dashboard / Notifications ────────────────────────────────────
    DEPLOY_DASH_ADMIN     = "deploy.dashboard.view_admin"
    DEPLOY_NOTIF_ADMIN    = "deploy.notifications.view_admin"
    DEPLOY_NOTIF_MANAGE   = "deploy.notifications.manage"

    # ── Deploy: Payroll ──────────────────────────────────────────────────────
    DEPLOY_PAYROLL_VIEW   = "deploy.payroll.view"
    DEPLOY_PAYROLL_MANAGE = "deploy.payroll.manage"

    # ── Source: Jobs ─────────────────────────────────────────────────────────
    SOURCE_JOBS_VIEW      = "source.jobs.view"
    SOURCE_JOBS_MANAGE    = "source.jobs.manage"

    # ── Source: Candidates ───────────────────────────────────────────────────
    SOURCE_CANDIDATES_VIEW   = "source.candidates.view"
    SOURCE_CANDIDATES_MANAGE = "source.candidates.manage"

    # ── Verify: Assessments ──────────────────────────────────────────────────
    VERIFY_ASSESS_VIEW        = "verify.assessments.view"
    VERIFY_ASSESS_MANAGE      = "verify.assessments.manage"
    VERIFY_ASSESS_ASSIGN      = "verify.assessments.assign"
    VERIFY_ASSESS_VIEW_RESULTS = "verify.assessments.view_results"

    # ── Verify: Submissions ──────────────────────────────────────────────────
    VERIFY_SUBMISSIONS_MANAGE = "verify.submissions.manage"

    # ── Forge (future) ───────────────────────────────────────────────────────
    FORGE_COURSES_VIEW    = "forge.courses.view"
    FORGE_COURSES_MANAGE  = "forge.courses.manage"
    FORGE_ENROLL          = "forge.courses.enroll"


# ---------------------------------------------------------------------------
# Default Role → Permission Seed Matrix
# Seeded when a new tenant workspace is provisioned.
# super_admin is a platform-level role and is NOT seeded — it gets a
# hardcoded bypass in the guards for platform integrity.
# ---------------------------------------------------------------------------

DEFAULT_PERMISSIONS: Dict[str, List[str]] = {
    "org_admin": [
        # Full platform access
        P.MODULE_SOURCE_ACCESS, P.MODULE_FORGE_ACCESS,
        P.MODULE_VERIFY_ACCESS, P.MODULE_DEPLOY_ACCESS,
        # Admin
        P.VIEW_REPORTS, P.MANAGE_OPS, P.ADMIN_USERS_MANAGE, P.ADMIN_ROLES_MANAGE,
        # Deploy: Employees
        P.DEPLOY_EMP_VIEW, P.DEPLOY_EMP_CREATE, P.DEPLOY_EMP_EDIT,
        P.DEPLOY_EMP_DELETE, P.DEPLOY_EMP_OFFBOARD,
        # Deploy: Assets
        P.DEPLOY_ASSETS_VIEW, P.DEPLOY_ASSETS_MANAGE,
        # Deploy: Attendance
        P.DEPLOY_ATT_PERSONAL, P.DEPLOY_ATT_TEAM, P.DEPLOY_ATT_MANAGE,
        # Deploy: Onboarding
        P.DEPLOY_ONBOARD_VIEW, P.DEPLOY_ONBOARD_MANAGE,
        # Deploy: Learning / Performance
        P.DEPLOY_ASSESS_VIEW, P.DEPLOY_ASSESS_MANAGE,
        P.DEPLOY_TRAIN_VIEW, P.DEPLOY_TRAIN_MANAGE,
        P.DEPLOY_PERF_VIEW, P.DEPLOY_PERF_MANAGE,
        # Deploy: Dashboard / Notifications
        P.DEPLOY_DASH_ADMIN, P.DEPLOY_NOTIF_ADMIN, P.DEPLOY_NOTIF_MANAGE,
        # Deploy: Payroll
        P.DEPLOY_PAYROLL_VIEW, P.DEPLOY_PAYROLL_MANAGE,
        # Source
        P.SOURCE_JOBS_VIEW, P.SOURCE_JOBS_MANAGE,
        P.SOURCE_CANDIDATES_VIEW, P.SOURCE_CANDIDATES_MANAGE,
        # Verify
        P.VERIFY_ASSESS_VIEW, P.VERIFY_ASSESS_MANAGE,
        P.VERIFY_ASSESS_ASSIGN, P.VERIFY_ASSESS_VIEW_RESULTS,
        P.VERIFY_SUBMISSIONS_MANAGE,
        # Forge
        P.FORGE_COURSES_VIEW, P.FORGE_COURSES_MANAGE, P.FORGE_ENROLL,
    ],
    "manager": [
        P.MODULE_SOURCE_ACCESS, P.MODULE_FORGE_ACCESS,
        P.MODULE_VERIFY_ACCESS, P.MODULE_DEPLOY_ACCESS,
        P.VIEW_REPORTS,
        # Deploy: Employees (no delete/offboard)
        P.DEPLOY_EMP_VIEW, P.DEPLOY_EMP_CREATE, P.DEPLOY_EMP_EDIT,
        # Deploy: Assets
        P.DEPLOY_ASSETS_VIEW,
        # Deploy: Attendance
        P.DEPLOY_ATT_PERSONAL, P.DEPLOY_ATT_TEAM,
        # Deploy: Onboarding
        P.DEPLOY_ONBOARD_VIEW,
        # Deploy: Learning / Performance
        P.DEPLOY_ASSESS_VIEW, P.DEPLOY_ASSESS_MANAGE,
        P.DEPLOY_TRAIN_VIEW,
        P.DEPLOY_PERF_VIEW, P.DEPLOY_PERF_MANAGE,
        # Deploy: Dashboard / Notifications
        P.DEPLOY_DASH_ADMIN, P.DEPLOY_NOTIF_ADMIN,
        # Deploy: Payroll
        P.DEPLOY_PAYROLL_VIEW, P.DEPLOY_PAYROLL_MANAGE,
        # Source
        P.SOURCE_JOBS_VIEW, P.SOURCE_JOBS_MANAGE,
        P.SOURCE_CANDIDATES_VIEW,
        # Verify
        P.VERIFY_ASSESS_VIEW, P.VERIFY_ASSESS_ASSIGN,
        P.VERIFY_ASSESS_VIEW_RESULTS,
        # Forge
        P.FORGE_COURSES_VIEW, P.FORGE_ENROLL,
    ],
    "employee": [
        P.MODULE_FORGE_ACCESS, P.MODULE_DEPLOY_ACCESS,
        # Deploy: personal access only
        P.DEPLOY_EMP_VIEW,           # view own profile in directory lookup
        P.DEPLOY_ATT_PERSONAL,       # clock in/out, view own history
        P.DEPLOY_PERF_VIEW,          # view own KRA scorecard
        P.DEPLOY_ASSESS_VIEW,        # view / submit assigned assessments
        P.DEPLOY_TRAIN_VIEW,         # view own training assignments
        P.DEPLOY_PAYROLL_VIEW,       # view own payslips
        # Verify: take tests assigned to them
        P.VERIFY_ASSESS_VIEW,
        # Forge: learn
        P.FORGE_COURSES_VIEW, P.FORGE_ENROLL,
    ],
    "candidate": [
        P.MODULE_VERIFY_ACCESS,
        P.MODULE_SOURCE_ACCESS,
        # Can view jobs and submit tests assigned to them
        P.SOURCE_JOBS_VIEW,
        P.VERIFY_ASSESS_VIEW,
    ],
}


# ---------------------------------------------------------------------------
# FastAPI Dependency Factories
# ---------------------------------------------------------------------------

def _get_user_roles(user: dict) -> List[str]:
    """Normalizes the user's roles from the session dict."""
    raw = user.get("roles") or [user.get("role")]
    return [r.lower() for r in raw if r]


def _is_platform_admin(user_roles: List[str]) -> bool:
    """Returns True only for super_admin — full cross-tenant bypass."""
    return "super_admin" in user_roles or "superadmin" in user_roles


def require_permission(permission_key: str) -> Callable:
    """
    FastAPI dependency factory — PBAC gate.

    Grants access if:
      1. User is super_admin (hardcoded platform bypass), OR
      2. The permission_key exists and is True in user['permissions']

    NOTE: org_admin access is NOT hardcoded here — it is seeded in
    DEFAULT_PERMISSIONS above, so it flows through normal permission lookup.
    This keeps the system fully auditable.
    """
    def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_roles = _get_user_roles(current_user)

        # Platform-level bypass — super_admin only
        if _is_platform_admin(user_roles):
            return current_user

        # Check granular permission
        perms = current_user.get("permissions", {})
        if isinstance(perms, list):
            # Legacy list format — treat as set of allowed keys
            has_access = permission_key in perms
        elif isinstance(perms, dict):
            has_access = bool(perms.get(permission_key, False))
        else:
            has_access = False

        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: missing clearance '{permission_key}'."
            )
        return current_user
    return permission_checker


def require_module(module_name: str) -> Callable:
    """
    FastAPI dependency factory — module access gate.

    Checks that the resolved module.{name}.access permission is present.
    Falls back to checking modules_enabled list in session if permission
    key is not present (backward compat during migration window).
    """
    perm_key = f"module.{module_name}.access"

    def module_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_roles = _get_user_roles(current_user)

        # Platform-level bypass
        if _is_platform_admin(user_roles):
            return current_user

        # Primary: permission-based check
        perms = current_user.get("permissions", {})
        if isinstance(perms, list):
            has_access = perm_key in perms
        elif isinstance(perms, dict):
            has_access = bool(perms.get(perm_key, False))
        else:
            has_access = False

        # Fallback: legacy modules_enabled list (will be removed in future)
        if not has_access:
            enabled = current_user.get("modules_enabled", [])
            has_access = module_name.lower() in [m.lower() for m in enabled]

        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Module '{module_name}' is not available in your workspace."
            )
        return current_user
    return module_checker


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Legacy RBAC shim — retained for backward compatibility during full migration.
    Prefer require_permission() for all new code.

    Will emit a deprecation warning when called.
    """
    import warnings

    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        warnings.warn(
            f"require_role({allowed_roles!r}) is deprecated. "
            "Migrate to require_permission() with a specific key.",
            DeprecationWarning,
            stacklevel=2
        )
        user_roles = _get_user_roles(current_user)

        if _is_platform_admin(user_roles):
            return current_user

        allowed_lower = [r.lower() for r in allowed_roles]
        # org_admin gets access to everything a manager/employee/candidate can do
        if "org_admin" in user_roles and any(
            r in allowed_lower for r in ["org_admin", "manager", "employee", "candidate"]
        ):
            return current_user

        if not any(r in allowed_lower for r in user_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
