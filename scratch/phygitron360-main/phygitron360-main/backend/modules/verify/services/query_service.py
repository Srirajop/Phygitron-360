import logging
from typing import List, Dict, Any, Optional
from backend.modules.verify.repositories.query_repo import QueryRepository

logger = logging.getLogger(__name__)

class QueryService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = QueryRepository(tenant_id=tenant_id)

    def get_queries(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.get_queries(status)

    def create_query(self, data: Dict[str, Any]) -> int:
        return self.repo.create_query(data)

    def respond_to_query(self, query_id: int, status: Optional[str] = None, response: Optional[str] = None) -> bool:
        updates = {}
        if status:
            updates["status"] = status
        if response is not None:
            updates["response"] = response
            
        return self.repo.update_query(query_id, updates)

    def get_my_queries(self, user_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_my_queries(user_id)
