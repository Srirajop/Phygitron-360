from typing import Dict, Any, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AssetRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_asset_checklist(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
             cur = conn.cursor(cursor_factory=RealDictCursor)
             self._set_path(cur, tenant_id)
             cur.execute("SELECT * FROM assets WHERE employee_code = %s", (employee_code,))
             row = cur.fetchone()
             return dict(row) if row else None
        finally:
            conn.close()

    def get_employee_defaults(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT pf_included, mediclaim_included FROM employees WHERE employee_code = %s", (employee_code,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def check_exists(self, employee_code: str, tenant_id: str = 'public') -> bool:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("SELECT 1 FROM assets WHERE employee_code = %s", (employee_code,))
            return cur.fetchone() is not None
        finally:
            conn.close()

    def update_asset_checklist(self, employee_code: str, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE assets SET 
                    ob_laptop=%s, ob_laptop_bag=%s, ob_headphones=%s, ob_mouse=%s, 
                    ob_extra_hardware=%s, ob_client_assets=%s, 
                    ob_id_card=%s, ob_email_access=%s, ob_groups=%s, ob_mediclaim=%s, ob_pf=%s,
                    ob_remarks=%s,
 
                    cl_laptop=%s, cl_laptop_bag=%s, cl_headphones=%s, cl_mouse=%s, 
                    cl_extra_hardware=%s, cl_client_assets=%s, 
                    cl_id_card=%s, cl_email_access=%s, cl_groups=%s, cl_relieving_letter=%s,
                    cl_remarks=%s,
                    
                    updated_at=CURRENT_TIMESTAMP
                WHERE employee_code = %s
            ''', (
                # Onboarding
                data.get('ob_laptop', 0), data.get('ob_laptop_bag', 0), 
                data.get('ob_headphones', 0), data.get('ob_mouse', 0),
                data.get('ob_extra_hardware', 0), data.get('ob_client_assets', 0), 
                
                data.get('ob_id_card', 0), data.get('ob_email_access', 0),
                data.get('ob_groups', 0), data.get('ob_mediclaim', 0), data.get('ob_pf', 0),
                
                data.get('ob_remarks', ''),
                
                # Clearance
                data.get('cl_laptop', 0), data.get('cl_laptop_bag', 0), 
                data.get('cl_headphones', 0), data.get('cl_mouse', 0),
                data.get('cl_extra_hardware', 0), data.get('cl_client_assets', 0), 
                
                data.get('cl_id_card', 0), data.get('cl_email_access', 0),
                data.get('cl_groups', 0), data.get('cl_relieving_letter', 0),
                
                data.get('cl_remarks', ''),
                
                employee_code
            ))
            conn.commit()
        finally:
            conn.close()

    def update_asset_fields(self, employee_code: str, fields: list, values: list, tenant_id: str = 'public'):
        if not fields:
            return
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            values.append(employee_code)
            query = f"UPDATE assets SET {', '.join([f'{f} = %s' for f in fields])} WHERE employee_code = %s"
            cur.execute(query, tuple(values))
            conn.commit()
        finally:
            conn.close()

    def create_asset_checklist(self, employee_code: str, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO assets (
                    employee_code, 
                    ob_laptop, ob_laptop_bag, ob_headphones, ob_mouse, 
                    ob_extra_hardware, ob_client_assets, 
                    ob_id_card, ob_email_access, ob_groups, ob_mediclaim, ob_pf,
                    ob_remarks,
 
                    cl_laptop, cl_laptop_bag, cl_headphones, cl_mouse, 
                    cl_extra_hardware, cl_client_assets, 
                    cl_id_card, cl_email_access, cl_groups, cl_relieving_letter,
                    cl_remarks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                employee_code,
                data.get('ob_laptop', 0), data.get('ob_laptop_bag', 0), 
                data.get('ob_headphones', 0), data.get('ob_mouse', 0),
                data.get('ob_extra_hardware', 0), data.get('ob_client_assets', 0), 
                
                data.get('ob_id_card', 0), data.get('ob_email_access', 0),
                data.get('ob_groups', 0), data.get('ob_mediclaim', 0), data.get('ob_pf', 0),
                
                data.get('ob_remarks', ''),
                
                data.get('cl_laptop', 0), data.get('cl_laptop_bag', 0), 
                data.get('cl_headphones', 0), data.get('cl_mouse', 0),
                data.get('cl_extra_hardware', 0), data.get('cl_client_assets', 0), 
                
                data.get('cl_id_card', 0), data.get('cl_email_access', 0),
                data.get('cl_groups', 0), data.get('cl_relieving_letter', 0),
                
                data.get('cl_remarks', '')
            ))
            conn.commit()
        finally:
            conn.close()

