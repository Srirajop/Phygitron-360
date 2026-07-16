"""
PHYGITRON 360 — Core Dependencies Re-export
============================================
Single import point for guards across the entire backend.

Usage in any module:
    from backend.core.dependencies import (
        get_current_user,
        require_permission,
        require_module,
        require_role,   # legacy shim — prefer require_permission
        P,              # permission key constants
    )
"""

from backend.core.auth import get_current_user  # noqa: F401
from backend.core.permissions import (          # noqa: F401
    P,
    DEFAULT_PERMISSIONS,
    require_permission,
    require_module,
    require_role,
)

__all__ = [
    "get_current_user",
    "P",
    "DEFAULT_PERMISSIONS",
    "require_permission",
    "require_module",
    "require_role",
]
