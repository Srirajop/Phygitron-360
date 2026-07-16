"""
Phygitron 360 — Extended Email Service
========================================
SMTP email functions for Source (Talent Vault) and Verify module notifications.
Falls back to structured logging if SMTP is not configured.
"""
import smtplib
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_smtp_config():
    """Returns (host, port, user, password) from env or Nones."""
    host = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER")
    port = int(os.getenv("SMTP_PORT", 587))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD")
    return host, port, user, password


def _send_via_smtp(msg: MIMEMultipart) -> bool:
    """Attempt to send a pre-built MIMEMultipart message via SMTP. Returns True/False."""
    host, port, user, password = _get_smtp_config()
    if not all([host, user, password]):
        return False
    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error(f"SMTP send failed: {exc}")
        return False


SENT_MOCK_EMAILS = []

def _mock_log(to_email: str, subject: str, plain_body: str):
    """Write a mock email dispatch to logs when SMTP is unavailable."""
    logger.warning("[EMAIL MOCK] SMTP not configured — logging email instead.")
    print(f"\n--- 📧 MOCK EMAIL DISPATCH ---")
    print(f"To:      {to_email}")
    print(f"Subject: {subject}")
    print(f"Body:\n{plain_body}")
    print(f"------------------------------\n")
    SENT_MOCK_EMAILS.append({
        "to": to_email,
        "subject": subject,
        "body": plain_body
    })


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def send_invite_email(
    to_email: str,
    candidate_name: str,
    role_name: str,
    company_name: str,
    temp_password: str,
    deadline: Optional[str] = None,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
) -> bool:
    """
    Send a talent-portal invitation email to a candidate with their temporary credentials.
    Falls back to structured logging if SMTP is not configured.
    """
    subject = custom_subject if custom_subject else f"You've been invited to apply for {role_name} at {company_name}"
    deadline_line = f"Application Deadline: {deadline}" if deadline else "Please complete your application at your earliest convenience."

    if custom_body:
        plain_body = custom_body
        html_body = f"<html><body style=\"font-family: Arial, sans-serif; color: #333; line-height: 1.6;\">{custom_body.replace(chr(10), '<br/>')}</body></html>"
    else:
        plain_body = f"""
Dear {candidate_name},

You have been invited to apply for the position of {role_name} at {company_name}.

Please use the following temporary credentials to access the candidate portal:
  Email:            {to_email}
  Temporary Password: {temp_password}

{deadline_line}

We look forward to reviewing your application.

Best regards,
Talent Acquisition Team
{company_name}
"""

        html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color:#4f46e5;">You've Been Invited!</h2>
  <p>Dear <strong>{candidate_name}</strong>,</p>
  <p>You have been invited to apply for the position of <strong>{role_name}</strong> at <strong>{company_name}</strong>.</p>
  <p>Please use the following temporary credentials to access the candidate portal:</p>
  <table style="border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email:</td><td>{to_email}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Temporary Password:</td><td><code>{temp_password}</code></td></tr>
  </table>
  <p>{deadline_line}</p>
  <p>We look forward to reviewing your application.</p>
  <br/>
  <p>Best regards,<br/><strong>Talent Acquisition Team</strong><br/>{company_name}</p>
</body></html>
"""

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Invite email sent to {to_email} for role '{role_name}'")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_invite_email failed for {to_email}: {exc}")
        return False


def send_offer_letter_email(
    to_email: str,
    candidate_name: str,
    company_name: str,
    role_title: str,
    department: Optional[str] = None,
    salary: Optional[str] = None,
    location: Optional[str] = None,
    attachment_bytes: Optional[bytes] = None,
) -> bool:
    """
    Send an offer letter email to a candidate.
    Optionally attaches a PDF if attachment_bytes is provided.
    Falls back to structured logging if SMTP is not configured.
    """
    subject = f"Offer Letter — {role_title} at {company_name}"
    dept_line = f"Department: {department}" if department else ""
    sal_line = f"Offered Salary: {salary}" if salary else ""
    loc_line = f"Work Location: {location}" if location else ""

    plain_body = f"""
Dear {candidate_name},

