from typing import List, Dict, Any, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class NotificationRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def create_notification(self, employee_code: Optional[str], title: str, message: str, n_type: str = 'Info', tenant_id: str = 'public', user_id: Optional[int] = None):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                cur.execute('''
                    INSERT INTO notifications (employee_code, user_id, title, message, type)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (employee_code, user_id, title, message, n_type))
                conn.commit()
        finally:
            conn.close()

    def get_notifications_for_user(self, employee_code: Optional[str] = None, tenant_id: str = 'public', limit: int = 10, unread_only: bool = False, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_path(cur, tenant_id)
                
                query = 'SELECT * FROM notifications WHERE 1=1'
                params = []
                
                if employee_code and user_id:
                    query += ' AND (employee_code = %s OR user_id = %s OR (employee_code IS NULL AND user_id IS NULL))'
                    params.extend([employee_code, user_id])
                elif employee_code:
                    query += ' AND (employee_code = %s OR employee_code IS NULL)'
                    params.append(employee_code)
                elif user_id:
                    query += ' AND user_id = %s'
                    params.append(user_id)
                else:
                    query += ' AND employee_code IS NULL AND user_id IS NULL'
                
                if unread_only:
                    query += ' AND is_read = 0'
                query += ' ORDER BY created_at DESC LIMIT %s'
                params.append(limit)
                
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_admin_notifications(self, tenant_id: str = 'public', limit: int = 15, unread_only: bool = False) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_path(cur, tenant_id)
                query = "SELECT * FROM notifications WHERE (employee_code IS NULL OR type = 'AdminAlert')"
                if unread_only:
                    query += ' AND is_read = 0'
                query += ' ORDER BY created_at DESC LIMIT %s'
                cur.execute(query, (limit,))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def mark_as_read(self, notification_id: int, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                cur.execute('UPDATE notifications SET is_read = 1 WHERE id = %s', (notification_id,))
                conn.commit()
        finally:
            conn.close()

    def mark_all_as_read(self, employee_code: Optional[str] = None, is_admin: bool = False, tenant_id: str = 'public', user_id: Optional[int] = None):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                if is_admin:
                    cur.execute('''
                        UPDATE notifications 
                        SET is_read = 1 
                        WHERE (employee_code = %s OR employee_code IS NULL OR type = 'AdminAlert') AND is_read = 0
                    ''', (employee_code,))
                elif user_id:
                    cur.execute('UPDATE notifications SET is_read = 1 WHERE user_id = %s AND is_read = 0', (user_id,))
                else:
                    cur.execute('UPDATE notifications SET is_read = 1 WHERE employee_code = %s AND is_read = 0', (employee_code,))
                conn.commit()
        finally:
            conn.close()

    def mark_notifications_by_query(self, title: str, message_part: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                cur.execute('''
                    UPDATE notifications 
                    SET is_read = 1 
                    WHERE title = %s AND message LIKE %s AND is_read = 0
                ''', (title, f'%{message_part}%'))
                conn.commit()
        finally:
            conn.close()

    def get_unread_count(self, employee_code: Optional[str] = None, is_admin: bool = False, tenant_id: str = 'public', user_id: Optional[int] = None) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                if is_admin:
                    cur.execute('''
                        SELECT count(*) FROM notifications 
                        WHERE (employee_code IS NULL OR type = 'AdminAlert') AND is_read = 0
                    ''')
                    row = cur.fetchone()
                elif user_id:
                    cur.execute('''
                        SELECT count(*) FROM notifications 
                        WHERE user_id = %s AND is_read = 0
                    ''', (user_id,))
                    row = cur.fetchone()
                else:
                    cur.execute('''
                        SELECT count(*) FROM notifications 
                        WHERE employee_code = %s AND is_read = 0
                    ''', (employee_code,))
                    row = cur.fetchone()
                return row[0] if row else 0
        finally:
            conn.close()

