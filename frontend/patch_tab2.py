import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\OfferApprovals.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace(">\n          Employee Tracker\n        </button>", ">\n          Offer Tracker\n        </button>")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Tab renamed successfully!")
except Exception as e:
    print("Error:", e)
