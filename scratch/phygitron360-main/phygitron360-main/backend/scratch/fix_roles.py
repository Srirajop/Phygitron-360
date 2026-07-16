import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "phygitron360")
DB_USER = os.getenv("DB_USER", "cluxssy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

def fix_all_schemas():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    try:
        cur = conn.cursor()
        
        # Get all schemas
        cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'")
        schemas = [s[0] for s in cur.fetchall()]
        
        print(f"Detected Schemas: {', '.join(schemas)}")
        
        for schema in schemas:
            print(f"Applying fix to schema: {schema}...")
            # Set search path to this schema
            cur.execute(f'SET search_path TO "{schema}"')
            
            # Drop and re-create constraint
            cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
            cur.execute("""
                ALTER TABLE users ADD CONSTRAINT users_role_check 
                CHECK (role IN (
                    'super_admin', 'org_admin', 'manager', 'employee', 'candidate'
                ))
            """)
            print(f"  - Successfully updated constraints in {schema}")
        
        conn.commit()
        print("\nGLOBAL Success: All database schemas standardized to 5 authorized roles.")
    except Exception as e:
        print(f"Error in {schema}: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_all_schemas()
