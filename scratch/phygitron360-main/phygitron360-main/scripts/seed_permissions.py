import sys
import os
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.database import get_db_connection
from backend.core.permissions import DEFAULT_PERMISSIONS

def sync_permissions():
    """
    Synchronizes the database role_permissions with the canonical 
    registry defined in backend/core/permissions.py.
    Runs across all active tenant schemas + public.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 1. Identify all managed namespaces (Public + Tenants)
        cur.execute("SELECT nspname FROM pg_namespace WHERE nspname = 'public' OR nspname LIKE 'tenant_%%'")
        schemas = [row[0] for row in cur.fetchall()]
        
        print(f"--- PHYGITRON PBAC SYNC ENGINE ---")
        print(f"Synchronizing {len(schemas)} schemas with core/permissions.py...")

        for schema in schemas:
            print(f" -> Synchronizing schema: {schema}")
            cur.execute(f'SET search_path TO "{schema}"')
            
            # Note: We use a strict sync for default roles. 
            # This ensures Overlord leaks and other PBAC issues are purged system-wide.
            cur.execute("DELETE FROM role_permissions")
            
            for role, perms in DEFAULT_PERMISSIONS.items():
                for perm in perms:
                    cur.execute(
                        "INSERT INTO role_permissions (role, permission, is_allowed) VALUES (%s, %s, 1)",
                        (role, perm)
                    )
            
        conn.commit()
        print(f"----------------------------------")
        print("SUCCESS: All schemas are now synchronized with the Permission Matrix.")
    except Exception as e:
        print(f"CRITICAL ERROR during synchronization: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    sync_permissions()