We are pleased to extend an offer of employment for the position of {role_title} at {company_name}.

{dept_line}
{sal_line}
{loc_line}

Please review the attached offer letter and respond at your earliest convenience.

We look forward to welcoming you to the team!

Warm regards,
HR Operations Team
{company_name}
"""

    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color:#059669;">Congratulations, {candidate_name}!</h2>
  <p>We are pleased to extend an offer of employment for the position of <strong>{role_title}</strong> at <strong>{company_name}</strong>.</p>
  <table style="border-collapse:collapse;margin:12px 0;">
    {'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Department:</td><td>' + department + '</td></tr>' if department else ''}
    {'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Offered Salary:</td><td>' + salary + '</td></tr>' if salary else ''}
    {'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Work Location:</td><td>' + location + '</td></tr>' if location else ''}
  </table>
  <p>Please review the attached offer letter and respond at your earliest convenience.</p>
  <p>We look forward to welcoming you to the team!</p>
  <br/>
  <p>Warm regards,<br/><strong>HR Operations Team</strong><br/>{company_name}</p>
</body></html>
"""

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(plain_body, "plain"))
        alt.attach(MIMEText(html_body, "html"))
        msg.attach(alt)

        if attachment_bytes:
            part = MIMEBase("application", "pdf")
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", 'attachment; filename="offer_letter.pdf"')
            msg.attach(part)

        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Offer letter email sent to {to_email}")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_offer_letter_email failed for {to_email}: {exc}")
        return False


def send_assessment_notification_email(
    to_email: str,
    candidate_name: str,
    assessment_title: str,
    deadline: Optional[str] = None,
    duration_mins: Optional[int] = None,
    question_count: Optional[int] = None,
    pass_score: Optional[float] = None,
) -> bool:
    """
    Send an assessment assignment notification to a candidate.
    Falls back to structured logging if SMTP is not configured.
    """
    subject = f"Assessment Assigned: {assessment_title}"
    deadline_line = f"Complete by: {deadline}" if deadline else "Please complete the assessment at your earliest convenience."

    detail_rows = ""
    if duration_mins:
        detail_rows += f"  Time Limit: {duration_mins} minutes\n"
    if question_count:
        detail_rows += f"  Questions: {question_count}\n"
    if pass_score is not None:
        detail_rows += f"  Passing Score: {pass_score}%\n"

    plain_body = f"""
Dear {candidate_name},

You have been assigned a new assessment: {assessment_title}

{detail_rows}
{deadline_line}

Please log in to the candidate portal to begin your assessment.

Best regards,
Assessment Team — Phygitron 360
"""

    html_detail_rows = ""
    if duration_mins:
        html_detail_rows += f'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time Limit:</td><td>{duration_mins} minutes</td></tr>'
    if question_count:
        html_detail_rows += f'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Questions:</td><td>{question_count}</td></tr>'
    if pass_score is not None:
        html_detail_rows += f'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Passing Score:</td><td>{pass_score}%</td></tr>'

    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color:#4f46e5;">Assessment Assigned</h2>
  <p>Dear <strong>{candidate_name}</strong>,</p>
  <p>You have been assigned a new assessment: <strong>{assessment_title}</strong></p>
  <table style="border-collapse:collapse;margin:12px 0;">
    {html_detail_rows}
  </table>
  <p>{deadline_line}</p>
  <p>Please log in to the candidate portal to begin your assessment.</p>
  <br/>
  <p>Best regards,<br/><strong>Assessment Team — Phygitron 360</strong></p>
</body></html>
"""

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Assessment notification sent to {to_email} for '{assessment_title}'")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_assessment_notification_email failed for {to_email}: {exc}")
        return False

def send_generic_notification_email(
    to_email: str,
    candidate_name: str,
    notification_subject: str,
    notification_message: str,
    company_name: str,
) -> bool:
    """
    Send a custom HR notification to a candidate/trainee.
    Falls back to structured logging if SMTP is not configured.
    """
    subject = notification_subject

    plain_body = f"""
Dear {candidate_name},

You have a new update from {company_name}:

{notification_message}

Please log in to your Trainee Dashboard to view more details.

