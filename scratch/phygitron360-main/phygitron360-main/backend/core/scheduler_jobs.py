import asyncio
from datetime import datetime
import calendar
from backend.core.database import get_db_connection
from backend.modules.deploy.services.attendance_service import AttendanceService
from backend.modules.deploy.repositories.attendance_repo import AttendanceRepository
from backend.core.email_service_extended import send_bimonthly_report_email

def get_active_tenants():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, company_name FROM public.tenants WHERE is_active = TRUE")
        return cur.fetchall()
    except Exception:
        return []
    finally:
        conn.close()

def run_missed_clockout_check():
    tenants = get_active_tenants()
    for tenant_id, company_name in tenants:
        try:
            service = AttendanceService(tenant_id=tenant_id)
            service.check_and_trigger_missed_clockout_reminders()
        except Exception as e:
            print(f"Error running missed clockout check for tenant {tenant_id}: {e}")

def run_bimonthly_report():
    today = datetime.now()
    year = today.year
    month = today.month
    day = today.day
    
    last_day = calendar.monthrange(year, month)[1]
    
    cycle = None
    if day == 15:
        cycle = 'mid'
    elif day == last_day:
        cycle = 'end'
        
    if not cycle:
        return
        
    # Check idempotency
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM public.bimonthly_report_log WHERE year = %s AND month = %s AND cycle = %s",
            (year, month, cycle)
        )
        if cur.fetchone():
            return # Already sent
            
        cur.execute(
            "INSERT INTO public.bimonthly_report_log (year, month, cycle) VALUES (%s, %s, %s)",
            (year, month, cycle)
        )
        conn.commit()
    except Exception as e:
        print(f"Error checking/inserting bimonthly log: {e}")
        return
    finally:
        conn.close()

    cycle_num = 1 if cycle == 'mid' else 2
    period_label = f"1st - 15th {calendar.month_name[month]} {year}" if cycle == 'mid' else f"16th - {last_day}th {calendar.month_name[month]} {year}"

    tenants = get_active_tenants()
    for tenant_id, company_name in tenants:
        try:
            service = AttendanceService(tenant_id=tenant_id)
            repo = AttendanceRepository()
            managers = repo.get_all_managers(tenant_id)
            
            for manager_code in managers:
                manager_email = repo.get_employee_email(manager_code, tenant_id)
                manager_name = repo.get_employee_name(manager_code, tenant_id)
                if not manager_email:
                    continue
                    
                report_data = service.get_bimonthly_report(year, month, cycle_num, manager_code)
                if not report_data:
                    continue
                    
                send_bimonthly_report_email(
                    to_email=manager_email,
                    manager_name=manager_name,
                    report_data=report_data,
                    period_label=period_label,
                    company_name=company_name
                )
        except Exception as e:
            print(f"Error sending bimonthly report for tenant {tenant_id}: {e}")
