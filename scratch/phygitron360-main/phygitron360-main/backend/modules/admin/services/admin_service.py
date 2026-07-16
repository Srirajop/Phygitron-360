from typing import List, Dict, Any, Optional
from backend.modules.admin.repositories.admin_repo import AdminRepository
from backend.modules.deploy.services.auth_service import AuthService # Reuse for create/delete user logic
from backend.core.email_service import send_welcome_email

class AdminService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = AdminRepository(tenant_id=tenant_id)
        self.auth_service = AuthService()
        self.tenant_id = tenant_id

    def list_users(self):
        # We use UserRepository to filter by tenant_id
        from backend.modules.deploy.repositories.user_repo import UserRepository
        return UserRepository().get_all_users(tenant_id=self.tenant_id)

    def list_tenants(self):
        return self.repo.get_all_tenants()

    def provision_tenant(self, company_name: str, admin_email: str, admin_password: str, actor: str):
        # 1. Generate standard identifiers
        safe_name = "".join([c for c in company_name.lower().replace(' ', '_') if c.isalnum() or c == '_'])
        tenant_schema = f"tenant_{safe_name}"
        subdomain = safe_name.replace('_', '')

        # 2. Add to central registry (public schema)
        self.repo.register_tenant(tenant_schema, company_name, admin_email, subdomain)

        # 3. Initialize tenant schema & tables
        from backend.core.database import create_tables
        create_tables(schema_name=tenant_schema)

        # 3.5 Seed Default Permissions for the new schema
        self.repo.seed_default_permissions(tenant_schema)

        # 4. Create Tenant Admin in new schema
        hashed_password = self.auth_service.get_password_hash(admin_password)
        self.repo.create_tenant_admin(tenant_schema, admin_email, hashed_password)

        # 5. Log the orchestration event
        self.repo.log_action(actor, "PROVISION_TENANT", f"Provisioned enterprise workspace: {company_name} ({tenant_schema})")

        # 6. Dispatch Welcome Email
        send_welcome_email(to_email=admin_email, company_name=company_name, temp_password=admin_password, subdomain=subdomain)

        # 7. Spawn a bulk-upload background worker for the new tenant immediately
        # (the startup event only covers tenants that exist at boot time)
        try:
            import asyncio
            from backend.modules.source.services.candidate_service import CandidateService
            svc = CandidateService(tenant_id=tenant_schema)
            import backend.core.database as db
            if db.main_loop and db.main_loop.is_running():
                asyncio.run_coroutine_threadsafe(svc.process_bulk_upload_queue(), db.main_loop)
                import logging
                logging.getLogger(__name__).info(f"[provision_tenant] Bulk worker started successfully for {tenant_schema} via main_loop.")
        except Exception as worker_err:
            import logging
            logging.getLogger(__name__).warning(f"[provision_tenant] Could not start bulk worker for {tenant_schema}: {worker_err}")

        return {
            "success": True,
            "workspace_id": tenant_schema,
            "subdomain": subdomain
        }

    def delete_tenant(self, tenant_id: str, actor: str):
        from backend.common.services.storage_service import delete_tenant_directory
        self.repo.delete_tenant(tenant_id)
        delete_tenant_directory(tenant_id)
        self.repo.log_action(actor, "DELETE_TENANT", f"Decommissioned enterprise workspace: {tenant_id}")
        return {"success": True}

    def create_user(self, username: str, password: str, role: str, actor: str, actor_role: str, employee_code: str = None):
        valid_roles = ['super_admin', 'org_admin', 'manager', 'employee', 'trainee']
        if role not in valid_roles:
             raise ValueError(f"Invalid role. Must be one of {valid_roles}")
             
        if actor_role == 'manager' and role not in ['employee', 'trainee']:
             raise ValueError("Manager can only assign employee or trainee roles.")
             
        # Use auth service to create user (handles password hashing)
        try:
             # Ensure tenant_id is preserved
             from backend.modules.deploy.repositories.user_repo import UserRepository
             user_repo = UserRepository()
             
             existing = user_repo.get_user_by_username(username, tenant_id=self.tenant_id)
             if existing:
                 raise ValueError(f"User {username} already exists in this workspace")
                 
             password_hash = self.auth_service.get_password_hash(password)
             user_repo.create_user(username, password_hash, role, employee_code, tenant_id=self.tenant_id)
             
             self.repo.log_action(actor, "CREATE_USER", f"Created user {username} with role {role}")
             return {"message": "User created successfully"}
        except ValueError as e:
             raise ValueError(str(e))

    def delete_user(self, user_id: int, actor: str):
        from backend.modules.deploy.repositories.user_repo import UserRepository
        user_repo = UserRepository()
        user = user_repo.get_user_by_id(user_id, tenant_id=self.tenant_id)
        if not user:
            raise ValueError("User not found in this workspace")
        
        username = user['username']
        if username == actor:
            raise ValueError("Cannot delete your own account")
            
        user_repo.delete_user(username, tenant_id=self.tenant_id)
        self.repo.log_action(actor, "DELETE_USER", f"Deleted user {username} in {self.tenant_id}")
        
        return {"message": f"User {username} deleted"}

    def toggle_user_active(self, user_id: int, is_active: bool, actor: str, actor_role: str):
        from backend.core.database import get_db_connection
        from backend.modules.deploy.repositories.user_repo import UserRepository
        user = UserRepository().get_user_by_id(user_id, tenant_id=self.tenant_id)
        if not user:
            raise ValueError("User not found")
        if actor_role == 'manager' and user['role'] not in ['employee', 'candidate', 'Employee', 'Candidate']:
            raise ValueError("Manager can only toggle employee or candidate.")
            
        conn = get_db_connection()
        try:
             cur = conn.cursor()
             cur.execute(f'SET search_path TO "{self.tenant_id}"')
             cur.execute("UPDATE users SET is_active = %s WHERE id = %s", (1 if is_active else 0, user_id))
             conn.commit()
             self.repo.log_action(actor, "TOGGLE_USER_ACTIVE", f"Set is_active={1 if is_active else 0} for user ID {user_id} in {self.tenant_id}")
        finally:
             conn.close()
        return {"success": True}

    def get_logs(self):
        return self.repo.get_logs()

    def get_role_permissions(self):
        return self.repo.get_role_permissions()

    def update_role_permissions(self, role: str, permissions: List[str], actor: str):
        self.repo.update_role_permissions(role, permissions)
        self.repo.log_action(actor, "UPDATE_ROLE_PERMISSIONS", f"Updated permissions for role {role}")
        return {"success": True}

    def get_user_overrides(self, user_id: int):
        return self.repo.get_user_overrides(user_id)

    def update_user_overrides(self, user_id: int, overrides: Dict[str, Optional[bool]], actor: str):
        self.repo.update_user_overrides(user_id, overrides)
        self.repo.log_action(actor, "UPDATE_USER_PERMISSIONS", f"Updated permissions overrides for user ID {user_id}")
        return {"success": True}

    def update_employee_code(self, user_id: int, employee_code: Optional[str], actor: str):
        from backend.modules.deploy.repositories.user_repo import UserRepository
        user_repo = UserRepository()
        user = user_repo.get_user_by_id(user_id, tenant_id=self.tenant_id)
        if not user:
            raise ValueError("User not found")
        
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("UPDATE users SET employee_code = %s WHERE id = %s", (employee_code, user_id))
            conn.commit()
        finally:
            conn.close()
            
        self.repo.log_action(actor, "UPDATE_EMPLOYEE_CODE", f"Linked user ID {user_id} to employee code: {employee_code or 'None'} in {self.tenant_id}")
        return {"success": True}

    def update_role(self, user_id: int, role: str, actor: str, actor_role: str):
        valid_roles = ['super_admin', 'org_admin', 'manager', 'employee', 'candidate']
        if role not in valid_roles:
            raise ValueError(f"Invalid role. Must be one of {valid_roles}")
            
        from backend.modules.deploy.repositories.user_repo import UserRepository
        user_repo = UserRepository()
        user = user_repo.get_user_by_id(user_id, tenant_id=self.tenant_id)
        if not user:
            raise ValueError("User not found")
            
        if actor_role == 'manager' and role not in ['employee', 'candidate']:
             raise ValueError("Manager can only assign employee or candidate roles.")
        if actor_role == 'manager' and user['role'] not in ['employee', 'candidate', 'Employee', 'Candidate']:
             raise ValueError("Manager can only modify employee or candidate roles.")
            
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("UPDATE users SET role = %s, roles = %s WHERE id = %s", (role, [role], user_id))
            conn.commit()
        finally:
            conn.close()
            
        self.repo.log_action(actor, "UPDATE_USER_ROLE", f"Changed role for user ID {user_id} ({user['username']}) to {role} in {self.tenant_id}")
        return {"success": True, "message": f"Role updated to {role}"}

    def get_tenant_ops(self, tenant_id: str):
        stats = self.repo.get_tenant_stats(tenant_id)
        
        # Fetch tenant info from public
        from backend.core.database import get_db_connection
        from psycopg2.extras import RealDictCursor
        conn = get_db_connection()
        tenant_info = {}
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SET search_path TO public")
                cur.execute("SELECT * FROM tenants WHERE id = %s", (tenant_id,))
                row = cur.fetchone()
                if row:
                    tenant_info = dict(row)
        finally:
            conn.close()
            
        return {
            "stats": stats,
            "config": tenant_info
        }

    def update_tenant_ops(self, tenant_id: str, data: Dict[str, Any], actor: str):
        self.repo.update_tenant_ops(
            tenant_id, 
            company_name=data.get('company_name'),
            plan=data.get('plan'),
            modules=data.get('modules_enabled'),
            is_active=data.get('is_active')
        )
        self.repo.log_action(actor, "UPDATE_TENANT_OPS", f"Updated operational parameters for tenant {tenant_id}")
        return {"success": True}
