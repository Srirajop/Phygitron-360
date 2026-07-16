from typing import Dict, Any
import pandas as pd
from backend.modules.deploy.repositories.dashboard_repo import DashboardRepository

class DashboardService:
    def __init__(self):
        self.repo = DashboardRepository()

    def get_admin_stats(self, tenant_id: str = 'public') -> Dict[str, Any]:
        try:
            data = self.repo.get_all_counts(tenant_id=tenant_id)
            df_emp = data['employees']
            df_assets = data['assets']
            df_skills = data['skills']
            
            # 1. Basic Counts
            total_employees = len(df_emp)
            active_count = len(df_emp[df_emp['employment_status'].fillna('').str.lower() == 'active']) if not df_emp.empty and 'employment_status' in df_emp.columns else 0
            exited_count = len(df_emp[df_emp['employment_status'].fillna('').str.lower() == 'exited']) if not df_emp.empty and 'employment_status' in df_emp.columns else 0
            total_teams = df_emp['team'].nunique() if not df_emp.empty and 'team' in df_emp.columns else 0
            total_designations = df_emp['designation'].nunique() if not df_emp.empty and 'designation' in df_emp.columns else 0
            total_candidates = len(data.get('candidates', pd.DataFrame()))
            total_jobs = len(data.get('job_roles', pd.DataFrame()))

            # 2. Department Distribution
            department_distribution = []
            if not df_emp.empty and 'team' in df_emp.columns:
                dept_counts = df_emp['team'].fillna('Unknown').value_counts().reset_index()
                dept_counts.columns = ['name', 'value']
                department_distribution = dept_counts.to_dict('records')

            # 3. Employment Status Distribution
            status_distribution = []
            if not df_emp.empty and 'employment_status' in df_emp.columns:
                status_counts = df_emp['employment_status'].fillna('Active').value_counts().reset_index()
                status_counts.columns = ['name', 'value']
                status_distribution = status_counts.to_dict('records')

            # 4. Hiring Trend (Yearly)
            hiring_trend = []
            if not df_emp.empty and 'doj' in df_emp.columns:
                df_emp.loc[:, 'doj_dt'] = pd.to_datetime(df_emp['doj'], errors='coerce')
                df_emp.loc[:, 'Year'] = df_emp['doj_dt'].dt.year.fillna(0).astype(int)
                hiring_trend_df = df_emp[df_emp['Year'] > 1900].groupby('Year').size().reset_index(name='Hires')
                hiring_trend_df = hiring_trend_df.sort_values('Year')
                hiring_trend = hiring_trend_df.to_dict('records')

            # 5. Asset Inventory
            asset_distribution = []
            if not df_assets.empty:
                def get_asset_status(row):
                    if row.get('cl_laptop', 0) == 1: return "Returned"
                    elif row.get('ob_laptop', 0) == 1: return "Assigned"
                    else: return "None"
                df_assets['status'] = df_assets.apply(get_asset_status, axis=1)
                asset_counts = df_assets[df_assets['status'] != 'None']['status'].value_counts().reset_index()
                asset_counts.columns = ['name', 'value']
                asset_distribution = asset_counts.to_dict('records')

            # 6. Top Skills
            top_skills = []
            if not df_skills.empty and 'primary_skillset' in df_skills.columns:
                all_skills = []
                for skills_str in df_skills['primary_skillset'].dropna():
                    if skills_str:
                        parts = [s.strip() for s in skills_str.split(',')]
                        all_skills.extend(parts)
                if all_skills:
                    skill_counts = pd.Series(all_skills).value_counts().head(7).reset_index()
                    skill_counts.columns = ['name', 'value']
                    top_skills = skill_counts.to_dict('records')

            # 7. Experience Distribution
            experience_distribution = []
            if not df_skills.empty and 'experience_years' in df_skills.columns:
                df_skills.loc[:, 'experience_years_num'] = pd.to_numeric(df_skills['experience_years'], errors='coerce')
                bins = [-1, 2, 5, 10, 15, 100]
                labels = ['0-2', '3-5', '6-10', '11-15', '16+']
                df_skills.loc[:, 'exp_range'] = pd.cut(df_skills['experience_years_num'], bins=bins, labels=labels, right=True)
                exp_counts = df_skills['exp_range'].value_counts().sort_index().reset_index()
                exp_counts.columns = ['range', 'count']
                exp_counts.loc[:, 'count'] = exp_counts['count'].fillna(0)
                experience_distribution = exp_counts.to_dict('records')

            # 8. Avg Tenure
            avg_tenure = 0
            tenure_distribution = []
            if not df_emp.empty and 'doj' in df_emp.columns:
                df_emp.loc[:, 'doj_dt'] = pd.to_datetime(df_emp['doj'], errors='coerce')
                now = pd.Timestamp.now()
                df_emp.loc[:, 'tenure_days'] = (now - df_emp['doj_dt']).dt.days
                active_df = df_emp[df_emp['employment_status'] == 'Active'].copy() if 'employment_status' in df_emp.columns else df_emp.copy()
                if not active_df.empty:
                    mean_tenure = active_df['tenure_days'].mean()
                    avg_tenure = round(mean_tenure / 365, 1) if pd.notna(mean_tenure) else 0.0
                    active_df.loc[:, 'tenure_years'] = active_df['tenure_days'] / 365
                    bins = [-100, 1, 2, 5, 100]
                    labels = ['0-1y', '1-2y', '2-5y', '5y+']
                    active_df.loc[:, 'tenure_range'] = pd.cut(active_df['tenure_years'], bins=bins, labels=labels, right=True)
                    tenure_counts = active_df['tenure_range'].value_counts().sort_index().reset_index()
                    tenure_counts.columns = ['range', 'count']
                    tenure_counts.loc[:, 'count'] = tenure_counts['count'].fillna(0)
                    tenure_distribution = tenure_counts.to_dict('records')

            # 9. Location
            location_distribution = []
            if not df_emp.empty and 'location' in df_emp.columns:
                loc_counts = df_emp['location'].fillna('Unknown').value_counts().reset_index()
                loc_counts.columns = ['name', 'value']
                location_distribution = loc_counts.to_dict('records')

            # 10. Recent Hires
            recent_hires = []
            if not df_emp.empty and 'doj' in df_emp.columns:
                recent_df = df_emp.sort_values(by='doj', ascending=False).head(5).copy()
                def safe_strftime(x):
                    try: return pd.to_datetime(x).strftime('%Y-%m-%d')
                    except: return str(x)
                recent_df.loc[:, 'doj_str'] = recent_df['doj'].apply(safe_strftime)
                # Ensure all expected keys exist
                for col in ['name', 'team', 'designation', 'doj_str', 'location', 'employee_code', 'employment_status']:
                    if col not in recent_df.columns: recent_df[col] = None
                recent_hires = recent_df[['name', 'team', 'designation', 'doj_str', 'location', 'employee_code', 'employment_status']].replace({pd.NA: None, float('nan'): None}).to_dict('records')

            # Notifications
            notifications = []
            if not data['notifications'].empty:
                notifications = data['notifications'].replace({pd.NA: None, float('nan'): None}).fillna("").to_dict('records')

            return {
                "counts": {
                    "total": total_employees, "active": active_count, "exited": exited_count,
                    "teams": total_teams, "designations": total_designations,
                    "candidates": total_candidates, "jobs": total_jobs, "avg_tenure": avg_tenure
                },
                "charts": {
                    "department": department_distribution, "status": status_distribution,
                    "hiring_trend": hiring_trend, "assets": asset_distribution,
                    "skills": top_skills, "experience": experience_distribution,
                    "tenure": tenure_distribution, "location": location_distribution
                },
                "recent_hires": recent_hires, "notifications": notifications
            }
        except Exception as e:
            import traceback
            print(f"CRITICAL ANALYTICS ERROR: {e}")
            traceback.print_exc()
            raise e

    def get_employee_stats(self, employee_code: str, tenant_id: str = 'public') -> Dict[str, Any]:
        data = self.repo.get_employee_dashboard_data(employee_code, tenant_id=tenant_id)
        
        # Safely extract
        emp = data['employee'] 
        kras = data['kras']
        training = data['training']
        
        return {
            "employee": {
                "name": emp.get("name"),
                "designation": emp.get("designation"),
                "team": emp.get("team"),
                "location": emp.get("location"),
                "doj": emp.get("doj"),
                "photo_path": emp.get("photo_path"),
                "employee_code": emp.get("employee_code"),
                "employment_type": emp.get("employment_type"),
                "phone": emp.get("contact_number"),
                "personal_email": emp.get("email_id"),
            },
            "kras": {"total": kras.get("total", 0), "completed": kras.get("completed", 0) or 0},
            "training": {"total": training.get("total", 0), "completed": training.get("completed", 0) or 0},
            "training_list": data.get('training_list', []),
            "assets": {"total": data['asset_count']},
            "notifications": data['notifications'],
            "attendance": {
                "status": data['attendance_status'],
                "today": data.get('attendance_today'),
                "month": data.get('attendance_month', {"present": 0, "half_day": 0, "absent": 0}),
                "history": data.get('attendance_history', [])
            },
            "leaves": data['leaves'],
            "recent_leaves": data.get('recent_leaves', []),
            "latest_performance": data.get('latest_performance'),
            "performance_history": data.get('performance_history', []),
        }
