import psycopg2
import os
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "phygitron360")
DB_USER = os.getenv("DB_USER", "cluxssy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

def check_employees():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f'SET search_path TO "tenant_ewandz"')
        cur.execute("SELECT employee_code, name, email_id FROM employees")
        emps = cur.fetchall()
        print("Employees in tenant_ewandz:")
        for e in emps:
            print(e)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_employees()
