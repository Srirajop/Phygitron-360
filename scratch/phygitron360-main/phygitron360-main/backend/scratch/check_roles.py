import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "phygitron360")
DB_USER = os.getenv("DB_USER", "cluxssy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

def check_current_roles():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT role FROM users")
        roles = cur.fetchall()
        print("Current unique roles in 'users' table:")
        for r in roles:
            print(f"- {r[0]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_current_roles()
