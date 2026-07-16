import sys

file_path = "d:\\Downloads\\Phygitron360\\backend\\app\\routers\\source.py"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    old_dispatch = """    try:
        from app.utils.email import send_invite_email
        await send_invite_email(
            to_email=user.email,
            candidate_name=user.full_name or user.email,
            role_name=role.title,
            company_name=org.name if org else "Organisation",
            temp_password="(Included in secure link)",
            deadline=invite.deadline.strftime("%Y-%m-%d") if invite.deadline else "No deadline set",
        )
    except Exception as e:"""

    new_dispatch = """    try:
        from app.utils.auth import generate_temp_password, hash_password
        
        # Only generate a new password if they haven't started yet
        if not user.password_hash or user.first_login:
            temp_pwd = generate_temp_password()
            user.password_hash = hash_password(temp_pwd)
            user.first_login = True
            invite.temp_password_hash = user.password_hash
        else:
            # Note: If they already have a password and have logged in before, 
            # we can't send it in plaintext again. We'll send a placeholder.
            temp_pwd = "(Use your existing password)"
            
        body_paras = invite.invite_content.get("body_paragraphs", [])
        custom_html = "".join([f"<p>{p}</p>" for p in body_paras])

        from app.utils.email import send_invite_email
        await send_invite_email(
            to_email=user.email,
            candidate_name=user.full_name or user.email,
            subject=invite.invite_content.get("subject", "Assessment Invitation"),
            custom_body_html=custom_html,
            temp_password=temp_pwd,
        )
    except Exception as e:"""

    content = content.replace(old_dispatch, new_dispatch)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("source.py dispatch patched successfully!")
except Exception as e:
    print("Error:", e)
