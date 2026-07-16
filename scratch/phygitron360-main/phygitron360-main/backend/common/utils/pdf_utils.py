import io
import re
import os
from typing import Optional, List, Dict
try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes."""
    if not HAS_FITZ:
        return ""
    text_parts = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                text_parts.append(text)
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

def generate_professional_offer_pdf(content: Dict, output_path: str):
    """Generate a branded PDF using ReportLab for an offer letter."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.colors import HexColor
    from datetime import datetime

    BLUE_COLOR = HexColor("#0070C0") # Corporate Blue
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(name='OfferContent', parent=styles['Normal'], fontSize=11, leading=14, spaceAfter=12))
    styles.add(ParagraphStyle(name='OfferTitle', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=24, color=BLUE_COLOR, underline=True))
    styles.add(ParagraphStyle(name='OfferSignatory', parent=styles['Normal'], fontSize=12, leading=14, color=BLUE_COLOR, fontWeight='bold'))

    elements = []
    elements.append(Paragraph("OFFER LETTER", styles['OfferTitle']))
    
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    elements.append(Paragraph(f"Date: {date_str}", styles['Normal']))
    elements.append(Spacer(1, 0.4*inch))

    elements.append(Paragraph(content.get("salutation", "Dear Candidate,"), styles['OfferContent']))
    for para in content.get("body_paragraphs", []):
        elements.append(Paragraph(para, styles['OfferContent']))
        elements.append(Spacer(1, 0.1*inch))

    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(content.get("closing", "Sincerely,"), styles['OfferContent']))
    elements.append(Paragraph(f"{content.get('signatory_name', 'HR Operations Team')}", styles['OfferSignatory']))
    elements.append(Paragraph(content.get('signatory_title', 'Manager - Talent Acquisition'), styles['OfferSignatory']))
    
    doc.build(elements)

