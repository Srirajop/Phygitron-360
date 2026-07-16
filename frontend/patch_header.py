import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\OfferApprovals.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replacing Offer Letters & Lifecycle
    content = content.replace("<h1>{isHr ? 'Offer Letters & Lifecycle' : 'Offer Letter Approvals'}</h1>", "<h1>{isHr ? 'Employee & Candidate Tracker' : 'Employee Tracker Approvals'}</h1>")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Header renamed successfully!")
except Exception as e:
    print("Error:", e)
