import psycopg2
from backend.core.database import get_db_connection

def check_cols():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees'")
        cols = cur.fetchall()
        print("Columns in public.employees:")
        for col in cols:
            print(f"- {col[0]}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_cols()
