import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging

logger = logging.getLogger(__name__)

def send_welcome_email(to_email: str, company_name: str, temp_password: str, subdomain: str):
    """
    Sends a welcome email to the newly provisioned Org Admin.
    Currently stubbed with logging, but ready for SMTP configuration.
    """
    subject = f"Welcome to Phygitron 360 - {company_name} Workspace Provisioned"
    body = f"""
    Welcome to Phygitron 360!
    
    Your enterprise workspace for '{company_name}' has been successfully provisioned.
    
    Access your environment at: {subdomain}.phygitron360.com (or via the main portal)
    Your Admin Email: {to_email}
    Your Temporary Password: {temp_password}
    
    Please log in and update your security credentials immediately.
    
    - The Phygitron Node Command
    """
    
    # Check if SMTP is configured
    smtp_host = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "smtp.gmail.com"
    smtp_port = os.getenv("SMTP_PORT", 587)
    smtp_user = os.getenv("SMTP_USER") or os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD")
    
    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.warning(f"[EMAIL MOCK] Missing credentials (SMTP_USER/SMTP_USER). Dispatching to logs only.")
        print(f"\n--- 📧 MOCK EMAIL DISPATCH ---")
        print(f"To:      {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:    {body}")
        print(f"------------------------------\n")
        return True
        
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            
        logger.info(f"Welcome email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {to_email}: {e}")
        return False
