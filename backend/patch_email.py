import sys

file_path = "d:\\Downloads\\Phygitron360\\backend\\app\\utils\\email.py"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    old_template = """<div class="body">
    <p>Hello <strong>{{ candidate_name }}</strong>,</p>
    <p>Thank you for your interest in opportunities with EWANDZ</p>
    <p>You have been invited to apply for the position of <strong>{{ role_name }}</strong>.</p>
    <p>Application Deadline: {{ deadline }}<br/>
    Portal Link: {{ platform_url }}/login?email={{ email }}<br/>
    Username: {{ email }}<br/>
    Temporary Password: {{ temp_password }}</p>
    <p>We look forward to reviewing your application.</p>
    <p>For any queries, please feel free to reach out to the HR Team.</p>
    <br/>
    <p>Regards,<br/>EWANDZ Talent Acquisition Team</p>
  </div>"""

    new_template = """<div class="body">
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
  </div>"""

    content = content.replace(old_template, new_template)

    old_send = """async def send_invite_email(
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
    await send_email(to_email, f"Invitation to Apply - {role_name}", html)"""

    new_send = """async def send_invite_email(
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
    await send_email(to_email, subject, html)"""

    import re
    # Using regex to replace the function as there might be slight whitespace differences
    match = re.search(r"async def send_invite_email\(.*?await send_email\(to_email, f\"Invitation to Apply [^\"]+\", html\)", content, flags=re.DOTALL)
    if match:
        content = content[:match.start()] + new_send + content[match.end():]
    else:
        print("Failed to replace send_invite_email")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("email.py patched successfully!")
except Exception as e:
    print("Error:", e)
