from typing import Optional, Dict, Any, List
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor
from datetime import datetime

class UserRepository:
    def get_user_by_username(self, username: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    SELECT u.*, e.name as employee_name
                    FROM users u
                    LEFT JOIN employees e ON u.employee_code = e.employee_code
                    WHERE u.username = %s
                """, (username,))
                row = cur.fetchone()
                if row:
                    res = dict(row)
                    # Use roles array but fallback to singular role
                    res['roles'] = res.get('roles') or ([res['role']] if res.get('role') else [])
                    return res
                return None
        finally:
            conn.close()

    def get_user_by_id(self, user_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    SELECT u.*, e.name as employee_name
                    FROM users u
                    LEFT JOIN employees e ON u.employee_code = e.employee_code
                    WHERE u.id = %s
                """, (user_id,))
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def create_user(self, username: str, password_hash: str, role: str, employee_code: Optional[str] = None, tenant_id: str = 'public', is_active: int = 1):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute(
                    """
                    INSERT INTO users (username, password_hash, role, roles, employee_code, password_must_change, is_active) 
                    VALUES (%s, %s, %s, %s, %s, 1, %s)
                    ON CONFLICT (username) 
                    DO UPDATE SET 
                        password_hash = EXCLUDED.password_hash,
                        role = EXCLUDED.role,
                        roles = EXCLUDED.roles,
                        employee_code = EXCLUDED.employee_code,
                        password_must_change = EXCLUDED.password_must_change,
                        is_active = EXCLUDED.is_active
                    """,
                    (username, password_hash, role[0] if isinstance(role, list) else role, role if isinstance(role, list) else [role], employee_code, is_active)
                )
                conn.commit()
        finally:
            conn.close()

    def update_password(self, username: str, new_hash: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("UPDATE users SET password_hash = %s WHERE username = %s", (new_hash, username))
                conn.commit()
        finally:
            conn.close()

    def update_last_login(self, username: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = %s", (username,))
                conn.commit()
        finally:
            conn.close()

    def get_all_users(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("SELECT * FROM users")
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def delete_user(self, username: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("DELETE FROM users WHERE username = %s", (username,))
                conn.commit()
        finally:
            conn.close()
            
    def get_user_permissions(self, user_id: int, roles: List[str], tenant_id: str = 'public') -> Dict[str, bool]:
        conn = get_db_connection()
        try:
            # Aggregate permissions across ALL roles
            all_perms = set()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                for role in roles:
                    cur.execute("SELECT permission FROM role_permissions WHERE role = %s AND is_allowed = 1", (role,))
                    rows_role = cur.fetchall()
                    for r in rows_role:
                        all_perms.add(r['permission'])
                
                # Apply user-specific overrides
                cur.execute("SELECT permission, is_allowed FROM user_permissions WHERE user_id = %s", (user_id,))
                rows_user = cur.fetchall()
                for r in rows_user:
                    if r['is_allowed']:
                        all_perms.add(r['permission'])
                    else:
                        all_perms.discard(r['permission'])
                        
                return {p: True for p in all_perms}
        finally:
            conn.close()

    # Session Management
    def create_session(self, session_token: str, user_id: int, expires_at: datetime, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
             with conn.cursor() as cur:
                 cur.execute(f'SET search_path TO public')
                 cur.execute("INSERT INTO sessions (session_token, user_id, tenant_id, expires_at) VALUES (%s, %s, %s, %s)", 
                              (session_token, user_id, tenant_id, expires_at))
                 conn.commit()
        finally:
              conn.close()

    def get_session_with_user(self, session_token: str):
        conn = get_db_connection()
        try:
             with conn.cursor(cursor_factory=RealDictCursor) as cur:
                 # 1. Resolve session to get user_id AND tenant_id from public table
                 cur.execute("SET search_path TO public")
                 cur.execute("SELECT * FROM sessions WHERE session_token = %s", (session_token,))
                 session_row = cur.fetchone()
                 if not session_row:
                     return None
                 
                 tenant_id = session_row['tenant_id'] or 'public'
                 
                 # 2. Extract user info from specific tenant schema
                 cur.execute(f'SET search_path TO "{tenant_id}"')
                 cur.execute("""
                    SELECT u.id as user_id, u.username, u.role, u.roles, u.employee_code, u.is_active, e.name as employee_name
                    FROM users u
                    LEFT JOIN employees e ON u.employee_code = e.employee_code
                    WHERE u.id = %s
                 """, (session_row['user_id'],))
                 user_row = cur.fetchone()
                 
                 if not user_row:
                     return None
                     
                 # Combine session data with user details
                 final_result = dict(session_row)
                 final_result.update(dict(user_row))
                 return final_result
        finally:
              conn.close()

    def delete_session(self, session_token: str):
        conn = get_db_connection()
        try:
             with conn.cursor() as cur:
                 cur.execute("SET search_path TO public")
                 cur.execute("DELETE FROM sessions WHERE session_token = %s", (session_token,))
                 conn.commit()
        finally:
            conn.close()


    def update_username(self, user_id: int, new_username: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("UPDATE users SET username = %s WHERE id = %s", (new_username, user_id))
                conn.commit()
        finally:
            conn.close()
