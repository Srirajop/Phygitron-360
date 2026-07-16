import os
from typing import Optional
from jinja2 import Environment, BaseLoader
from app.config import settings
import smtplib
from email.message import EmailMessage

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
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎯 EWANDZ</h1>
    <p>Talent Acquisition</p>
  </div>
  <div class="body">
    <p>Hello <strong>{{ candidate_name }}</strong>,</p>
    {{ custom_body_html }}
    <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-top:24px;margin-bottom:24px;">
      <p style="margin:0 0 8px 0;font-weight:600">Your Secure Login Credentials</p>
      <p style="margin:0 0 4px 0"><strong>Portal Link:</strong> <a href="{{ platform_url }}/login?email={{ email }}" style="color:#7C3AED;">{{ platform_url }}/login</a></p>
      <p style="margin:0 0 4px 0"><strong>Username:</strong> {{ email }}</p>
      <p style="margin:0"><strong>Temporary Password:</strong> {{ temp_password }}</p>
    </div>
    <p>For any queries, please feel free to reach out to the HR Team.</p>
    <br/>
    <p>Regards,<br/>EWANDZ Talent Acquisition Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
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
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
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
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
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
.body{padding:32px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎉 Offer Letter</h1>
  </div>
  <div class="body">
    <p>Dear <strong>{{ candidate_name }}</strong>,</p>
    <p>Congratulations! We are pleased to extend an offer for the position of <strong>{{ role_title }}</strong>.</p>
    <p>Please find your offer letter attached for review.</p>
    <p>Joining Date: {{ start_date }}<br/>
    Location: {{ location }}</p>
    <p>We look forward to welcoming you to the team.</p>
    <br/>
    <p>Regards,<br/>HR Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
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
  <div class="footer">EWANDZ HRMS Alerting System</div>
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
.body h3{color:#1e1b4b;font-size:18px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>📝 Assessment Assigned</h1>
  </div>
  <div class="body">
    <p>Hello <strong>{{ candidate_name }}</strong>,</p>
    <p>Thank you for your interest in EWANDZ and for applying for the position of <strong>{{ role_name }}</strong>.</p>
    <p>After reviewing your profile, we are pleased to move forward with your application. As the next step in our hiring process, you have been assigned an assessment to help us better understand your skills and experience.</p>
    <h3>Assessment Details</h3>
    <p>Assessment: {{ assessment_title }}<br/>
    Duration: {{ duration_mins }} minutes<br/>
    Deadline: {{ deadline or 'No deadline' }}</p>
    <p><strong>Start Assessment:</strong><br/>
    <a href="{{ platform_url }}/verify/dashboard">{{ platform_url }}/verify/dashboard</a></p>
    <p>We recommend completing the assessment well before the deadline to avoid any last-minute issues.</p>
    <p>We appreciate your time and effort and look forward to reviewing your submission.</p>
    <p>We wish you the very best.</p>
    <br/>
    <p>Regards,<br/>Talent Acquisition Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
</div>
</body></html>
"""

COURSE_ASSIGN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎓 Course Assigned</h1>
  </div>
  <div class="body">
    <p>Hello <strong>{{ candidate_name }}</strong>,</p>
    <p>As part of our ongoing commitment to learning and professional development, the <strong>{{ course_title }}</strong> course has been assigned to you on Learning Central.</p>
    <p>To access the course, please log in using the link below:<br/>
    <a href="{{ platform_url }}/forge">{{ platform_url }}/forge</a></p>
    <p>We encourage you to complete the course at your earliest convenience and strengthen your understanding of cybersecurity best practices.</p>
    <p>Happy learning, and thank you for investing in your growth!</p>
    <br/>
    <p>Regards,<br/>HR Team<br/>EWANDZ</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
</div>
</body></html>
"""

FORGOT_PASSWORD_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#7C3AED,#6B21A8);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🔑 Reset Password</h1>
  </div>
  <div class="body">
    <p>Hello <strong>{{ user_name }}</strong>,</p>
    <p>We received a request to reset your password.</p>
    <p>Reset Password: <a href="{{ reset_link }}">{{ reset_link }}</a></p>
    <p>If you did not initiate this request, please ignore this email.</p>
    <br/>
    <p>Regards,<br/>Support Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
</div>
</body></html>
"""

PASSWORD_CHANGED_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#10B981,#059669);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>✔️ Password Changed</h1>
  </div>
  <div class="body">
    <p>Hello <strong>{{ user_name }}</strong>,</p>
    <p>This is a confirmation that your account password was successfully changed.</p>
    <p>If you did not make this change, please contact HR Team immediately.</p>
    <br/>
    <p>Regards,<br/>Support Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
</div>
</body></html>
"""

PROFILE_PASSWORD_UPDATED_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#f8f5ff;margin:0;padding:0}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1)}
.header{background:linear-gradient(135deg,#10B981,#059669);padding:40px 32px;text-align:center}
.header h1{color:#fff;font-size:28px;margin:0;font-weight:700}
.body{padding:32px}
.body p{color:#4b5563;line-height:1.6}
.footer{background:#f3f4f6;padding:20px 32px;text-align:center;color:#9ca3af;font-size:13px}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>✔️ Password Updated</h1>
  </div>
  <div class="body">
    <p>Hello <strong>{{ user_name }}</strong>,</p>
    <p>Your account password has been successfully updated through your profile settings.</p>
    <p>No further action is required.</p>
    <br/>
    <p>Regards,<br/>Support Team</p>
  </div>
  <div class="footer">© 2026 EWANDZ · Powered by Phygitron 360</div>
</div>
</body></html>
"""


jinja_env = Environment(loader=BaseLoader())


def render_template(template_str: str, **kwargs) -> str:
    tmpl = jinja_env.from_string(template_str)
    return tmpl.render(**kwargs)


async def send_email(to_email: str, subject: str, html_content: str, attachment_bytes: Optional[bytes] = None, attachment_filename: str = "document.pdf"):
    """Send an email via Gmail SMTP using provided credentials."""
    smtp_email = "srirajpillai2104@gmail.com"
    smtp_password = "tsimcvwiokdeinum"  # spaces removed from app password
    
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f"EWANDZ <{smtp_email}>"
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
    subject: str,
    custom_body_html: str,
    temp_password: str,
):
    html = render_template(
        INVITE_TEMPLATE,
        candidate_name=candidate_name,
        custom_body_html=custom_body_html,
        email=to_email,
        temp_password=temp_password,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, subject, html)


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
    # Added start_date mapping for jinja compatibility with old usage if needed
    # But usually joining date is passed inside, I will map it as start_date="To be communicated" or via caller
    html = render_template(
        OFFER_LETTER_TEMPLATE,
        candidate_name=candidate_name,
        company_name=company_name,
        role_title=role_title,
        department=department,
        salary=salary,
        location=location,
        start_date="As per offer document",
        login_url=settings.FRONTEND_URL + "/login",
    )
    subject = f"Offer Letter – {role_title}"
    await send_email(to_email, subject, html, attachment_bytes=attachment_bytes, attachment_filename="Offer_Letter.pdf")


async def send_assignment_notification_email(
    to_email: str,
    candidate_name: str,
    assessment_title: str,
    deadline: Optional[str] = None,
    duration_mins: Optional[int] = None,
    question_count: Optional[int] = None,
    pass_score: Optional[float] = None,
    # Incase it's required for signature matching, role_name might be needed
    role_name: str = "your requested position"
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
        role_name=role_name
    )
    await send_email(to_email, "Next Step in Your Application at EWANDZ – Assessment Assignment", html)


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


async def send_course_assignment_notification_email(
    to_email: str,
    candidate_name: str,
    course_title: str,
    deadline: Optional[str] = None,
    difficulty: Optional[str] = None,
    estimated_hours: Optional[float] = None,
):
    html = render_template(
        COURSE_ASSIGN_TEMPLATE,
        candidate_name=candidate_name,
        course_title=course_title,
        deadline=deadline,
        difficulty=difficulty,
        estimated_hours=estimated_hours,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, f"Course Assigned: {course_title}", html)


async def send_forgot_password_email(to_email: str, user_name: str, reset_link: str):
    html = render_template(
        FORGOT_PASSWORD_TEMPLATE,
        user_name=user_name,
        reset_link=reset_link,
    )
    await send_email(to_email, "Reset Your Password", html)


async def send_password_changed_email(to_email: str, user_name: str):
    html = render_template(
        PASSWORD_CHANGED_TEMPLATE,
        user_name=user_name,
    )
    await send_email(to_email, "Password Successfully Changed", html)


async def send_profile_password_updated_email(to_email: str, user_name: str):
    html = render_template(
        PROFILE_PASSWORD_UPDATED_TEMPLATE,
        user_name=user_name,
    )
    await send_email(to_email, "Profile Password Updated", html)


async def send_offer_reminder_email(
    to_email: str,
    candidate_name: str,
    role_title: str,
    company_name: str,
    deadline: str,
):
    html = render_template(
        OFFER_REMINDER_TEMPLATE,
        candidate_name=candidate_name,
        role_title=role_title,
        company_name=company_name,
        deadline=deadline,
    )
    await send_email(to_email, f"Action Required: Offer Deadline Approaching for {role_title}", html)


async def send_invite_reminder_email(
    to_email: str,
    candidate_name: str,
    role_title: str,
    company_name: str,
    deadline: str,
    temp_password: str,
):
    html = render_template(
        INVITE_REMINDER_TEMPLATE,
        candidate_name=candidate_name,
        role_title=role_title,
        company_name=company_name,
        deadline=deadline,
        email=to_email,
        temp_password=temp_password,
        platform_url=settings.FRONTEND_URL,
    )
    await send_email(to_email, f"Reminder: Assessment Pending for {role_title}", html)
