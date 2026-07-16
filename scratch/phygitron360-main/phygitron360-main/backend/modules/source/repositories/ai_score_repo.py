import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AIScoreRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_ai_score(self, data: Dict[str, Any], conn=None, cur=None) -> int:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            cur.execute('''
                INSERT INTO ai_scores (entity_type, entity_id, job_role_id, score_type, score, reasoning)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            ''', (
                data.get("entity_type"),
                data.get("entity_id"),
                data.get("job_role_id"),
                data.get("score_type"),
                data.get("score"),
                data.get("reasoning")
            ))
            score_id = cur.fetchone()[0]
            if should_close:
                conn.commit()
            return score_id
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_scores_for_entity(self, entity_type: str, entity_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT * FROM ai_scores 
                    WHERE entity_type = %s AND entity_id = %s
                    ORDER BY computed_at DESC
                ''', (entity_type, entity_id))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_last_scored_at(self, role_id: int):
        """Return the most recent computed_at timestamp for a role's scores, or None."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("""
                    SELECT MAX(computed_at) FROM ai_scores
                    WHERE job_role_id = %s AND score_type = 'role_fit'
                """, (role_id,))
                row = cur.fetchone()
                return row[0] if row else None
        finally:
            conn.close()

    def get_scored_count(self, role_id: int) -> int:
        """Return how many candidates have been scored for this role."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("""
                    SELECT COUNT(*) FROM ai_scores
                    WHERE job_role_id = %s AND score_type = 'role_fit'
                """, (role_id,))
                row = cur.fetchone()
                return row[0] if row else 0
        finally:
            conn.close()

    def upsert_role_fit_score(self, candidate_id: int, role_id: int, score: float, reasoning: str):

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Check if it exists
                cur.execute('''
                    SELECT id FROM ai_scores 
                    WHERE entity_type = 'candidate' AND entity_id = %s AND job_role_id = %s AND score_type = 'role_fit'
                ''', (candidate_id, role_id))
                row = cur.fetchone()
                if row:
                    cur.execute('''
                        UPDATE ai_scores SET score = %s, reasoning = %s, computed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (score, reasoning, row[0]))
                else:
                    cur.execute('''
                        INSERT INTO ai_scores (entity_type, entity_id, job_role_id, score_type, score, reasoning)
                        VALUES ('candidate', %s, %s, 'role_fit', %s, %s)
                    ''', (candidate_id, role_id, score, reasoning))
                conn.commit()
        finally:
            conn.close()

    def get_ranked_candidates_for_role(self, role_id: int) -> List[Dict[str, Any]]:
        """Returns unique candidates ranked by their latest AI role-fit score."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT * FROM (
                        SELECT DISTINCT ON (c.id)
                            c.id as candidate_id, 
                            c.full_name, 
                            c.current_designation,
                            c.total_experience_years,
                            c.primary_skills,
                            c.secondary_skills,
                            s.score,
                            s.reasoning,
                            s.computed_at
                        FROM candidates c
                        JOIN ai_scores s ON c.id = s.entity_id
                        WHERE s.entity_type = 'candidate' 
                          AND s.job_role_id = %s
                          AND s.score_type = 'role_fit'
                        ORDER BY c.id, s.computed_at DESC
                    ) AS latest_scores
                    ORDER BY score DESC
                ''', (role_id,))
                results = []
                for r in cur.fetchall():
                    row = dict(r)
                    row["skills"] = (row.get("primary_skills") or []) + (row.get("secondary_skills") or [])
                    results.append(row)
                return results
        finally:
            conn.close()
