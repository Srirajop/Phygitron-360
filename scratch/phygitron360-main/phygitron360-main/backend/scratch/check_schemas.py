import psycopg2
from backend.core.database import get_db_connection

def check_schemas():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT schema_name FROM information_schema.schemata")
        schemas = cur.fetchall()
        print("Available schemas:")
        for s in schemas:
            print(f"- {s[0]}")
            
        cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'employees'")
        tables = cur.fetchall()
        print("\nLocations of 'employees' table:")
        for t in tables:
            print(f"- {t[0]}.{t[1]}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_schemas()
