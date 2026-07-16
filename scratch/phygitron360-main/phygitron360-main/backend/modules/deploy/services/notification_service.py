from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.notification_repo import NotificationRepository

class NotificationService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = NotificationRepository()
        self.tenant_id = tenant_id

    def notify_user(self, employee_code: str, title: str, message: str, n_type: str = 'Info'):
        self.repo.create_notification(employee_code, title, message, n_type, tenant_id=self.tenant_id)

    def notify_admins(self, title: str, message: str, n_type: str = 'AdminAlert'):
        self.repo.create_notification(None, title, message, n_type, tenant_id=self.tenant_id)

    def get_user_notifications(self, employee_code: Optional[str] = None, limit: int = 10, unread_only: bool = False, user_id: Optional[int] = None):
        return self.repo.get_notifications_for_user(employee_code, self.tenant_id, limit, unread_only, user_id=user_id)

    def get_admin_notifications(self, limit: int = 15, unread_only: bool = False):
        return self.repo.get_admin_notifications(self.tenant_id, limit, unread_only)

    def mark_read(self, notif_id: int):
        self.repo.mark_as_read(notif_id, self.tenant_id)

    def mark_all_read(self, employee_code: Optional[str] = None, is_admin: bool = False, user_id: Optional[int] = None):
        self.repo.mark_all_as_read(employee_code, is_admin, self.tenant_id, user_id=user_id)

    def get_unread_count(self, employee_code: Optional[str] = None, is_admin: bool = False, user_id: Optional[int] = None):
        return self.repo.get_unread_count(employee_code, is_admin, self.tenant_id, user_id=user_id)

    def mark_relevant_as_read(self, title: str, message_part: str):
        self.repo.mark_notifications_by_query(title, message_part, self.tenant_id)

# Global helper for easy import
def add_notification(title: str, message: str, employee_code: Optional[str] = None, n_type: str = 'Info', tenant_id: str = 'public'):
    service = NotificationService(tenant_id=tenant_id)
    if employee_code:
        service.notify_user(employee_code, title, message, n_type)
    else:
        service.notify_admins(title, message, n_type)
