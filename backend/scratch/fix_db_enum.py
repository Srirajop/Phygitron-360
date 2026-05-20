import pymysql
import os
from dotenv import load_dotenv

def fix_enums():
    load_dotenv()
    host = os.getenv('DB_HOST', 'localhost')
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    
    conn = pymysql.connect(host=host, user=user, password=password, database=db_name)
    cursor = conn.cursor()
    
    try:
        # Fix Employee status
        print("Altering employees table status column...")
        emp_statuses = ["active", "on_leave", "deployed", "notice_period", "offboarded", "exited"]
        emp_enum = ", ".join([f"'{s}'" for s in emp_statuses])
        cursor.execute(f"ALTER TABLE employees MODIFY COLUMN status ENUM({emp_enum}) DEFAULT 'active'")
        
        # Fix Offer status (added changes_requested)
        print("Altering offer_letters table status column...")
        offer_statuses = ["pending", "approved", "rejected", "changes_requested", "sent", "accepted", "declined"]
        offer_enum = ", ".join([f"'{s}'" for s in offer_statuses])
        cursor.execute(f"ALTER TABLE offer_letters MODIFY COLUMN status ENUM({offer_enum}) DEFAULT 'pending'")
        
        conn.commit()
        print("Successfully updated ENUM columns.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_enums()
