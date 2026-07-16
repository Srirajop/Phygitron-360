import os
import sys

# Add the parent directory of backend to the python path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(parent_dir)

from backend.core.database import get_db_connection

def migrate():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        print("Migrating leave_balances table...")
        # Alter leave_balances columns to REAL
        cur.execute("""
            ALTER TABLE leave_balances
            ALTER COLUMN total_leaves TYPE REAL,
            ALTER COLUMN used_leaves TYPE REAL,
            ALTER COLUMN extended_leaves TYPE REAL;
        """)
        
        print("Migrating leaves table...")
        # Add new columns to leaves table
        cur.execute("""
            ALTER TABLE leaves
            ADD COLUMN IF NOT EXISTS duration_days REAL,
            ADD COLUMN IF NOT EXISTS start_day_type TEXT,
            ADD COLUMN IF NOT EXISTS end_day_type TEXT;
        """)
        
        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
