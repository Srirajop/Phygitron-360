import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
from datetime import datetime
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Find the .env file in the backend directory
    env_path = Path(__file__).parent.parent.parent / '.env'
    load_dotenv(env_path)
except ImportError:
    # python-dotenv not installed, will use system environment variables
    pass


class EmailService:
    """
    Email service for sending onboarding invitations and other notifications.
    Uses SMTP with configurable credentials via environment variables.
    """
    
    def __init__(self):
        # Email configuration from environment variables with robust fallbacks
        self.smtp_server = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "smtp.gmail.com"
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        
        # User fallbacks: SMTP_USER -> SENDER_EMAIL
        self.smtp_user = os.getenv("SMTP_USER") or os.getenv("SENDER_EMAIL") or ""
        
        # Password fallbacks: SMTP_PASS -> SMTP_PASSWORD -> SENDER_PASSWORD
        self.smtp_password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD") or os.getenv("SENDER_PASSWORD") or ""
        
        self.sender_name = os.getenv("SENDER_NAME", "EWANDZ Digital HR")
        self.company_name = os.getenv("COMPANY_NAME", "EWANDZ Digital")
        
    def _create_onboarding_email_html(self, name: str, onboarding_link: str, expires_days: int = 7) -> str:
        """Create a beautiful HTML email template for onboarding invitation"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                }}
                .container {{
                    max-width: 600px;
                    margin: 40px auto;
                    background: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 30px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                    font-weight: 600;
                }}
                .content {{
                    padding: 40px 30px;
                }}
                .content h2 {{
                    color: #667eea;
                    font-size: 22px;
                    margin-top: 0;
                }}
                .content p {{
                    margin: 16px 0;
                    color: #555;
                }}
                .cta-button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 16px 40px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    margin: 20px 0;
                    transition: transform 0.2s;
                }}
                .cta-button:hover {{
                    transform: translateY(-2px);
                }}
                .info-box {{
                    background: #f8f9fa;
                    border-left: 4px solid #667eea;
                    padding: 16px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 20px 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #777;
                }}
                .link-fallback {{
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 6px;
                    word-break: break-all;
                    font-family: monospace;
                    font-size: 12px;
                    color: #667eea;
                    margin: 10px 0;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to {self.company_name}!</h1>
                </div>
                
                <div class="content">
                    <h2>Hi {name},</h2>
                    
                    <p>Congratulations on joining our team! We're excited to have you on board.</p>
                    
                    <p>To complete your onboarding process, please click the button below to set up your account and provide the necessary information:</p>
                    
                    <div style="text-align: center;">
                        <a href="{onboarding_link}" class="cta-button">Complete Your Onboarding</a>
                    </div>
                    
                    <div class="info-box">
                        <strong>⏰ Important:</strong> This invitation link will expire in <strong>{expires_days} days</strong>.
                    </div>
                    
                    <p>During the onboarding process, you'll be asked to:</p>
                    <ul>
                        <li>Set up your password</li>
                        <li>Provide contact information</li>
                        <li>Upload necessary documents (Photo, CV, ID Proof)</li>
                        <li>Add your skills and experience</li>
                    </ul>
                    
                    <p style="margin-top: 30px; font-size: 14px; color: #777;">
                        <strong>Can't click the button?</strong> Copy and paste this link into your browser:
                    </p>
                    <div class="link-fallback">
                        {onboarding_link}
                    </div>
                    
                    <p style="margin-top: 30px;">
                        If you have any questions or need assistance, please don't hesitate to reach out to our HR team.
                    </p>
                    
                    <p style="margin-top: 30px;">
                        Best regards,<br>
                        <strong>{self.company_name} HR Team</strong>
                    </p>
                </div>
                
                <div class="footer">
                    <p>This is an automated email. Please do not reply to this message.</p>
                    <p>© {datetime.now().year} {self.company_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    def send_onboarding_invitation(
        self, 
        recipient_email: str, 
        recipient_name: str, 
        onboarding_link: str,
        expires_days: int = 7
    ) -> dict:
        """
        Send an onboarding invitation email.
        
        Args:
            recipient_email: Email address of the new employee
            recipient_name: Name of the new employee
            onboarding_link: Full URL to the onboarding page
            expires_days: Number of days until the link expires
            
        Returns:
            dict with 'success' (bool) and 'message' (str)
        """
        
        # Check if email is configured
        if not self.smtp_user or not self.smtp_password:
            return {
                "success": False,
                "message": "Email not configured. Please set SMTP_USER and SMTP_PASS environment variables."
            }
        
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Welcome to {self.company_name} - Complete Your Onboarding"
            message["From"] = f"{self.sender_name} <{self.smtp_user}>"
            message["To"] = recipient_email
            
            # Create HTML content
            html_content = self._create_onboarding_email_html(
                recipient_name, 
                onboarding_link, 
                expires_days
            )
            
            # Create plain text fallback
            text_content = f"""
