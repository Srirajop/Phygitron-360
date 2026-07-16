import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class SkillRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def get_skill_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                normalized = name.lower().strip()
                cur.execute("SELECT * FROM skill_taxonomy WHERE normalized_name = %s", (normalized,))
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def create_skill(self, name: str, category: str = "extracted", aliases: list = None) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                normalized = name.lower().strip()
                cur.execute('''
                    INSERT INTO skill_taxonomy (name, normalized_name, category, aliases)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                ''', (name, normalized, category, json.dumps(aliases or [])))
                skill_id = cur.fetchone()[0]
                conn.commit()
                return skill_id
        finally:
            conn.close()

    def add_skill_relation(self, from_id: int, to_id: int, relation: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO skill_graph_edges (from_skill_id, to_skill_id, relation)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                ''', (from_id, to_id, relation))
                conn.commit()
        finally:
            conn.close()

    def get_all_skills(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute("SELECT * FROM skill_taxonomy")
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()
