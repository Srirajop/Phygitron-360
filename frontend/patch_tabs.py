import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\OfferApprovals.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replacing Offer Letters Tab
    content = content.replace(">\n          Offer Letters\n        </button>", ">\n          Employee Tracker\n        </button>")
    
    # Replacing Lifecycle Tracking Tab
    content = content.replace(">\n          Lifecycle Tracking\n        </button>", ">\n          Candidate Tracker\n        </button>")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Tabs renamed successfully!")
except Exception as e:
    print("Error:", e)