Welcome to {self.company_name}!

Hi {recipient_name},

Congratulations on joining our team! We're excited to have you on board.

To complete your onboarding process, please visit the following link:
{onboarding_link}

This invitation link will expire in {expires_days} days.

During the onboarding process, you'll be asked to:
- Set up your password
- Provide contact information
- Upload necessary documents (Photo, CV, ID Proof)
- Add your skills and experience

If you have any questions or need assistance, please reach out to our HR team.

Best regards,
{self.company_name} HR Team

---
This is an automated email. Please do not reply to this message.
© {datetime.now().year} {self.company_name}. All rights reserved.
            """
            
            # Attach both versions
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # Secure the connection
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            
            return {
                "success": True,
                "message": f"Invitation email sent successfully to {recipient_email}"
            }
            
        except smtplib.SMTPAuthenticationError:
            return {
                "success": False,
                "message": "Email authentication failed. Please check your email credentials."
            }
        except smtplib.SMTPException as e:
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unexpected error sending email: {str(e)}"
            }
    
    def send_password_reset_link(
        self,
        recipient_email: str,
        recipient_name: str,
        reset_link: str,
        expires_hours: int = 1
    ) -> dict:
        """Send password reset link email"""
        
        if not self.smtp_user or not self.smtp_password:
            return {
                "success": False,
                "message": "Email not configured."
            }
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Password Reset Request - {self.company_name}"
            message["From"] = f"{self.sender_name} <{self.smtp_user}>"
            message["To"] = recipient_email
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; }}
                    .content {{ padding: 40px 30px; }}
                    .cta-button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                    .info-box {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #777; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <h2>Hi {recipient_name},</h2>
                        <p>We received a request to reset your password for your {self.company_name} account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center;">
                            <a href="{reset_link}" class="cta-button">Reset Your Password</a>
                        </div>
                        <div class="info-box">
                            <strong>⏰ Important:</strong> This link expires in <strong>{expires_hours} hour(s)</strong>.
                        </div>
                        <p><strong>If you didn't request this:</strong></p>
                        <ul>
                            <li>You can safely ignore this email</li>
                            <li>Your password won't change unless you click the button above</li>
                            <li>If you're concerned, contact HR immediately</li>
                        </ul>
                        <p style="margin-top: 30px; font-size: 14px; color: #777;">
                            <strong>Can't click the button?</strong> Copy and paste this link:
                        </p>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px;">
                            {reset_link}
                        </div>
                        <p style="margin-top: 30px;">Best regards,<br><strong>{self.company_name} Security Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated security email. Please do not reply.</p>
                        <p>© {datetime.now().year} {self.company_name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
Password Reset Request

Hi {recipient_name},

We received a request to reset your password for your {self.company_name} account.

Reset your password here: {reset_link}

This link expires in {expires_hours} hour(s).

If you didn't request this, you can safely ignore this email. Your password won't change unless you click the link above.

Best regards,
{self.company_name} Security Team
            """
            
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            
            return {
                "success": True,
                "message": f"Password reset link sent to {recipient_email}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}"
            }
    
    def send_temporary_password(
        self,
        recipient_email: str,
        recipient_name: str,
        temporary_password: str,
        expires_hours: int = 24
    ) -> dict:
        """Send temporary password email (admin reset)"""
        
        if not self.smtp_user or not self.smtp_password:
            return {
                "success": False,
                "message": "Email not configured."
            }
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Your Password Has Been Reset - {self.company_name}"
            message["From"] = f"{self.sender_name} <{self.smtp_user}>"
            message["To"] = recipient_email
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; }}
                    .content {{ padding: 40px 30px; }}
                    .password-box {{ background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }}
                    .password {{ font-family: monospace; font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; }}
                    .warning-box {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #777; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset</h1>
                    </div>
                    <div class="content">
                        <h2>Hi {recipient_name},</h2>
                        <p>Your password has been reset by HR/Admin.</p>
                        <div class="password-box">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Temporary Password:</p>
                            <div class="password">{temporary_password}</div>
                        </div>
                        <div class="warning-box">
                            <strong>⚠️ Important Security Instructions:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li><strong>You MUST change this password</strong> on your first login</li>
                                <li>This password expires in <strong>{expires_hours} hours</strong></li>
                                <li>Do not share this password with anyone</li>
                                <li>Choose a strong, unique password when changing it</li>
                            </ul>
                        </div>
                        <p style="margin-top: 30px;">
                            <strong>Next Steps:</strong>
                        </p>
                        <ol>
                            <li>Go to the login page</li>
                            <li>Enter your email and the temporary password above</li>
                            <li>You'll be prompted to set a new password</li>
                        </ol>
                        <p style="margin-top: 30px;">
                            If you didn't expect this password reset, please contact HR immediately.
                        </p>
                        <p style="margin-top: 30px;">Best regards,<br><strong>{self.company_name} HR Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated security email. Please do not reply.</p>
                        <p>© {datetime.now().year} {self.company_name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
Password Reset

Hi {recipient_name},

Your password has been reset by HR/Admin.

Temporary Password: {temporary_password}

IMPORTANT:
• You MUST change this password on your first login
• This password expires in {expires_hours} hours
• Do not share this password with anyone

Next Steps:
1. Go to the login page
2. Enter your email and the temporary password above
3. You'll be prompted to set a new password

If you didn't expect this, contact HR immediately.

Best regards,
{self.company_name} HR Team
            """
            
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            
            return {
                "success": True,
                "message": f"Temporary password sent to {recipient_email}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}"
            }
    
    def send_password_changed_notification(
        self,
        recipient_email: str,
        recipient_name: str,
        changed_by: str = "You"
    ) -> dict:
        """Send notification when password is changed"""
        
        if not self.smtp_user or not self.smtp_password:
            return {"success": False, "message": "Email not configured."}
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Password Changed - {self.company_name}"
            message["From"] = f"{self.sender_name} <{self.smtp_user}>"
            message["To"] = recipient_email
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                    .header {{ background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px 30px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; }}
                    .content {{ padding: 40px 30px; }}
                    .info-box {{ background: #d1ecf1; border-left: 4px solid #0c5460; padding: 16px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #777; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Password Changed</h1>
                    </div>
                    <div class="content">
                        <h2>Hi {recipient_name},</h2>
                        <p>Your password was successfully changed.</p>
                        <div class="info-box">
                            <strong>Change Details:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li><strong>Changed by:</strong> {changed_by}</li>
                                <li><strong>Time:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</li>
                            </ul>
                        </div>
                        <p><strong>If you didn't make this change:</strong></p>
                        <ul>
                            <li>Contact HR immediately</li>
                            <li>Your account may have been compromised</li>
                        </ul>
                        <p style="margin-top: 30px;">Best regards,<br><strong>{self.company_name} Security Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated security notification.</p>
                        <p>© {datetime.now().year} {self.company_name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
Password Changed

Hi {recipient_name},

Your password was successfully changed.

Changed by: {changed_by}
Time: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}

If you didn't make this change, contact HR immediately.

Best regards,
{self.company_name} Security Team
            """
            
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            
            return {"success": True, "message": "Notification sent"}
            
        except Exception as e:
            return {"success": False, "message": f"Failed to send: {str(e)}"}
    
    def send_new_employee_credentials(
        self,
        recipient_email: str,
        recipient_name: str,
        employee_code: str,
        temporary_password: str,
        login_url: str = ""
    ) -> dict:
        """Send welcome email to newly added employee with their login credentials."""

        if not self.smtp_user or not self.smtp_password:
            return {"success": False, "message": "Email not configured."}

        if not login_url:
            login_url = os.getenv("APP_BASE_URL", "http://localhost:3000")

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Welcome to {self.company_name} — Your Login Credentials"
            message["From"] = f"{self.sender_name} <{self.smtp_user}>"
            message["To"] = recipient_email

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                    .header {{ background: linear-gradient(135deg, #5227FF 0%, #B19EEF 100%); color: white; padding: 40px 30px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 28px; font-weight: 700; }}
                    .header p {{ margin: 8px 0 0 0; opacity: 0.9; font-size: 15px; }}
                    .content {{ padding: 40px 30px; }}
                    .content h2 {{ color: #5227FF; font-size: 22px; margin-top: 0; }}
                    .creds-box {{ background: #f3f0ff; border: 2px solid #5227FF; border-radius: 12px; padding: 24px; margin: 24px 0; }}
                    .cred-row {{ display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e0d9ff; }}
                    .cred-row:last-child {{ border-bottom: none; }}
                    .cred-label {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }}
                    .cred-value {{ font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #5227FF; }}
                    .cta-button {{ display: inline-block; background: linear-gradient(135deg, #5227FF 0%, #764ba2 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 24px 0; font-size: 16px; }}
                    .warning-box {{ background: #fff8e1; border-left: 4px solid #ffb300; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 14px; }}
                    .footer {{ background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #777; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to {self.company_name}!</h1>
                        <p>Your employee account is ready.</p>
                    </div>
                    <div class="content">
                        <h2>Hi {recipient_name},</h2>
                        <p>You've been added to the <strong>{self.company_name}</strong> HR system. Here are your login credentials to access the employee portal:</p>

                        <div class="creds-box">
                            <div class="cred-row">
                                <span class="cred-label">Employee Code</span>
                                <span class="cred-value">{employee_code}</span>
                            </div>
                            <div class="cred-row">
                                <span class="cred-label">Username (Login)</span>
                                <span class="cred-value">{recipient_email}</span>
                            </div>
                            <div class="cred-row">
                                <span class="cred-label">Temporary Password</span>
                                <span class="cred-value">{temporary_password}</span>
                            </div>
                        </div>

                        <div style="text-align: center;">
                            <a href="{login_url}" class="cta-button">Login to Portal →</a>
                        </div>

                        <div class="warning-box">
                            <strong>⚠️ Security Notice:</strong><br>
                            This is a <strong>temporary password</strong>. You must change it after your first login.
                            Never share your credentials with anyone.
                        </div>

                        <p style="margin-top: 30px;">If you have any questions, please contact the HR team.</p>
                        <p>Best regards,<br><strong>{self.company_name} HR Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply.</p>
                        <p>© {datetime.now().year} {self.company_name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            text_content = f"""
Welcome to {self.company_name}!

Hi {recipient_name},

You've been added to the {self.company_name} HR system.

Your Login Credentials:
  Employee Code    : {employee_code}
  Username (Login) : {recipient_email}
  Temp Password    : {temporary_password}

Login here: {login_url}

IMPORTANT: This is a temporary password. Change it after your first login.

Best regards,
{self.company_name} HR Team
            """

            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)

            return {"success": True, "message": f"Welcome email with credentials sent to {recipient_email}"}

        except smtplib.SMTPAuthenticationError:
            return {"success": False, "message": "Email authentication failed. Check SMTP_USER / SMTP_PASSWORD."}
        except Exception as e:
            return {"success": False, "message": f"Failed to send welcome email: {str(e)}"}

    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        return bool(self.smtp_user and self.smtp_password)
