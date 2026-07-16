from psycopg2.extras import RealDictCursor
from backend.core.database import get_db_connection

conn = get_db_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'")
schemas = cur.fetchall()

for sc in schemas:
    schema = sc['schema_name']
    print(f"=== SCHEMA {schema} ===")
    cur.execute(f'SET search_path TO "{schema}"')
    cur.execute("SELECT id, username, employee_code, role FROM users")
    users = cur.fetchall()
    print("USERS:", users)
    cur.execute("SELECT employee_code, name FROM employees")
    emps = cur.fetchall()
    print("EMPLOYEES:", emps)
