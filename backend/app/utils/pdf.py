import io
import re
import os
from typing import Optional

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    import pytesseract
    from PIL import Image as PILImage
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes. Falls back to OCR if text extraction fails."""
    if not HAS_FITZ:
        return ""

    text_parts = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            if text.strip():
                text_parts.append(text)
            elif HAS_OCR:
                try:
                    pix = page.get_pixmap(dpi=300)
                    img_bytes = pix.tobytes("png")
                    image = PILImage.open(io.BytesIO(img_bytes))
                    ocr_text = pytesseract.image_to_string(image)
                    if ocr_text.strip():
                        text_parts.append(ocr_text)
                except Exception as e:
                    print(f"OCR failed for page {page_num}: {e}")
        doc.close()
    except Exception as e:
        raise Exception(f"PDF text extraction failed: {str(e)}")

    return "\n\n".join(text_parts)

def clean_extracted_text(text: str) -> str:
    """Remove excessive whitespace and normalize text."""
    text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()

def extract_text_from_docx(docx_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        import docx
        doc = docx.Document(io.BytesIO(docx_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return "\n\n".join(full_text)
    except Exception as e:
        raise Exception(f"DOCX text extraction failed: {str(e)}")


def generate_professional_pdf(content: dict, output_path: str):
    """Generate a branded PDF by overlaying text onto the EWANDZ 2026 offer letter template."""
    import fitz
    import os
    from datetime import datetime

    base_dir = os.path.dirname(os.path.dirname(__file__))  # app/
    template_path = os.path.join(base_dir, "assets", "Offer_Letter_Template_2026.pdf")

    if not os.path.exists(template_path):
        raise Exception(f"Template not found at {template_path}")

    doc = fitz.open(template_path)

    # ── Page 0: Update Date ──────────────────────────────────────────────────────
    p0 = doc[0]
    # Redact the hardcoded date ("25 May, 2026")
    p0.add_redact_annot(fitz.Rect(450, 650, 550, 675))
    p0.apply_redactions()

    try:
        date_str = datetime.utcnow().strftime("%-d %B, %Y")
    except ValueError:
        date_str = datetime.utcnow().strftime("%d %B, %Y").lstrip("0")
        
    p0.insert_text((468, 665), date_str, fontsize=11, fontname="helv", color=(0,0,0))

    # ── Page 1: Update Letter Body ───────────────────────────────────────────────
    p1 = doc[1]
    # Redact the body text from "Dear XYZ" down to "We look forward..."
    # The signature and footer are left fully intact.
    p1.add_redact_annot(fitz.Rect(70, 120, 550, 390))
    p1.apply_redactions()

    body_text = content.get("salutation", "Dear Candidate,") + "\n\n"
    for para in content.get("body_paragraphs", []):
        if para and para.strip():
            body_text += para.strip() + "\n\n"
            
    body_text = body_text.strip()

    # Use insert_textbox to automatically wrap the text within the bounds.
    # PyMuPDF fails silently if the text overflows the rect by even 1 pixel.
    # We dynamically adjust font size downwards to ensure it always fits.
    rect = fitz.Rect(72, 122, 540, 400)
    inserted = False
    for fs in [10.5, 10.0, 9.5, 9.0, 8.5]:
        rc = p1.insert_textbox(rect, body_text, fontsize=fs, fontname="helv", color=(0,0,0), align=0)
        if rc >= 0:
            inserted = True
            break
            
    if not inserted:
        # Extreme fallback for unusually long text
        rect_fallback = fitz.Rect(72, 122, 540, 430)
        p1.insert_textbox(rect_fallback, body_text, fontsize=8.0, fontname="helv", color=(0,0,0), align=0)

    doc.save(output_path)