def generate_ewandz_offer_pdf(offer_data: Dict) -> bytes:
    """Generate the EWANDZDIGITAL specific offer letter PDF."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.lib.colors import HexColor
    from datetime import datetime
    import os
    import io

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    
    PURPLE_COLOR = HexColor("#874AF4") # Ewandz purple from template
    
    styles.add(ParagraphStyle(name='CustomAddressRight', parent=styles['Normal'], fontSize=12, leading=14, alignment=TA_RIGHT, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='CustomTitleRight', parent=styles['Heading1'], fontSize=20, alignment=TA_RIGHT, spaceAfter=12, textColor=PURPLE_COLOR, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='CustomDateLocationRight', parent=styles['Normal'], fontSize=12, leading=14, alignment=TA_RIGHT, fontName='Helvetica'))
    
    styles.add(ParagraphStyle(name='CustomFooterText', parent=styles['Normal'], fontSize=8, leading=10, alignment=TA_LEFT, textColor=HexColor("#555555")))
    styles.add(ParagraphStyle(name='CustomBodyText', parent=styles['Normal'], fontSize=10, leading=15, spaceAfter=12, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='CustomSignatory', parent=styles['Normal'], fontSize=10, leading=14, fontName='Helvetica-Bold'))

    elements = []
    
    # The template has the logo around mid-page, so we push the address to 6.4 inches down to sit below it.
    elements.append(Spacer(1, 6.4*inch))
    
    elements.append(Paragraph("<b>EWANDZDIGITAL SERVICES PVT LTD</b><br/>20, Okhla Phase III,<br/>Okhla Industrial Estate,<br/>New Delhi-110020, INDIA<br/><font color='#874AF4'>www.ewandzdigital.com</font>", styles['CustomAddressRight']))
    
    # Add the thin purple separator line from the original template
    from reportlab.platypus.flowables import HRFlowable
    elements.append(HRFlowable(width="30%", thickness=0.5, color=PURPLE_COLOR, hAlign='RIGHT', spaceBefore=15, spaceAfter=15))
    
    
    elements.append(Paragraph("<u>OFFER LETTER</u>", styles['CustomTitleRight']))
    elements.append(Spacer(1, 0.5*inch))
    
    # Date and City
    current_date = datetime.now().strftime("%d %B, %Y")
    elements.append(Paragraph(current_date, styles['CustomDateLocationRight']))
    elements.append(Paragraph(offer_data.get('location', 'Delhi'), styles['CustomDateLocationRight']))
    
    # Page Break for Page 2
    elements.append(PageBreak())
    
    # Page 2 Header/Footer (we add some spacer at top to clear the header graphic)
    elements.append(Spacer(1, 1.5*inch))
    
    # Extract offer content if available (from AI generation or UI edits)
    offer_content = offer_data.get('offer_content', {})
    
    # Salutation
    salutation = offer_content.get('salutation')
    if not salutation:
        candidate_name = offer_data.get('candidate_name', 'XYZ')
        salutation = f"Dear {candidate_name},"
    elements.append(Paragraph(salutation, styles['CustomBodyText']))
    
    # Body Paragraphs
    body_paragraphs = offer_content.get('body_paragraphs')
    if body_paragraphs and isinstance(body_paragraphs, list) and len(body_paragraphs) > 0:
        for p in body_paragraphs:
            elements.append(Paragraph(p, styles['CustomBodyText']))
    else:
        # Fallback to hardcoded OCR template
        role_title = offer_data.get('role_title', 'Designation')
        start_date = offer_data.get('start_date')
        if start_date:
            if isinstance(start_date, datetime):
                start_date_str = start_date.strftime("%B %d, %Y")
            elif hasattr(start_date, "strftime"):
                start_date_str = start_date.strftime("%B %d, %Y")
            else:
                try:
                    start_date_obj = datetime.strptime(str(start_date), "%Y-%m-%d")
                    start_date_str = start_date_obj.strftime("%B %d, %Y")
                except ValueError:
                    start_date_str = str(start_date)
        else:
            start_date_str = "TBD"

        p1 = f"EWANDZ is excited to bring you on board as a <b>{role_title}</b>, with a joining date of {start_date_str}. We are just a few formalities away from getting started. Please take some time to review our offer."
        elements.append(Paragraph(p1, styles['CustomBodyText']))
        
        probation_months = offer_data.get('probation_months', '6')
        salary = offer_data.get('salary', 'TBD')
        notice_period = offer_data.get('notice_period', '30')
        
        p2 = f"You will be on probation for {probation_months} months from your date of joining. Your annual compensation will be <b>INR {salary} per annum</b>. During the probation period, your notice period will be {notice_period} days. Upon successful completion of probation, the notice period will be {notice_period} days."
        elements.append(Paragraph(p2, styles['CustomBodyText']))
        
        p3 = "As an employee of the Company, you will be expected to maintain the highest standards of discipline, integrity, and commitment to your work. You will also be required to comply with all company policies, rules, and regulations. Relevant documentation and training will be provided upon joining."
        elements.append(Paragraph(p3, styles['CustomBodyText']))
        
        p4 = "Kindly confirm your acceptance by replying to this email. Upon receiving your confirmation, we will initiate the next steps in the onboarding process."
        elements.append(Paragraph(p4, styles['CustomBodyText']))
        
        p5 = "We look forward to welcoming you to the team."
        elements.append(Paragraph(p5, styles['CustomBodyText']))
    
    # Closing
    closing = offer_content.get('closing', 'Sincerely,')
    signatory_name = offer_content.get('signatory_name', 'Zainab Ghazi')
    signatory_title = offer_content.get('signatory_title', 'Manager- Global HR Operations')
    
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(closing, styles['CustomBodyText']))
    # Insert the signature image dynamically so it flows with the text
    from reportlab.platypus import Image
    import os
    sig_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "img_p1_40.png")
    if os.path.exists(sig_path):
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Image(sig_path, width=1.4*inch, height=0.38*inch, hAlign='LEFT'))
        elements.append(Spacer(1, 0.1*inch))
    else:
        elements.append(Spacer(1, 0.8*inch))
    elements.append(Paragraph(signatory_name, styles['CustomSignatory']))
    elements.append(Paragraph(signatory_title, styles['CustomSignatory']))
    
    doc.build(elements)
    
    text_pdf_bytes = buffer.getvalue()
    
    # Overlay onto blank template using fitz
    import fitz
    doc_text = fitz.open(stream=text_pdf_bytes, filetype="pdf")
    template_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "offer_blank_template.pdf")
    
    if os.path.exists(template_path):
        doc_template = fitz.open(template_path)
        for i in range(len(doc_text)):
            if i < len(doc_template):
                page_temp = doc_template[i]
            else:
                # If text flows to extra pages, add a blank page to template
                page_temp = doc_template.new_page(-1, width=doc_template[-1].rect.width, height=doc_template[-1].rect.height)
                
            page_text = doc_text[i]
            page_temp.show_pdf_page(page_temp.rect, doc_text, i)
            
        return doc_template.write()
    else:
        return text_pdf_bytes
