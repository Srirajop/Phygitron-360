import os
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from backend.core.database import DATA_DIR

def generate_certificate(user_name: str, assessment_name: str, score: float, result_id: int) -> str:
    """Generates a PDF certificate and returns the relative file path."""
    certs_dir = os.path.join(DATA_DIR, 'uploads', 'certificates')
    os.makedirs(certs_dir, exist_ok=True)
    
    filename = f"cert_{result_id}.pdf"
    filepath = os.path.join(certs_dir, filename)
    
    c = canvas.Canvas(filepath, pagesize=landscape(A4))
    width, height = landscape(A4)
    
    # Background & Border
    c.setStrokeColor(colors.HexColor('#4f46e5'))
    c.setLineWidth(10)
    c.rect(20, 20, width - 40, height - 40)
    
    c.setStrokeColor(colors.HexColor('#6366f1'))
    c.setLineWidth(3)
    c.rect(30, 30, width - 60, height - 60)
    
    # Title
    c.setFont("Helvetica-Bold", 40)
    c.setFillColor(colors.HexColor('#1e1b4b'))
    c.drawCentredString(width / 2, height - 120, "Certificate of Completion")
    
    # Body
    c.setFont("Helvetica", 20)
    c.drawCentredString(width / 2, height - 180, "This is to certify that")
    
    # Name
    c.setFont("Helvetica-Bold", 35)
    c.setFillColor(colors.HexColor('#4338ca'))
    c.drawCentredString(width / 2, height - 240, user_name.upper())
    
    # Details
    c.setFont("Helvetica", 20)
    c.setFillColor(colors.HexColor('#1e1b4b'))
    c.drawCentredString(width / 2, height - 300, f"has successfully completed the assessment:")
    
    c.setFont("Helvetica-Bold", 25)
    c.drawCentredString(width / 2, height - 350, assessment_name)
    
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 400, f"with a score of {score}%")
    
    # Signatures
    c.setFont("Helvetica-Oblique", 14)
    c.drawString(100, 100, "Phygitron 360 AI Auto-Grader")
    c.line(100, 120, 350, 120)
    c.drawString(100, 80, "Authorized Signature")
    
    c.save()
    
    return f"/uploads/certificates/{filename}"
