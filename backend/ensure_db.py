import pymysql
import os
from dotenv import load_dotenv

def init_db():
    load_dotenv()
    host = os.getenv('DB_HOST', 'localhost')
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    
    print(f"Connecting to MySQL at {host} as {user}...")
    try:
        conn = pymysql.connect(host=host, user=user, password=password)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        conn.close()
        print(f"Database '{db_name}' ensured.")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    init_db()
