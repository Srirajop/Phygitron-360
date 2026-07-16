import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from common.utils.pdf_utils import generate_ewandz_offer_pdf

offer = {
    "candidate_name": "God",
    "role_title": "God",
    "salary": "445455",
    "start_date": "2026-07-24",
    "location": "Delhi",
    "offer_content": {
        "salutation": "Dear God,",
        "body_paragraphs": ["We are pleased to offer you the position of God.", "Offered salary: 445455."],
        "closing": "Sincerely,",
        "signatory_name": "Zainab Ghazi",
        "signatory_title": "Manager - Talent Acquisition"
    }
}

pdf_bytes = generate_ewandz_offer_pdf(offer)

with open('scratch/output_layout.pdf', 'wb') as f:
    f.write(pdf_bytes)

print("Saved to scratch/output_layout.pdf")
