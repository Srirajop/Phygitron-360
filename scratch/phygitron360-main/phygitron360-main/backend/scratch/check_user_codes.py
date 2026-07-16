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

def check_users():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Search in all schemas for users
        cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'")
        schemas = [s['schema_name'] for s in cur.fetchall()]
        
        for schema in schemas:
            print(f"\n--- Users in Schema: {schema} ---")
            cur.execute(f'SET search_path TO "{schema}"')
            cur.execute("SELECT id, username, role, employee_code FROM users")
            users = cur.fetchall()
            for u in users:
                print(u)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_users()