Best regards,
Talent Acquisition Team
{company_name}
"""

    html_message = notification_message.replace('\n', '<br/>')
    
    # We use a simple regex approach (or just let the email client auto-link) but we can wrap http(s) in a tags for the html body if needed. 
    # For now, most email clients auto-link raw URLs. To be safe, we just render it nicely.

    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color:#4f46e5;">New Notification</h2>
  <p>Dear <strong>{candidate_name}</strong>,</p>
  <p>You have a new update from <strong>{company_name}</strong>:</p>
  <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
    {html_message}
  </div>
  <p>Please log in to your Trainee Dashboard to view more details.</p>
  <br/>
  <p>Best regards,<br/><strong>Talent Acquisition Team</strong><br/>{company_name}</p>
</body></html>
"""

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Custom notification sent to {to_email} with subject '{subject}'")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_generic_notification_email failed for {to_email}: {exc}")
        return False


def send_clockout_reminder_email(
    to_email: str,
    employee_name: str,
    clockin_time: str,
    date: str,
) -> bool:
    """Send a reminder notification email to an employee who forgot to clock out."""
    subject = f"Forgot to Clock Out: Reminder for {date}"
    plain_body = f"""
Dear {employee_name},

Our records show that you clocked in at {clockin_time} on {date}, but have not clocked out yet.

Please log in to the employee portal and submit an attendance correction request to update your clock-out time.

Best regards,
Operations Team
"""
    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color:#ef4444;">Forgot to Clock Out</h2>
  <p>Dear <strong>{employee_name}</strong>,</p>
  <p>Our records show that you clocked in at <strong>{clockin_time}</strong> on <strong>{date}</strong>, but have not clocked out yet.</p>
  <p>Please log in to the employee portal and submit an attendance correction request to update your clock-out time.</p>
  <br/>
  <p>Best regards,<br/><strong>Operations Team</strong></p>
</body></html>
"""
    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Clock-out reminder email sent to {to_email}")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_clockout_reminder_email failed for {to_email}: {exc}")
        return False

def send_bimonthly_report_email(
    to_email: str,
    manager_name: str,
    report_data: list,
    period_label: str,
    company_name: str
) -> bool:
    """Send bimonthly attendance report to a manager, attaching a generated PDF."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    import io

    subject = f"Bimonthly Attendance Report: {period_label}"
    plain_body = f"""
Dear {manager_name},

Please find attached the attendance report for your team for the period {period_label}.

Best regards,
Operations Team
{company_name}
"""
    html_body = f"""
<html><body style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color:#2563eb;">Bimonthly Attendance Report</h2>
  <p>Dear <strong>{manager_name}</strong>,</p>
  <p>Please find attached the attendance report for your team for the period <strong>{period_label}</strong>.</p>
  <br/>
  <p>Best regards,<br/><strong>Operations Team</strong><br/>{company_name}</p>
</body></html>
"""
    
    # Generate PDF
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    elements.append(Paragraph(f"Attendance Report: {period_label}", styles['Title']))
    elements.append(Spacer(1, 12))
    
    # Create Table Data
    data = [["Employee Name", "Code", "Present", "Absent", "Half-Day", "Leave"]]
    for emp in report_data:
        stats = emp.get("stats", {})
        data.append([
            emp.get("name", ""),
            emp.get("code", ""),
            str(stats.get("present", 0)),
            str(stats.get("absent", 0)),
            str(stats.get("half_day", 0)),
            str(stats.get("leave", 0))
        ])
        
    t = Table(data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(t)
    doc.build(elements)
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, plain_body)
        return True

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(plain_body, "plain"))
        alt.attach(MIMEText(html_body, "html"))
        msg.attach(alt)

        part = MIMEBase("application", "pdf")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", 'attachment; filename="bimonthly_report.pdf"')
        msg.attach(part)

        result = _send_via_smtp(msg)
        if result:
            logger.info(f"Bimonthly report email sent to {to_email}")
        else:
            _mock_log(to_email, subject, plain_body)
        return True
    except Exception as exc:
        logger.error(f"send_bimonthly_report_email failed for {to_email}: {exc}")
        return False
