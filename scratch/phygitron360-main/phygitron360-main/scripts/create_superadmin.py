import sys
import os

# Add the project root to sys.path so we can import internal modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.modules.deploy.services.auth_service import AuthService
from backend.core.database import get_db_connection

def create_superadmin(username, password):
    auth_service = AuthService()
    
    # Check if Superadmin already exists in public schema
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO public")
            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cur.fetchone():
                print(f"Error: User '{username}' already exists.")
                return
            
            # Create user
            auth_service.create_user(username, password, role='super_admin')
            print(f"Successfully created Superadmin user: {username}")
    except Exception as e:
        print(f"Error creating superadmin: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create a Superadmin user in the public schema.")
    parser.add_argument("username", help="The username for the superadmin")
    parser.add_argument("password", help="The password for the superadmin")
    
    args = parser.parse_args()
    create_superadmin(args.username, args.password)
