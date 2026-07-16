import psycopg2
from backend.core.database import get_db_connection

def check_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'tenant_template' AND table_name = 'employees'")
        cols = cur.fetchall()
        print("Columns in tenant_template.employees:")
        for col in cols:
            print(f"- {col[0]}")
            
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'tenant_template' AND table_name = 'employee_skills'")
        cols = cur.fetchall()
        print("\nColumns in tenant_template.employee_skills:")
        for col in cols:
            print(f"- {col[0]}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_schema()
