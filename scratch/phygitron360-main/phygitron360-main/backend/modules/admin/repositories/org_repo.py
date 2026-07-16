from typing import List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

class OrgRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _execute_query(self, query: str, params: tuple = None, fetch_one: bool = False):
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{self.tenant_id}", public')
                cur.execute(query, params)
                if fetch_one:
                    return cur.fetchone()
                return cur.fetchall()
        finally:
            conn.close()

    def get_dashboard_counts(self):
        """Get the 6 top numbers."""
        query = """
            SELECT 
                (SELECT COUNT(*) FROM candidates) as total_candidates,
                (SELECT COUNT(*) FROM candidates WHERE status = 'Training') as currently_training,
                (SELECT COUNT(*) FROM candidates WHERE status = 'Verified') as verified_ready,
                (SELECT COUNT(*) FROM employees WHERE employment_status = 'Active') as active_employees,
                (SELECT 3) as skill_decay_alerts, -- Mocked for now
                (SELECT 7) as open_compliance_issues -- Mocked for now
        """
        return self._execute_query(query, fetch_one=True)

    def get_pipeline_funnel(self):
        """Candidate counts per stage."""
        query = """
            SELECT status, COUNT(*) as count 
            FROM candidates 
            GROUP BY status
        """
        return self._execute_query(query)

    def get_module_health(self):
        """Key metric per module."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1. Check which modules are actually enabled for this tenant
                cur.execute("SET search_path TO public")
                cur.execute("SELECT modules_enabled FROM tenants WHERE id = %s", (self.tenant_id,))
                row = cur.fetchone()
                enabled = [m.lower() for m in (row['modules_enabled'] if row and row['modules_enabled'] else [])]
                
                cur.execute(f'SET search_path TO "{self.tenant_id}"')
                
                results = []
                
                # Source
                if 'source' in enabled:
                    cur.execute("SELECT COUNT(*) FROM candidates WHERE created_at >= NOW() - INTERVAL '7 days'")
                    source_metric = cur.fetchone()['count']
                    results.append({"module": "Source", "metric": f"{source_metric} new candidates", "trend": "up"})
                
                # Forge
                if 'forge' in enabled:
                    results.append({"module": "Forge", "metric": "3 courses active", "trend": "stable"})
                
                # Verify
                if 'verify' in enabled:
                    results.append({"module": "Verify", "metric": "4 scheduled", "trend": "up"})
                
                # Deploy
                if 'deploy' in enabled:
                    results.append({"module": "Deploy", "metric": "2 alerts", "trend": "attention"})
                
                return results
        finally:
            conn.close()

    def get_recent_activity(self):
        """Last 20 actions."""
        # Using audit_logs if it exists in schema, otherwise system-wide
        query = "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 20"
        return self._execute_query(query)

    def get_team_overview(self):
        """Users + last active."""
        query = """
            SELECT username, role, last_login as last_active, 
            (SELECT COUNT(*) FROM audit_logs WHERE username = u.username AND timestamp >= NOW() - INTERVAL '7 days') as actions_week
            FROM users u
            ORDER BY last_active DESC NULLS LAST
            LIMIT 5
        """
        return self._execute_query(query)

    def get_billing_status(self):
        """Plan info from public.tenants."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SET search_path TO public")
                cur.execute("SELECT plan, modules_enabled, created_at FROM tenants WHERE id = %s", (self.tenant_id,))
                return cur.fetchone()
        finally:
            conn.close()
