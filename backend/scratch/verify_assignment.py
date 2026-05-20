import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "Demo@1234"

def test_flow():
    print("1. Logging in as HR...")
    with httpx.Client() as client:
        # Login HR
        res = client.post(f"{BASE_URL}/auth/login", json={"email": "hr@ewandz.com", "password": PASSWORD})
        if res.status_code != 200:
            print(f"[X] HR Login failed: {res.text}")
            sys.exit(1)
        
        hr_token = res.json()["data"]["access_token"]
        headers_hr = {"Authorization": f"Bearer {hr_token}"}
        print("[OK] HR Logged in successfully.")

        # Get My Courses (Course Builder list)
        print("2. Fetching organization courses as HR...")
        res = client.get(f"{BASE_URL}/forge/my-courses", headers=headers_hr)
        if res.status_code != 200:
            print(f"[X] Fetching courses failed: {res.text}")
            sys.exit(1)
        
        courses = res.json()["data"]
        print(f"[OK] Found {len(courses)} courses in organization.")
        for c in courses:
            print(f"  - Course ID: {c['id']}, Title: {c['title']}, Status: {c['status']}")
        
        if not courses:
            print("[X] No courses found to assign! Run seed script first.")
            sys.exit(1)
            
        course_id = courses[0]["id"]
        
        # Get users to assign to
        print("3. Fetching candidate/employee users as HR...")
        res = client.get(f"{BASE_URL}/admin/users", headers=headers_hr)
        if res.status_code != 200:
            print(f"[X] Fetching users failed: {res.text}")
            sys.exit(1)
        
        users = res.json()["data"]
        employee = None
        for u in users:
            if u["email"] == "employee@ewandz.com":
                employee = u
                break
                
        if not employee:
            print("[X] Emma Employee not found!")
            sys.exit(1)
            
        print(f"[OK] Emma Employee found: ID={employee['id']}, Name={employee['full_name']}")

        # Perform Bulk Enroll (Assign Course)
        print(f"4. Assigning Course ID {course_id} to Emma Employee...")
        deadline_str = "2026-06-30T00:00:00.000Z"
        enroll_payload = {
            "course_id": course_id,
            "user_ids": [employee["id"]],
            "deadline": deadline_str
        }
        res = client.post(f"{BASE_URL}/forge/bulk-enroll", json=enroll_payload, headers=headers_hr)
        if res.status_code != 200:
            print(f"[X] Course assignment failed: {res.text}")
            sys.exit(1)
        print("[OK] Course assigned successfully via bulk-enroll API.")

        # Log in as Employee
        print("5. Logging in as Emma Employee...")
        res = client.post(f"{BASE_URL}/auth/login", json={"email": "employee@ewandz.com", "password": PASSWORD})
        if res.status_code != 200:
            print(f"[X] Employee Login failed: {res.text}")
            sys.exit(1)
            
        emp_token = res.json()["data"]["access_token"]
        headers_emp = {"Authorization": f"Bearer {emp_token}"}
        print("[OK] Emma Employee logged in.")

        # Fetch learner dashboard
        print("6. Fetching Learner Dashboard...")
        res = client.get(f"{BASE_URL}/forge/dashboard", headers=headers_emp)
        if res.status_code != 200:
            print(f"[X] Fetching dashboard failed: {res.text}")
            sys.exit(1)
            
        dashboard_data = res.json()["data"]
        in_progress = dashboard_data.get("in_progress", [])
        
        assigned_course = None
        for c in in_progress:
            if c["course_id"] == course_id:
                assigned_course = c
                break
                
        if not assigned_course:
            print("[X] Assigned course not found in Employee's active list!")
            sys.exit(1)
            
        print("[OK] Assigned course found in Employee's active list.")
        print(f"   - Title: {assigned_course['title']}")
        print(f"   - Progress: {assigned_course.get('progress_percent')}%")
        print(f"   - Triggered By: {assigned_course.get('triggered_by')}")
        print(f"   - Deadline: {assigned_course.get('deadline')}")
        
        # Assertions
        assert assigned_course.get("triggered_by") == "hr_push", f"Expected triggered_by='hr_push', got '{assigned_course.get('triggered_by')}'"
        assert assigned_course.get("deadline") is not None, "Expected deadline to be set, got None"
        
        print("\n*** ALL INTEGRATION TESTS PASSED SUCCESSFULY! ***")

if __name__ == "__main__":
    test_flow()
