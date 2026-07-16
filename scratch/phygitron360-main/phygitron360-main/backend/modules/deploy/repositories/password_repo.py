from backend.core.database import get_db_connection
from datetime import datetime
from typing import Dict, Any, Optional
from psycopg2.extras import RealDictCursor


class PasswordResetRepository:
    
    def get_user_by_email(self, email: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get user by email"""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                # Get from users table
                cur.execute("""
                    SELECT u.*, e.name 
                    FROM users u
                    LEFT JOIN employees e ON u.employee_code = e.employee_code
                    WHERE u.username = %s
                """, (email,))
                
                user_row = cur.fetchone()
                return dict(user_row) if user_row else None
        finally:
            conn.close()
    
    def get_employee_by_code(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get employee by code"""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("SELECT * FROM employees WHERE employee_code = %s", (employee_code,))
                employee = cur.fetchone()
                return dict(employee) if employee else None
        finally:
            conn.close()
    
    def create_reset_token(self, token_data: Dict[str, Any], tenant_id: str = 'public') -> None:
        """Create password reset token"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    INSERT INTO password_reset_tokens 
                    (email, token, expires_at, reset_type, created_by)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    token_data['email'],
                    token_data['token'],
                    token_data['expires_at'],
                    token_data.get('reset_type', 'self'),
                    token_data.get('created_by')
                ))
                conn.commit()
        finally:
            conn.close()
    
    def get_reset_token(self, token: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get reset token by token string"""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    SELECT * FROM password_reset_tokens 
                    WHERE token = %s
                """, (token,))
                
                token_row = cur.fetchone()
                return dict(token_row) if token_row else None
        finally:
            conn.close()
    
    def invalidate_existing_tokens(self, email: str, tenant_id: str = 'public') -> None:
        """Mark all existing tokens for email as used"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    UPDATE password_reset_tokens 
                    SET used = 1, used_at = CURRENT_TIMESTAMP
                    WHERE email = %s AND used = 0
                """, (email,))
                conn.commit()
        finally:
            conn.close()
    
    def mark_token_used(self, token: str, tenant_id: str = 'public') -> None:
        """Mark token as used"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    UPDATE password_reset_tokens 
                    SET used = 1, used_at = CURRENT_TIMESTAMP
                    WHERE token = %s
                """, (token,))
                conn.commit()
        finally:
            conn.close()
    
    def update_password(
        self, 
        email: str, 
        password_hash: str, 
        changed_by: str,
        must_change: bool = False,
        tenant_id: str = 'public'
    ) -> None:
        """Update user password"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    UPDATE users 
                    SET password_hash = %s,
                        password_changed_at = CURRENT_TIMESTAMP,
                        password_changed_by = %s,
                        password_must_change = %s
                    WHERE username = %s
                """, (password_hash, changed_by, 1 if must_change else 0, email))
                conn.commit()
        finally:
            conn.close()

