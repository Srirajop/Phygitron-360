from datetime import datetime
import os
import secrets
import shutil
from typing import Optional, Dict, Any, List
from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
from backend.modules.deploy.repositories.asset_repo import AssetRepository
from backend.modules.deploy.repositories.attendance_repo import AttendanceRepository
from backend.modules.deploy.schemas.employee import UpdateEmployeeRequest, OffboardRequest
from backend.modules.deploy.repositories.user_repo import UserRepository
from backend.common.services.email_service import EmailService
from passlib.hash import pbkdf2_sha256

class EmployeeService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = EmployeeRepository()
        self.asset_repo = AssetRepository()
        self.attendance_repo = AttendanceRepository()
        self.user_repo = UserRepository()
        self.email_service = EmailService()
        self.tenant_id = tenant_id

    def get_all_employees(self):
        return self.repo.get_all_employees_basic(self.tenant_id)

    def get_employee_full_details(self, employee_code: str):
        employee = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        if not employee:
            return None
            
        # Enrich with other data
        employee['skill_matrix'] = self.repo.get_skill_matrix(employee_code, self.tenant_id)
        employee['assets'] = self.asset_repo.get_assets_for_employee(employee_code, self.tenant_id) if hasattr(self.asset_repo, 'get_assets_for_employee') else self.repo.get_assets(employee_code, self.tenant_id)
        # Assuming repo has hr_activity and assessments as defined
        employee['training'] = self.repo.get_hr_activity(employee_code, self.tenant_id)
        
        # New: Quarterly Assessments
        assessments = self.repo.get_assessments(employee_code, self.tenant_id)
        employee['assessments'] = assessments
        
        # Calculate Average Score (optional logic for dashboard usage)
        if assessments:
             total = sum([a['total_score'] for a in assessments if a['status'] == 'Finalized'])
             count = len([a for a in assessments if a['status'] == 'Finalized'])
             employee['average_score'] = round(total / count, 1) if count > 0 else 0
        else:
             employee['average_score'] = 0

        return employee

    def create_employee(self, data: Dict[str, Any]):
        # Validations
        if not data['code']:
             raise ValueError("Employee code cannot be empty.")
        
        import re
        phone_cleaned = re.sub(r'[\s\-()]', '', data['phone'])
        if not re.match(r'^\+?[0-9]{7,15}$', phone_cleaned):
             raise ValueError("Contact number must be a valid phone number (7-15 digits, optionally starting with +).")

        # Date calcs for age validation
        try:
            dob_date = datetime.strptime(data['dob'], "%Y-%m-%d")
            doj_date = datetime.strptime(data['doj'], "%Y-%m-%d")
            today = datetime.today()
            age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            if age < 18:
                raise ValueError("Employee must be at least 18 years old.")
        except ValueError:
             raise ValueError("Invalid date format.")

        existing_emp_by_code = self.repo.get_employee_by_code(data['code'], self.tenant_id)
        if existing_emp_by_code:
            raise ValueError("Employee Code already exists.")
            
        existing_emp_by_email = self.repo.get_employee_by_email(data['email'], self.tenant_id)
        is_rehire = False
        old_employee_code = None
        
        if existing_emp_by_email:
            if existing_emp_by_email.get('employment_status') == 'Exited':
                is_rehire = True
                old_employee_code = existing_emp_by_email['employee_code']
            else:
                raise ValueError("An active employee with this email already exists.")

        if is_rehire:
            self.repo.update_employee_rehire(old_employee_code, data, self.tenant_id)
        else:
            self.repo.create_employee(data, self.tenant_id)
        
        # --- ATOMIC INITIALIZATION ---
        # 1. Initialize Asset Checklist (Empty/Default)
        default_assets = {
            'ob_pf': 1 if data.get('pf') in ['Yes', 'true', '1'] else 0,
            'ob_mediclaim': 1 if data.get('mediclaim') in ['Yes', 'true', '1'] else 0
        }
        # Assuming asset_repo can accept tenant_id; if not we ignore or fix asset_repo later
        try:
            self.asset_repo.create_asset_checklist(data['code'], default_assets, self.tenant_id)
        except Exception:
            pass

        # 2. Initialize Leave Balance (Current Year)
        current_year = datetime.now().year
        try:
            self.attendance_repo.create_leave_balance(data['code'], current_year, self.tenant_id)
        except Exception:
            pass

        # 3. Auto-create user account so the employee can log in
        username = data['email']  # email is the login username
        temp_password = None
        user_created = False
        email_sent = False

        # Only create if this email isn't already a user
        # Note: user_repo needs tenant_id too, but for scope we handle employee isolating primarily
        # Assuming user_repo is tenant-aware
        existing_user = None
        try:
            existing_user = self.user_repo.get_user_by_username(username)
        except:
            pass

        if not existing_user:
            emp_status = data.get('employment_status', 'Active')
            if emp_status != 'Exited':
                # Generate a secure 8-char URL-safe temp password
                temp_password = secrets.token_urlsafe(8)
                password_hash = pbkdf2_sha256.hash(temp_password)
                try:
                    self.user_repo.create_user(
                        username=username,
                        password_hash=password_hash,
                        role=data.get('role') or 'employee',
                        employee_code=data['code'],
                        tenant_id=self.tenant_id,
                        is_active=0 if emp_status == 'Inactive' else 1
                    )
                    user_created = True
    
                    # Send welcome email with credentials (only if Active)
                    if emp_status == 'Active' and self.email_service.is_configured():
                        email_result = self.email_service.send_new_employee_credentials(
                            recipient_email=username,
                            recipient_name=data['name'],
                            employee_code=data['code'],
                            temporary_password=temp_password
                        )
                        email_sent = email_result.get('success', False)
                except:
                    pass
        else:
            # Link existing user to this employee code if not already linked
            if not existing_user.get('employee_code'):
                from backend.modules.deploy.repositories.admin_repo import AdminRepository
                admin_repo = AdminRepository()
                try:
                    admin_repo.update_employee_code(existing_user['id'], data['code'])
                except:
                    pass

        result = {"success": True, "message": "Employee added successfully!"}
        if user_created:
            result["email_sent"] = email_sent
            if email_sent:
                result["message"] = f"Employee added and login credentials emailed to {username}."
            else:
                result["message"] = "Employee added. Email not configured — share credentials manually."
                result["login_credentials"] = {
                    "username": username,
                    "temporary_password": temp_password,
                    "note": "Share these credentials with the employee. They must change the password on first login."
                }
        else:
            result["message"] += " An existing user account was found and linked."

        return result

    def update_employee(self, employee_code: str, data: dict):
        print("UPDATE_EMPLOYEE_DATA:", data)
        print("DEBUG DATA RECEIVED:", data)
        allowed_fields = [
            'exit_date', 'exit_reason', 'clearance_status', 'employment_status',
            'name', 'designation', 'team', 'employment_type', 'reporting_manager', 'location',
            'contact_number', 'emergency_contact', 'current_address', 
            'permanent_address', 'dob', 'email_id', 'notes', 'doj',
            'photo_path', 'cv_path', 'id_proofs', 'pf_included', 'mediclaim_included',
            'education_details', 'employee_code', 'bank_name', 'bank_account_no', 'pan_no'
        ]
        
        fields = []
        values = []
        
        # Capture old email to update user username if changed
        old_employee = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        old_email = old_employee.get('email_id') if old_employee else None

        import json
        for key, value in data.items():
            if key not in allowed_fields:
                continue
            # Skip None values, but allow empty strings (user may be clearing a field)
            if value is None:
                continue
            # Skip nested objects that aren't meant for the employees table
            if isinstance(value, (dict, list)) and key != 'education_details':
                continue
            # Handle JSONB fields
            if key == 'education_details' and isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            fields.append(key)
            values.append(value)

        
        if fields:
            self.repo.update_employee_fields(employee_code, fields, values, self.tenant_id)

        # Use NEW employee code for subsequent updates if it was changed
        current_emp_code = data.get('employee_code', employee_code)

        # Update user role if changed
        if 'role' in data and data['role']:
            self.repo.update_user_role(current_emp_code, data['role'], self.tenant_id)

        # Sync email with user username
        if 'email_id' in data and data['email_id'] != old_email:
             try:
                 user = self.user_repo.get_user_by_username(old_email)
                 if user:
                     self.user_repo.update_username(user['id'], data['email_id'])
             except:
                 pass

        # Skills update - prioritize flattened fields from data
        p_skill = data.get('primary_skillset')
        s_skill = data.get('secondary_skillset')
        exp = data.get('experience_years')
        
        # If skills were passed inside a skill_matrix object but NOT at top level, pick them up
        if 'skill_matrix' in data and isinstance(data['skill_matrix'], dict):
             if p_skill is None: p_skill = data['skill_matrix'].get('primary_skillset')
             if s_skill is None: s_skill = data['skill_matrix'].get('secondary_skillset')
             if exp is None: exp = data['skill_matrix'].get('experience_years')
             
        if p_skill is not None or s_skill is not None or exp is not None:
            self.repo.update_skill_matrix(current_emp_code, p_skill, s_skill, self.tenant_id, experience_years=exp)

        # Sync PF and Mediclaim to Assets Table
        asset_fields = []
        asset_values = []
        if 'pf_included' in fields:
            idx = fields.index('pf_included')
            val = values[idx]
            asset_fields.append('ob_pf')
            asset_values.append(1 if str(val).lower() in ['yes', 'true', '1'] else 0)
        if 'mediclaim_included' in fields:
            idx = fields.index('mediclaim_included')
            val = values[idx]
            asset_fields.append('ob_mediclaim')
            asset_values.append(1 if str(val).lower() in ['yes', 'true', '1'] else 0)
            
        if asset_fields:
            try:
                from backend.modules.deploy.repositories.asset_repo import AssetRepository
                AssetRepository().update_asset_fields(current_emp_code, asset_fields, asset_values, self.tenant_id)
            except Exception as e:
                print("Failed to sync assets:", e)

        return {"success": True, "message": "Employee updated successfully"}
    
    def delete_employee(self, employee_code: str):
        if not self.repo.get_employee_by_code(employee_code, self.tenant_id):
             raise ValueError("Employee not found")
        
        self.repo.delete_employee_cascade(employee_code, self.tenant_id)
        return {"success": True, "message": f"Employee {employee_code} deleted successfully"}

    def get_options(self):
        return self.repo.get_dropdown_options(self.tenant_id)

    def offboard_employee(self, employee_code: str, req: OffboardRequest):
         exit_date = req.exit_date or datetime.today().strftime('%Y-%m-%d')
         
         # Combine Reason and Remarks
         full_reason = req.exit_reason or 'Resignation'
         if req.remarks:
             full_reason += f" | Notes: {req.remarks}"
             
         # Logic for Status
         status = 'Exited'
         deactivate = True
         
         if req.exit_type == 'Notice Period':
             status = 'Notice Period'
             deactivate = False
             
         self.repo.offboard_employee(employee_code, exit_date, full_reason, status=status, deactivate=deactivate, tenant_id=self.tenant_id)
         return {"success": True, "message": f"Employee {employee_code} marked as {status}."}
