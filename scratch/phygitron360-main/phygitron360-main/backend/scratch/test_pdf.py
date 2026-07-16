import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from common.utils.pdf_utils import generate_ewandz_offer_pdf
import fitz
import io

offer = {
    "candidate_name": "God",
    "role_title": "God",
    "salary": "445455",
    "start_date": "2026-07-24",
    "offer_content": {
        "salutation": "Dear God,",
        "body_paragraphs": ["We are pleased to offer you the position of God.", "Offered salary: 445455."],
        "closing": "Sincerely,",
        "signatory_name": "Zainab Ghazi",
        "signatory_title": "Manager - Talent Acquisition"
    }
}

pdf_bytes = generate_ewandz_offer_pdf(offer)

# Now overlay
doc_text = fitz.open(stream=pdf_bytes, filetype="pdf")
doc_template = fitz.open(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'offer_blank_template.pdf')))

for i in range(len(doc_text)):
    if i < len(doc_template):
        page_temp = doc_template[i]
    else:
        page_temp = doc_template.insert_page(-1, width=doc_template[-1].rect.width, height=doc_template[-1].rect.height)
        page_temp.show_pdf_page(page_temp.rect, doc_template, len(doc_template)-2)

    page_text = doc_text[i]
    page_temp.show_pdf_page(page_temp.rect, doc_text, i)

output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'output.pdf'))
doc_template.save(output_path)
print(f"Saved to {output_path}")
