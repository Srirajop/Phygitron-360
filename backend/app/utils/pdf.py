import io
import re
from typing import Optional

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    import pytesseract
    from PIL import Image
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
                # Page is likely a scanned image — use OCR
                pix = page.get_pixmap(dpi=300)
                img_bytes = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_bytes))
                ocr_text = pytesseract.image_to_string(image)
                if ocr_text.strip():
                    text_parts.append(ocr_text)
        doc.close()
    except Exception as e:
        raise Exception(f"PDF text extraction failed: {str(e)}")

    return "\n\n".join(text_parts)


def clean_extracted_text(text: str) -> str:
    """Remove excessive whitespace and normalize text."""
    # Remove non-printable characters
    text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Collapse multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def generate_professional_pdf(content: dict, output_path: str):
    """Generate a branded PDF using ReportLab with AI content and extracted assets."""
    import os
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.colors import HexColor

    BLUE_COLOR = HexColor("#0070C0") # Corporate Blue

    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    styles.add(ParagraphStyle(name='OfferContent', parent=styles['Normal'], fontSize=11, leading=14, spaceAfter=12))
    styles.add(ParagraphStyle(name='OfferTitle', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=24, color=BLUE_COLOR, underline=True))
    styles.add(ParagraphStyle(name='OfferSignatory', parent=styles['Normal'], fontSize=12, leading=14, color=BLUE_COLOR, fontWeight='bold'))
    styles.add(ParagraphStyle(name='OfferFooter', parent=styles['Normal'], fontSize=7, color="#6B7280", alignment=TA_LEFT, leading=9))

    elements = []
    base_dir = os.path.dirname(os.path.dirname(__file__)) # app/
    logo_path = os.path.join(base_dir, "assets", "offer_img_0.png")
    sign_path = os.path.join(base_dir, "assets", "offer_img_1.png")

    # Logo
    if os.path.exists(logo_path):
        elements.append(Image(logo_path, width=2.5*inch, height=0.7*inch, hAlign='LEFT'))
        elements.append(Spacer(1, 0.3*inch))

    elements.append(Paragraph("OFFER LETTER", styles['OfferTitle']))
    
    # Date and Location
    from datetime import datetime
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    elements.append(Paragraph(f"Date: {date_str}", styles['Normal']))
    elements.append(Paragraph("Delhi,", styles['Normal']))
    elements.append(Spacer(1, 0.4*inch))

    # Salutation
    elements.append(Paragraph(content.get("salutation", "Dear Candidate,"), styles['OfferContent']))

    # Body
    for para in content.get("body_paragraphs", []):
        elements.append(Paragraph(para, styles['OfferContent']))
        elements.append(Spacer(1, 0.1*inch))

    elements.append(Paragraph(content.get("closing", "Sincerely,"), styles['OfferContent']))
    elements.append(Spacer(1, 0.1*inch))

    # Signature
    if os.path.exists(sign_path):
        elements.append(Image(sign_path, width=1.6*inch, height=1.3*inch, hAlign='LEFT'))
    
    elements.append(Paragraph(f"{content.get('signatory_name', 'Zainab Ghazi')}", styles['OfferSignatory']))
    elements.append(Paragraph(content.get('signatory_title', 'Manager - Global HR Operations'), styles['OfferSignatory']))
    elements.append(Paragraph(f"Date: {date_str}", styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 1*inch))
    # Footer info left aligned as per original
    elements.append(Paragraph("EWANDZDIGITAL SERVICES PVT LTD", styles['OfferFooter']))
    elements.append(Paragraph("CIN:U72900DL2017PTC327055", styles['OfferFooter']))

    doc.build(elements)
