from datetime import datetime, timedelta
import calendar
from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.attendance_repo import AttendanceRepository
from backend.modules.deploy.services.notification_service import add_notification
from backend.modules.deploy.schemas.attendance import (
    ClockOutRequest, AttendanceStatus, LeaveBalance, LeaveRequest, EditAttendanceRequest
)

class AttendanceService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = AttendanceRepository()
        self.tenant_id = tenant_id

    def get_status(self, employee_code: str) -> AttendanceStatus:
        today = datetime.now().strftime('%Y-%m-%d')
        record = self.repo.get_todays_attendance(employee_code, today, self.tenant_id)
        
        if not record:
            return AttendanceStatus(status="not_started", data=None)
        
        # Convert dictionary to model-compatible dict if needed, 
        # but generic dict is fine for Pydantic if keys match.
        if record.get('clock_out'):
             return AttendanceStatus(status="completed", data=record)
        else:
             return AttendanceStatus(status="clocked_in", data=record)

    def clock_in(self, employee_code: str, ip_address: str, local_date: Optional[str] = None, local_time: Optional[str] = None):
        today = local_date if local_date else datetime.now().strftime('%Y-%m-%d')
        now = local_time if local_time else datetime.now().strftime('%H:%M:%S')
        
        existing = self.repo.get_todays_attendance(employee_code, today, self.tenant_id)
        if existing:
            raise ValueError("Already clocked in for today")
            
        self.repo.clock_in(employee_code, today, now, ip_address, self.tenant_id)
        return {"success": True, "message": "Clocked in successfully", "time": now}

    def clock_out(self, employee_code: str, data: ClockOutRequest):
        today = data.local_date if data.local_date else datetime.now().strftime('%Y-%m-%d')
        now = data.local_time if data.local_time else datetime.now().strftime('%H:%M:%S')
        
        active_records = self.repo.get_history(employee_code, limit=1, tenant_id=self.tenant_id)
        if not active_records or active_records[0].get('status') != 'Active':
             raise ValueError("No active attendance record found. Please clock in first.")
             
        record = active_records[0]
        
        if record['date'] != today:
             raise ValueError("Clock-out must be on the same calendar day as clock-in. Please contact your admin to fix this record.")
        
        if record.get('clock_out'):
             raise ValueError("Already clocked out.")

        if record.get('clock_in') and now < record['clock_in']:
             raise ValueError("Clock-out time cannot be earlier than clock-in time.")

        self.repo.clock_out(employee_code, record['date'], now, data.work_log, self.tenant_id)
        return {"success": True, "message": "Clocked out successfully"}

    def get_history(self, employee_code: str):
        # 1. Fetch Attendance History
        history = self.repo.get_history(employee_code, tenant_id=self.tenant_id)
        for log in history:
            clock_in = log.get('clock_in')
            clock_out = log.get('clock_out')
            
            if clock_in and clock_out:
                try:
                    fmt = '%H:%M:%S'
                    t_in = datetime.strptime(clock_in, fmt)
                    t_out = datetime.strptime(clock_out, fmt)
                    duration_hours = (t_out - t_in).total_seconds() / 3600.0
                    
                    if duration_hours >= 8.0:
                        log['status'] = 'Present'
                    elif duration_hours >= 4.0:
                        if t_in.hour < 13:
                            log['status'] = 'Half Day (First Half)'
                        else:
                            log['status'] = 'Half Day (Second Half)'
                    else:
                        log['status'] = 'Absent'
                except:
                    log['status'] = 'Present'
            elif clock_in:
                 today_str = datetime.now().strftime('%Y-%m-%d')
                 if log['date'] != today_str:
                     log['status'] = 'Absent'
                 else:
                     log['status'] = 'Active'
            else:
                 log['status'] = 'Absent'

        # 2. Fetch and Merge Approved Leaves
        leaves = self.repo.get_employee_leaves(employee_code, self.tenant_id)
        for l in leaves:
            if l['status'] == 'Approved':
                # Note: This simple merge adds leave records to the list. 
                # In a more advanced view, we might merge them by date.
                history.append({
                    "date": l['start_date'],
                    "clock_in": "00:00:00",
                    "clock_out": "00:00:00",
                    "status": "Leave",
                    "work_log": f"Approved Leave: {l['reason']}"
                })
        
        # Re-sort by date
        history.sort(key=lambda x: x['date'], reverse=True)
        return history[:30]

    def get_leave_balance(self, employee_code: str) -> Dict[str, Any]:
        year = datetime.now().year
        balance = self.repo.get_leave_balance(employee_code, year, self.tenant_id)
        
        if not balance:
            self.repo.create_leave_balance(employee_code, year, self.tenant_id)
            balance = self.repo.get_leave_balance(employee_code, year, self.tenant_id)
            
        return balance

    def apply_leave(self, employee_code: str, req: LeaveRequest, user_role: str = 'Employee'):
        # 1. Date Validation
        try:
            d1 = datetime.strptime(req.start_date, '%Y-%m-%d')
            d2 = datetime.strptime(req.end_date, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")
            
        if d2 < d1:
            raise ValueError("End date cannot be earlier than the start date.")
            
        # Check for overlaps
        if self.repo.check_overlapping_leaves(employee_code, req.start_date, req.end_date, self.tenant_id):
            raise ValueError("Leave dates overlap with an existing leave request.")
            
        cutoff = datetime.now().date() - timedelta(days=15)
        if d1.date() < cutoff and user_role not in ['org_admin', 'super_admin']:
            raise ValueError("Leave applications cannot be more than 15 days in the past.")

        days = float((d2 - d1).days + 1)
        if d1 == d2:
            if req.start_day_type in ["First Half", "Second Half"]:
                days = 0.5
        else:
            if req.start_day_type == "Second Half":
                days -= 0.5
            if req.end_day_type == "First Half":
                days -= 0.5
        if days < 0:
            days = 0.0
        
        # 2. Status Determination
        status = 'Approved' if user_role == 'super_admin' else 'Pending'
        msg = "Leave auto-approved (Admin override)" if status == 'Approved' else "Leave application submitted successfully"
        
        # 3. Create Request
        self.repo.create_leave_request(employee_code, req.start_date, req.end_date, days, req.start_day_type, req.end_day_type, req.leave_type, req.reason, status, self.tenant_id)
        
        # 4. Immediate Balance Update for Admin
        if status == 'Approved':
            balance = self.get_leave_balance(employee_code)
            available = max(0, balance['total_leaves'] - balance['used_leaves'])
            used_delta = min(days, available)
            extended_delta = max(0, days - available)
            self.repo.update_leave_balance(employee_code, used_delta, extended_delta, self.tenant_id)
        else:
            add_notification(
                title="New Leave Request",
                message=f"Employee {employee_code} has applied for {days} days of leave.",
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )

        return {"success": True, "message": msg}

    def get_my_leaves(self, employee_code: str):
        return self.repo.get_employee_leaves(employee_code, self.tenant_id)

    def get_all_pending_leaves(self, role: str, employee_code: Optional[str] = None):
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                leaves = self.repo.get_all_pending_leaves(None, None, self.tenant_id)
                return [l for l in leaves if l['employee_code'] == employee_code]
                
        admin_code = employee_code if role == 'manager' else None
        return self.repo.get_all_pending_leaves(role, admin_code, self.tenant_id)

    def get_daily_log(self, date_str: Optional[str] = None, role: str = 'employee', employee_code: Optional[str] = None):
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d')
            
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                return []
            
        # For manager, filter by reporting manager code
        manager_code = employee_code if role == 'manager' else None
        
        return self.repo.get_daily_log(date_str, manager_code, self.tenant_id)

    def approve_reject_leave(self, leave_id: int, action: str, reason: Optional[str], admin_role: str, admin_code: Optional[str]):
        leave = self.repo.get_leave_by_id(leave_id, self.tenant_id)
        if not leave:
            raise ValueError("Leave request not found")

        # 1. Prevent Self-Approval
        if admin_code and leave['employee_code'] == admin_code:
            raise ValueError("You cannot approve your own leave request.")

        # 2. Hierarchy Check
        applicant_role = self.repo.get_user_role(leave['employee_code'], self.tenant_id)
        
        # If the admin is their direct manager, they can approve it regardless of role
        is_direct_manager = (admin_code and self.repo.get_manager_code(leave['employee_code'], self.tenant_id) == admin_code)
        
        if not is_direct_manager and applicant_role in ['org_admin', 'manager'] and admin_role not in ['org_admin', 'super_admin']:
             raise ValueError("Administrative leave requests can only be approved by an Organization Admin.")

        self.repo.update_leave_status(leave_id, action, reason, self.tenant_id)
        
        if action == 'Approved':
            # Use duration_days directly
            days = float(leave.get('duration_days') or 0.0)

            # Calculate and Apply Balance Logic
            balance = self.get_leave_balance(leave['employee_code'])
            available = max(0, balance['total_leaves'] - balance['used_leaves'])
            used_delta = min(days, available)
            extended_delta = max(0, days - available)
            
            self.repo.update_leave_balance(leave['employee_code'], used_delta, extended_delta, self.tenant_id)
            
            # Auto-cancel pending corrections for leave dates
            try:
                d1 = datetime.strptime(leave['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(leave['end_date'], '%Y-%m-%d')
                curr = d1
                while curr <= d2:
                    d_str = curr.strftime('%Y-%m-%d')
                    correction = self.repo.get_pending_correction_for_date(leave['employee_code'], d_str, self.tenant_id)
                    if correction:
                        self.repo.update_correction_status(
                            correction['id'],
                            'Cancelled',
                            admin_code,
                            'Superseded by approved leave',
                            self.tenant_id
                        )
                    curr += timedelta(days=1)
            except Exception:
                pass
        
        # Mark the original request notification as read
        from backend.modules.deploy.services.notification_service import NotificationService
        notif_service = NotificationService()
        notif_service.mark_relevant_as_read("New Leave Request", leave['employee_code'])

        # Notify user about the decision
        add_notification(
            title=f"Leave {action}",
            message=f"Your {leave['leave_type']} leave request for {leave['start_date']} to {leave['end_date']} has been {action.lower()}.",
            employee_code=leave['employee_code'],
            n_type="Success" if action == 'Approved' else "Alert",
            tenant_id=self.tenant_id
        )

        return {"success": True, "message": f"Leave has been {action}"}

    def get_monthly_summary(self, year: int, month: int):
        employees = self.repo.get_all_active_employees_basic(self.tenant_id)
        
        num_days = calendar.monthrange(year, month)[1]
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{num_days}"
        
        attendance_rows = self.repo.get_monthly_attendance(start_date, end_date, self.tenant_id)
        leave_rows = self.repo.get_monthly_approved_leaves(start_date, end_date, self.tenant_id)
        
        # Process maps
        att_map = {}
        for row in attendance_rows:
            # Ensure code and date are normalized
            e_code = row['employee_code']
            if e_code not in att_map: att_map[e_code] = {}
            
            # Normalize date to string for robust matching
            d_val = row['date']
            d_str = d_val.strftime('%Y-%m-%d') if hasattr(d_val, 'strftime') else str(d_val)
            
            clock_in = row.get('clock_in')
            clock_out = row.get('clock_out')
            
            if clock_in and clock_out:
                try:
                    # Parse times to calculate duration
                    t_in = datetime.strptime(str(clock_in), '%H:%M:%S') if isinstance(clock_in, str) else datetime.combine(datetime.min, clock_in)
                    t_out = datetime.strptime(str(clock_out), '%H:%M:%S') if isinstance(clock_out, str) else datetime.combine(datetime.min, clock_out)
                    
                    duration_hours = (t_out - t_in).total_seconds() / 3600.0
                    
                    if duration_hours >= 8.0:
                        att_map[e_code][d_str] = 'Present'
                    elif duration_hours >= 4.0:
                        if t_in.hour < 13:
                            att_map[e_code][d_str] = 'Half Day (First Half)'
                        else:
                            att_map[e_code][d_str] = 'Half Day (Second Half)'
                    else:
                        att_map[e_code][d_str] = 'Absent'
                except:
                    att_map[e_code][d_str] = 'Present' # Fallback
            elif clock_in:
                # Clocked in but not clocked out yet
                today_str = datetime.now().strftime('%Y-%m-%d')
                if d_str == today_str:
                    att_map[e_code][d_str] = 'Active'
                else:
                    # Forgot to clock out on a previous day
                    att_map[e_code][d_str] = 'Absent'
            else:
                 att_map[e_code][d_str] = 'Absent'
        leave_map = {}
        for row in leave_rows:
            code = row['employee_code']
            if code not in leave_map: leave_map[code] = {}
            
            try:
                d1 = datetime.strptime(row['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(row['end_date'], '%Y-%m-%d')
                
                month_start = datetime(year, month, 1)
                month_end = datetime(year, month, num_days)
                
                curr = max(d1, month_start)
                end = min(d2, month_end)
                
                while curr <= end:
                    d_str = curr.strftime('%Y-%m-%d')
                    l_status = 'Leave'
                    if curr == d1 and row.get('start_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('start_day_type')})"
                    if curr == d2 and row.get('end_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('end_day_type')})"
                    
                    leave_map[code][d_str] = l_status
                    curr += timedelta(days=1)
            except:
                pass

        summary = []
        for emp in employees:
            code = emp['employee_code']
            days = []
            present_count = 0
            half_day_count = 0
            leave_count = 0
            absent_count = 0
            
            for day in range(1, num_days + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                status = 'Absent'
                
                if code in leave_map and date_str in leave_map[code]:
                    status = leave_map[code][date_str]
                    if status == 'Leave':
                        leave_count += 1
                    else:
                        leave_count += 0.5
                elif code in att_map and date_str in att_map[code]:
                    status = att_map[code][date_str]
                    if status == 'Present' or status == 'Active':
                        present_count += 1
                    elif status.startswith('Half Day'):
                        half_day_count += 1
                    elif status == 'Absent':
                        absent_count += 1
                else:
                    try:
                        dt = datetime(year, month, day)
                        dt_date = dt.date()
                        today_date = datetime.now().date()
                        
                        if dt.weekday() >= 5: 
                            status = 'Weekend'
                        elif dt_date > today_date:
                            status = 'Future'
                        elif dt_date == today_date:
                            status = 'Not Started' 
                        else:
                            status = 'Absent'
                            absent_count += 1
                    except:
                        pass
                
                days.append({"day": day, "status": status, "date": date_str})

            summary.append({
                "name": emp['name'],
                "code": code,
                "days": days,
                "stats": {"present": present_count, "half_day": half_day_count, "leave": leave_count, "absent": absent_count}
            })
            
        return summary

    def get_active_employees(self):
        return self.repo.get_all_active_employees_basic(self.tenant_id)

    def get_history_for_employee(self, employee_code: str, limit: int = 90):
        """Admin/Manager: retrieve full attendance history for a given employee."""
        return self.repo.get_history(employee_code, limit, self.tenant_id)

    def get_leaves_for_employee(self, employee_code: str):
        """Admin/Manager: retrieve all leave records for a given employee."""
        return self.repo.get_employee_leaves(employee_code, self.tenant_id)


    def edit_attendance(self, req: EditAttendanceRequest):
        # 1. Determine Status based on duration
        status = 'Absent'
        if req.clock_in and req.clock_out:
            try:
                fmt = '%H:%M:%S'
                t_in = datetime.strptime(req.clock_in, fmt)
                t_out = datetime.strptime(req.clock_out, fmt)
                duration_hours = (t_out - t_in).total_seconds() / 3600.0
                
                if duration_hours >= 8.0:
                    status = 'Present'
                elif duration_hours >= 4.0:
                    if t_in.hour < 13:
                        status = 'Half Day (First Half)'
                    else:
                        status = 'Half Day (Second Half)'
                else:
                    status = 'Absent'
            except:
                status = 'Present' # Fallback
        elif req.clock_in:
            status = 'Present' # Currently active or single entry
        
        # 2. Update via Repo
        self.repo.upsert_attendance(
            req.employee_code, 
            req.date, 
            req.clock_in, 
            req.clock_out, 
            req.work_log, 
            status, 
            self.tenant_id
        )
        return {"success": True, "message": "Attendance record synchronized", "status": status}

    def check_and_trigger_missed_clockout_reminders(self) -> Dict[str, Any]:
        """
        Scans unclosed records, marks past records as Absent, and triggers reminder emails/notifications.
        """
        import pytz
        from backend.core.database import get_db_connection
        
        # Get tenant timezone
        tz_name = 'Asia/Kolkata'
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT timezone FROM public.tenants WHERE id = %s", (self.tenant_id,))
            row = cur.fetchone()
            if row and row[0]:
                tz_name = row[0]
        except Exception:
            pass
        finally:
            conn.close()
            
        tz = pytz.timezone(tz_name)
        now_utc = datetime.utcnow().replace(tzinfo=pytz.utc)
        now_local = now_utc.astimezone(tz)
        current_date_str = now_local.strftime('%Y-%m-%d')
        
        # 1. Update status to Absent for past missed clock-outs
        self.repo.mark_past_missed_clockouts_as_absent(current_date_str, self.tenant_id)
        
        # 2. Retrieve unclosed records
        unclosed = self.repo.get_unclosed_attendance_records(self.tenant_id)
        reminders_sent = 0
        
        for record in unclosed:
            try:
                # Combining date and clock_in
                clockin_dt_naive = datetime.strptime(f"{record['date']} {record['clock_in']}", "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    # In case clock_in is HH:MM
                    clockin_dt_naive = datetime.strptime(f"{record['date']} {record['clock_in']}", "%Y-%m-%d %H:%M")
                except Exception:
                    continue
            
            # Make clockin_dt timezone aware
            clockin_dt = tz.localize(clockin_dt_naive)
                
            elapsed_hours = (now_local - clockin_dt).total_seconds() / 3600.0
            
            if elapsed_hours >= 8.0:
                reminder_log = self.repo.get_attendance_reminder(record['id'], self.tenant_id)
                should_send = False
                
                if not reminder_log:
                    should_send = True
                else:
                    last_sent = reminder_log['last_reminder_sent']
                    if last_sent.tzinfo is None:
                        # Assuming last_sent in DB is local time without tz info, or UTC. 
                        # Actually postgres TIMESTAMP is typically returned as naive datetime. 
                        # Let's assume it was stored as local time.
                        last_sent = tz.localize(last_sent)
                    else:
                        last_sent = last_sent.astimezone(tz)
                    
                    hours_since_last = (now_local - last_sent).total_seconds() / 3600.0
                    if hours_since_last >= 12.0:
                        should_send = True
                        
                if should_send:
                    to_email = record.get('employee_email')
                    emp_name = record.get('employee_name')
                    clockin_time = record.get('clock_in')
                    att_date = record.get('date')
                    
                    if to_email:
                        from backend.core.email_service_extended import send_clockout_reminder_email
                        send_clockout_reminder_email(to_email, emp_name, str(clockin_time), str(att_date))
                        
                    # Trigger in-app notification
                    add_notification(
                        title="Missed Clock-Out",
                        message=f"You forgot to clock out on {att_date}. Please submit a correction request.",
                        employee_code=record['employee_code'],
                        n_type="Alert",
                        tenant_id=self.tenant_id
                    )
                    
                    self.repo.upsert_attendance_reminder(record['id'], record['employee_code'], now_local.replace(tzinfo=None), self.tenant_id)
                    reminders_sent += 1
                        
        return {
            "success": True,
            "message": f"Processed missed clock-outs. Sent {reminders_sent} reminders."
        }

    def apply_attendance_correction(self, employee_code: str, date_str: str, clock_in: Optional[str], clock_out: Optional[str], reason: str):
        # 1. Date Validation
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")
        
        today = datetime.now().date()
        if target_date > today:
            raise ValueError("Cannot apply for correction for a future date.")
        
        days_diff = (today - target_date).days
        if days_diff > 7:
            raise ValueError("Correction requests can only be submitted within 7 days of the attendance date.")
            
        # 2. Check for existing attendance record
        existing_att = self.repo.get_todays_attendance(employee_code, date_str, self.tenant_id)
        attendance_id = existing_att['id'] if existing_att else None
        
        # 3. Create correction
        self.repo.create_attendance_correction(
            attendance_id,
            employee_code,
            date_str,
            clock_in,
            clock_out,
            reason,
            self.tenant_id
        )
        
        # 4. Trigger notification and email to manager
        manager_code = self.repo.get_manager_code(employee_code, self.tenant_id)
        if manager_code:
            add_notification(
                title="Attendance Correction Request",
                message=f"Employee {employee_code} has submitted an attendance correction request for {date_str}.",
                employee_code=manager_code,
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )
            
            manager_email = self.repo.get_employee_email(manager_code, self.tenant_id)
            if manager_email:
                employee_name = self.repo.get_employee_name(employee_code, self.tenant_id)
                manager_name = self.repo.get_employee_name(manager_code, self.tenant_id)
                from backend.core.email_service_extended import send_generic_notification_email
                send_generic_notification_email(
                    to_email=manager_email,
                    candidate_name=manager_name,
                    notification_subject="Attendance Correction Pending Approval",
                    notification_message=f"Employee {employee_name} ({employee_code}) has submitted an attendance correction request for {date_str}. Please review and approve/reject it.",
                    company_name=self.tenant_id
                )
        
        return {"success": True, "message": "Attendance correction request submitted successfully"}

    def get_pending_corrections(self, role: str, employee_code: Optional[str]):
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                # Employees only see their own
                corrections = self.repo.get_pending_corrections(None, self.tenant_id)
                return [c for c in corrections if c['employee_code'] == employee_code]
            
        manager_code = employee_code if role == 'manager' else None
        return self.repo.get_pending_corrections(manager_code, self.tenant_id)

    def approve_reject_correction(self, correction_id: int, action: str, rejection_reason: Optional[str], admin_role: str, admin_code: Optional[str]):
        correction = self.repo.get_correction_by_id(correction_id, self.tenant_id)
        if not correction:
            raise ValueError("Correction request not found")
            
        # Prevent self-approval
        if admin_code and correction['employee_code'] == admin_code:
            raise ValueError("You cannot approve your own correction request.")
            
        # Hierarchy check
        applicant_role = self.repo.get_user_role(correction['employee_code'], self.tenant_id)
        
        # If the admin is their direct manager, they can approve it regardless of role
        is_direct_manager = (admin_code and self.repo.get_manager_code(correction['employee_code'], self.tenant_id) == admin_code)
        
        if not is_direct_manager and applicant_role in ['org_admin', 'manager'] and admin_role not in ['org_admin', 'super_admin']:
             raise ValueError("Administrative correction requests can only be approved by an Organization Admin.")
             
        # Update status
        self.repo.update_correction_status(
            correction_id=correction_id,
            status=action,
            approved_by=admin_code,
            rejection_reason=rejection_reason,
            tenant_id=self.tenant_id
        )
        
        if action == 'Approved':
            # Upsert the correction to the main attendance table
            clock_in = correction['clock_in']
            clock_out = correction['clock_out']
            date = correction['date']
            emp_code = correction['employee_code']
            
            # Calculate status
            status = 'Absent'
            if clock_in and clock_out:
                try:
                    fmt = '%H:%M:%S'
                    t_in = datetime.strptime(clock_in, fmt)
                    t_out = datetime.strptime(clock_out, fmt)
                    duration_hours = (t_out - t_in).total_seconds() / 3600.0
                    
                    if duration_hours >= 8.0:
                        status = 'Present'
                    elif duration_hours >= 4.0:
                        if t_in.hour < 13:
                            status = 'Half Day (First Half)'
                        else:
                            status = 'Half Day (Second Half)'
                    else:
                        status = 'Absent'
                except:
                    status = 'Present'
            elif clock_in:
                status = 'Present'
                
            self.repo.upsert_attendance(
                employee_code=emp_code,
                date=date,
                clock_in=clock_in,
                clock_out=clock_out,
                work_log="Correction approved: " + (correction.get('reason') or ''),
                status=status,
                tenant_id=self.tenant_id
            )
            
            # Clear reminders
            if correction.get('attendance_id'):
                self.repo.clear_reminders_for_attendance(correction['attendance_id'], self.tenant_id)
            else:
                # Also find the attendance record that was just inserted/updated to clean up if we can
                new_att = self.repo.get_todays_attendance(emp_code, date, self.tenant_id)
                if new_att:
                    self.repo.clear_reminders_for_attendance(new_att['id'], self.tenant_id)
            
        # Notify employee
        add_notification(
            title=f"Attendance Correction {action}",
            message=f"Your attendance correction request for {correction['date']} has been {action.lower()}.",
            employee_code=correction['employee_code'],
            n_type="Success" if action == 'Approved' else "Alert",
            tenant_id=self.tenant_id
        )
        
        return {"success": True, "message": f"Correction request has been {action.lower()}"}

    def get_bimonthly_report(self, year: int, month: int, cycle: int, manager_code: Optional[str] = None):
        # 1. Determine start and end day based on cycle
        num_days = calendar.monthrange(year, month)[1]
        if cycle == 1:
            start_day = 1
            end_day = 15
        elif cycle == 2:
            start_day = 16
            end_day = num_days
        else:
            raise ValueError("Invalid cycle. Must be 1 or 2.")
            
        start_date = f"{year}-{month:02d}-{start_day:02d}"
        end_date = f"{year}-{month:02d}-{end_day:02d}"
        
        # 2. Fetch employees based on manager segmentation
        employees = self.repo.get_employees_for_reporting(manager_code, self.tenant_id)
        
        # 3. Fetch attendance and leave records for the date range
        attendance_rows = self.repo.get_monthly_attendance(start_date, end_date, self.tenant_id)
        leave_rows = self.repo.get_monthly_approved_leaves(start_date, end_date, self.tenant_id)
        
        # Process maps
        att_map = {}
        for row in attendance_rows:
            e_code = row['employee_code']
            if e_code not in att_map: att_map[e_code] = {}
            
            d_val = row['date']
            d_str = d_val.strftime('%Y-%m-%d') if hasattr(d_val, 'strftime') else str(d_val)
            
            clock_in = row.get('clock_in')
            clock_out = row.get('clock_out')
            
            if clock_in and clock_out:
                try:
                    t_in = datetime.strptime(str(clock_in), '%H:%M:%S') if isinstance(clock_in, str) else datetime.combine(datetime.min, clock_in)
                    t_out = datetime.strptime(str(clock_out), '%H:%M:%S') if isinstance(clock_out, str) else datetime.combine(datetime.min, clock_out)
                    duration_hours = (t_out - t_in).total_seconds() / 3600.0
                    
                    if duration_hours >= 8.0:
                        att_map[e_code][d_str] = 'Present'
                    elif duration_hours >= 4.0:
                        if t_in.hour < 13:
                            att_map[e_code][d_str] = 'Half Day (First Half)'
                        else:
                            att_map[e_code][d_str] = 'Half Day (Second Half)'
                    else:
                        att_map[e_code][d_str] = 'Absent'
                except:
                    att_map[e_code][d_str] = 'Present'
            elif clock_in:
                today_str = datetime.now().strftime('%Y-%m-%d')
                if d_str == today_str:
                    att_map[e_code][d_str] = 'Active'
                else:
                    att_map[e_code][d_str] = 'Absent'
            else:
                 att_map[e_code][d_str] = 'Absent'
                 
        leave_map = {}
        for row in leave_rows:
            code = row['employee_code']
            if code not in leave_map: leave_map[code] = {}
            
            try:
                # leaves might have string dates YYYY-MM-DD
                d1 = datetime.strptime(row['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(row['end_date'], '%Y-%m-%d')
                
                range_start = datetime(year, month, start_day)
                range_end = datetime(year, month, end_day)
                
                curr = max(d1, range_start)
                end = min(d2, range_end)
                
                while curr <= end:
                    d_str = curr.strftime('%Y-%m-%d')
                    l_status = 'Leave'
                    if curr == d1 and row.get('start_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('start_day_type')})"
                    if curr == d2 and row.get('end_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('end_day_type')})"
                    
                    leave_map[code][d_str] = l_status
                    curr += timedelta(days=1)
            except:
                pass
                
        report = []
        for emp in employees:
            code = emp['employee_code']
            days = []
            present_count = 0
            half_day_count = 0
            leave_count = 0
            absent_count = 0
            
            for day in range(start_day, end_day + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                status = 'Absent'
                
                if code in leave_map and date_str in leave_map[code]:
                    status = leave_map[code][date_str]
                    if status == 'Leave':
                        leave_count += 1
                    else:
                        leave_count += 0.5
                elif code in att_map and date_str in att_map[code]:
                    status = att_map[code][date_str]
                    if status == 'Present' or status == 'Active':
                        present_count += 1
                    elif status.startswith('Half Day'):
                        half_day_count += 1
                    elif status == 'Absent':
                        absent_count += 1
                else:
                    try:
                        dt = datetime(year, month, day)
                        dt_date = dt.date()
                        today_date = datetime.now().date()
                        
                        if dt.weekday() >= 5: 
                            status = 'Weekend'
                        elif dt_date > today_date:
                            status = 'Future'
                        elif dt_date == today_date:
                            status = 'Not Started' 
                        else:
                            status = 'Absent'
                            absent_count += 1
                    except:
                        pass
                
                days.append({"day": day, "status": status, "date": date_str})
                
            report.append({
                "name": emp['name'],
                "code": code,
                "days": days,
                "stats": {
                    "present": present_count,
                    "half_day": half_day_count,
                    "leave": leave_count,
                    "absent": absent_count
                }
            })
            
        return report

