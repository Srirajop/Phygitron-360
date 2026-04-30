import os
from typing import Optional
from jinja2 import Environment, BaseLoader
from app.config import settings

try:
    import sendgrid
    from sendgrid.helpers.mail import Mail
    HAS_SENDGRID = True
except ImportError:
    HAS_SENDGRID = False


# ── Email Templates ─────────────────────────────────────────────────────────

INVITE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.header p{color:rgba(255,255,255,0.8);margin:8px 0 0}
.body{padding:32px}
.body h2{color:#1e1b4b;font-size:22px}
.body p{color:#4b5563;line-height:1.6}
.creds{background:#f8f5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;margin:24px 0}
.creds p{margin:6px 0;color:#374151}
.creds strong{color:#7C3AED}
.btn{display:inline-block;background:linear-gradient(135deg,#7C3AED,#6B21A8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;margin:24px 0}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎯 PHYGITRON 360</h1>
    <p>AI-Powered Talent Lifecycle Platform</p>
  </div>
  <div class="body">
    <h2>You've been invited! 🚀</h2>
    <p>Hi <strong>{{ candidate_name }}</strong>,</p>
    <p>You have been invited to complete an assessment for the <strong>{{ role_name }}</strong> position at <strong>{{ company_name }}</strong>.</p>
    <div class="creds">
      <p><strong>Platform URL:</strong> {{ platform_url }}</p>
      <p><strong>Username (Email):</strong> {{ email }}</p>
      <p><strong>Temporary Password:</strong> {{ temp_password }}</p>
      <p><strong>Assessment Deadline:</strong> {{ deadline }}</p>
    </div>
    <p>Please log in and change your password immediately. Then complete your assigned assessments before the deadline.</p>
    <a href="{{ platform_url }}/login?email={{ email }}" class="btn">Login Now →</a>
    <p style="color:#9ca3af;font-size:13px">If you did not expect this email, you can safely ignore it.</p>
  </div>
  <div class="footer">© 2025 PHYGITRON 360 · Powered by EwandZDigital</div>
</div>
</body></html>
"""

RESULT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.score-badge{font-size:64px;font-weight:900;color:{{ score_color }};text-align:center;margin:24px 0}
.pass-badge{background:{{ badge_bg }};color:{{ badge_color }};padding:8px 24px;border-radius:999px;font-weight:700;font-size:18px;display:inline-block}
.body{padding:32px;text-align:center}
.btn{display:inline-block;background:linear-gradient(135deg,#7C3AED,#6B21A8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;margin:24px 0}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>Assessment Result</h1></div>
  <div class="body">
    <div class="score-badge">{{ score }}%</div>
    <div class="pass-badge">{{ pass_label }}</div>
    <p>Assessment: <strong>{{ assessment_title }}</strong></p>
    <p>Required: {{ pass_score }}% &nbsp;·&nbsp; Your score: {{ score }}%</p>
    <a href="{{ platform_url }}/verify/result/{{ result_id }}" class="btn">View Full Feedback →</a>
  </div>
  <div class="footer">© 2025 PHYGITRON 360 · Powered by EwandZDigital</div>
</div>
</body></html>
"""

CERTIFICATE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px;text-align:center}
.award{font-size:60px;margin:16px 0}
.btn{display:inline-block;background:linear-gradient(135deg,#7C3AED,#6B21A8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;margin:24px 0}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>🎓 Certificate Earned!</h1></div>
  <div class="body">
    <div class="award">🏆</div>
    <h2>Congratulations, {{ learner_name }}!</h2>
    <p>You have successfully completed <strong>{{ course_title }}</strong>.</p>
    <a href="{{ certificate_url }}" class="btn">Download Certificate →</a>
  </div>
  <div class="footer">© 2025 PHYGITRON 360 · Powered by EwandZDigital</div>
</div>
</body></html>
"""

OFFER_LETTER_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#10B981,#059669);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px;}
.body h2{color:#1e1b4b;font-size:22px;margin-bottom:24px}
.item{padding:16px;background:#f8f5ff;border-radius:8px;margin-bottom:12px;border-left:4px solid #10B981;}
.btn{display:inline-block;background:linear-gradient(135deg,#10B981,#059669);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;margin:24px 0}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>🎉 Congratulations!</h1></div>
  <div class="body">
    <h2>Welcome to {{ company_name }}, {{ candidate_name }}!</h2>
    <p>We are thrilled to offer you the position of <strong>{{ role_title }}</strong>.</p>
    
    <div class="item">
      <strong>Role:</strong> {{ role_title }}<br/>
      <strong>Department:</strong> {{ department }}<br/>
      <strong>Location:</strong> {{ location }}<br/>
      <strong>Compensation:</strong> {{ salary }}
    </div>
    
    <p>We were incredibly impressed by your background and performance during the assessment phase. We believe you will be a fantastic addition to our team.</p>
    <a href="{{ platform_url }}/onboarding/setup?token={{ token }}" class="btn">Start Your Onboarding →</a>
  </div>
  <div class="footer">© 2025 PHYGITRON 360 · Powered by EwandZDigital</div>
</div>
</body></html>
"""

ALERT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#fff1f2;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(225,29,72,0.1)}
.header{background:#e11d48;padding:24px;text-align:center}
.header h1{color:#fff;font-size:22px;margin:0}
.body{padding:32px}
.body h2{color:#1e1b4b;font-size:20px}
.msg-box{background:#fff1f2;border-radius:12px;padding:20px;margin:24px 0;border-left:4px solid #e11d48}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:12px}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>Platform Alert: {{ event_title }}</h1></div>
  <div class="body">
    <h2>Notice for Admin/Manager</h2>
    <div class="msg-box">
      <p>{{ message }}</p>
    </div>
    <p style="text-align:center;"><a href="{{ action_url }}" style="color:#e11d48;font-weight:700;">View in Dashboard →</a></p>
  </div>
  <div class="footer">Phygitron 360 Enterprise HRMS Alerting System</div>
</div>
</body></html>
"""

ASSIGN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px}
.body h2{color:#1e1b4b;font-size:20px}
.detail-box{background:#f8f5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;margin:24px 0}
.btn{display:inline-block;background:linear-gradient(135deg,#7C3AED,#6B21A8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;margin:24px 0}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>New Assessment Assigned! 🎯</h1></div>
  <div class="body">
    <h2>Hi {{ candidate_name }},</h2>
    <p>A new professional assessment has been curated specifically for your profile. Please review the details below:</p>
    <div class="detail-box">
      <p style="margin: 8px 0;"><strong>Assessment:</strong> {{ assessment_title }}</p>
      {% if question_count %}<p style="margin: 8px 0;"><strong>Total Questions:</strong> {{ question_count }}</p>{% endif %}
      {% if duration_mins %}<p style="margin: 8px 0;"><strong>Time Limit:</strong> {{ duration_mins }} minutes</p>{% endif %}
      {% if pass_score %}<p style="margin: 8px 0;"><strong>Passing Score:</strong> {{ pass_score }}%</p>{% endif %}
      <p style="margin: 8px 0;"><strong>Closing Date:</strong> {{ deadline or 'No deadline' }}</p>
    </div>
    <p>Please ensure you are in a quiet environment with a stable internet connection before starting.</p>
    <div style="text-align: center;">
      <a href="{{ platform_url }}/verify/dashboard" class="btn" style="color: #ffffff !important; text-decoration: none;">Launch Assessment →</a>
    </div>
  </div>
  <div class="footer">© 2025 PHYGITRON 360 · Powered by EwandZDigital</div>
</div>
</body></html>
"""

jinja_env = Environment(loader=BaseLoader())


def render_template(template_str: str, **kwargs) -> str:
    tmpl = jinja_env.from_string(template_str)
    return tmpl.render(**kwargs)


import smtplib
from email.message import EmailMessage

async def send_email(to_email: str, subject: str, html_content: str, attachment_bytes: Optional[bytes] = None, attachment_filename: str = "document.pdf"):
    """Send an email via Gmail SMTP using provided credentials."""
    smtp_email = "srirajpillai2104@gmail.com"
    smtp_password = "tsimcvwiokdeinum"  # spaces removed from app password
    
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f"PHYGITRON 360 <{smtp_email}>"
        msg['To'] = to_email
        msg.set_content("Please enable HTML to view this email.")
        msg.add_alternative(html_content, subtype='html')
        
        if attachment_bytes:
            msg.add_attachment(
                attachment_bytes,
                maintype='application',
                subtype='pdf',
                filename=attachment_filename
            )
        
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)
            
        print(f"✅ Email successfully sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")


async def send_invite_email(
    to_email: str,
    candidate_name: str,
    role_name: str,
    company_name: str,
    temp_password: str,
    deadline: str,
):
    html = render_template(
        INVITE_TEMPLATE,
        candidate_name=candidate_name,
        role_name=role_name,
        company_name=company_name,
        email=to_email,
        temp_password=temp_password,
        deadline=deadline,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, f"Invitation to complete an assessment for {role_name} at {company_name}", html)


async def send_result_email(
    to_email: str,
    assessment_title: str,
    score: float,
    pass_status: bool,
    pass_score: float,
    result_id: int,
):
    score_color = "#16a34a" if pass_status else "#dc2626"
    badge_bg = "#dcfce7" if pass_status else "#fee2e2"
    badge_color = "#15803d" if pass_status else "#b91c1c"
    pass_label = "✅ PASSED" if pass_status else "❌ NOT PASSED"
    html = render_template(
        RESULT_TEMPLATE,
        assessment_title=assessment_title,
        score=round(score, 1),
        pass_label=pass_label,
        pass_score=pass_score,
        score_color=score_color,
        badge_bg=badge_bg,
        badge_color=badge_color,
        result_id=result_id,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, f"Your assessment result: {assessment_title}", html)


async def send_certificate_email(
    to_email: str,
    learner_name: str,
    course_title: str,
    certificate_url: str,
):
    html = render_template(
        CERTIFICATE_TEMPLATE,
        learner_name=learner_name,
        course_title=course_title,
        certificate_url=certificate_url,
    )
    await send_email(to_email, f"🎓 Certificate earned: {course_title}", html)


async def send_offer_letter_email(
    to_email: str,
    candidate_name: str,
    company_name: str,
    role_title: str,
    department: str,
    salary: str,
    location: str = "Office",
    attachment_bytes: Optional[bytes] = None
):
    html = render_template(
        OFFER_LETTER_TEMPLATE,
        candidate_name=candidate_name,
        company_name=company_name,
        role_title=role_title,
        department=department,
        salary=salary,
        location=location,
        login_url=settings.FRONTEND_URL + "/login",
    )
    subject = f"🎉 Job Offer: {role_title} at {company_name}"
    await send_email(to_email, subject, html, attachment_bytes=attachment_bytes, attachment_filename="Offer_Letter.pdf")


async def send_assignment_notification_email(
    to_email: str,
    candidate_name: str,
    assessment_title: str,
    deadline: Optional[str] = None,
    duration_mins: Optional[int] = None,
    question_count: Optional[int] = None,
    pass_score: Optional[float] = None,
):
    html = render_template(
        ASSIGN_TEMPLATE,
        candidate_name=candidate_name,
        assessment_title=assessment_title,
        deadline=deadline,
        duration_mins=duration_mins,
        question_count=question_count,
        pass_score=pass_score,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, f"New Assessment Assigned: {assessment_title}", html)
async def send_hr_alert_email(
    to_email: str,
    event_title: str,
    message: str,
    action_url: Optional[str] = None
):
    html = render_template(
        ALERT_TEMPLATE,
        event_title=event_title,
        message=message,
        action_url=action_url or settings.FRONTEND_URL,
    )
    await send_email(to_email, f"ALERT: {event_title}", html)
