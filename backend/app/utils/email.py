"""
Email Utilities
Send emails and format email templates
"""
from typing import List, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for sending emails via SMTP
    """
    
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        from_name: str = "Auction System"
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.from_name = from_name
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        attachments: Optional[List[str]] = None
    ) -> bool:
        """
        Send email
        
        Args:
            to_email: Recipient email
            subject: Email subject
            body: Plain text body
            html_body: HTML body (optional)
            attachments: List of file paths to attach
        
        Returns:
            True if sent successfully, False otherwise
        
        Example:
            email_service.send_email(
                to_email="user@example.com",
                subject="Welcome!",
                body="Welcome to our platform",
                html_body="<h1>Welcome!</h1>"
            )
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Attach plain text body
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach HTML body if provided
            if html_body:
                msg.attach(MIMEText(html_body, 'html'))
            
            # Attach files if provided
            if attachments:
                for file_path in attachments:
                    self._attach_file(msg, file_path)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def _attach_file(self, msg: MIMEMultipart, file_path: str):
        """Attach file to email message"""
        try:
            with open(file_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
            
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename={file_path.split("/")[-1]}'
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {file_path}: {e}")


def format_welcome_email(username: str, verify_link: Optional[str] = None) -> tuple[str, str]:
    """
    Format welcome email
    
    Args:
        username: User's username
        verify_link: Email verification link (optional)
    
    Returns:
        Tuple of (plain_text, html)
    
    Example:
        text, html = format_welcome_email("john_doe", verify_link)
        email_service.send_email(user.email, "Welcome!", text, html)
    """
    plain_text = f"""
Welcome to Auction System, {username}!

Thank you for joining our platform. We're excited to have you on board.

"""
    
    if verify_link:
        plain_text += f"""
Please verify your email by clicking the link below:
{verify_link}

"""
    
    plain_text += """
Best regards,
Auction System Team
"""
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to Auction System, {username}!</h2>
        <p>Thank you for joining our platform. We're excited to have you on board.</p>
"""
    
    if verify_link:
        html += f"""
        <p>Please verify your email by clicking the button below:</p>
        <a href="{verify_link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
"""
    
    html += """
        <p>Best regards,<br>Auction System Team</p>
    </body>
    </html>
"""
    
    return plain_text, html


def format_otp_email(username: str, otp_code: str, expires_minutes: int = 5) -> tuple[str, str]:
    """
    Format OTP verification email
    
    Args:
        username: User's username
        otp_code: OTP code
        expires_minutes: OTP expiration time in minutes
    
    Returns:
        Tuple of (plain_text, html)
    """
    plain_text = f"""
Hello {username},

Your verification code is: {otp_code}

This code will expire in {expires_minutes} minutes.

If you didn't request this code, please ignore this email.

Best regards,
Auction System Team
"""
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Email Verification</h2>
        <p>Hello {username},</p>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #007bff; padding: 20px; background-color: #f8f9fa; border-radius: 5px; text-align: center;">
            {otp_code}
        </div>
        <p>This code will expire in {expires_minutes} minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br>Auction System Team</p>
    </body>
    </html>
"""
    
    return plain_text, html


def format_password_reset_email(username: str, reset_link: str) -> tuple[str, str]:
    """
    Format password reset email
    
    Args:
        username: User's username
        reset_link: Password reset link
    
    Returns:
        Tuple of (plain_text, html)
    """
    plain_text = f"""
Hello {username},

You requested to reset your password.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Auction System Team
"""
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password Reset Request</h2>
        <p>Hello {username},</p>
        <p>You requested to reset your password.</p>
        <p>Click the button below to reset your password:</p>
        <a href="{reset_link}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>Auction System Team</p>
    </body>
    </html>
"""
    
    return plain_text, html


def format_bid_outbid_email(
    username: str,
    auction_name: str,
    your_bid: int,
    new_bid: int,
    auction_link: str
) -> tuple[str, str]:
    """
    Format outbid notification email
    
    Args:
        username: User's username
        auction_name: Name of auction
        your_bid: User's bid amount
        new_bid: New higher bid amount
        auction_link: Link to auction
    
    Returns:
        Tuple of (plain_text, html)
    """
    plain_text = f"""
Hello {username},

You have been outbid on "{auction_name}"!

Your bid: {your_bid:,} VND
New highest bid: {new_bid:,} VND

Place a higher bid to stay in the auction:
{auction_link}

Best regards,
Auction System Team
"""
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>You've Been Outbid!</h2>
        <p>Hello {username},</p>
        <p>You have been outbid on <strong>"{auction_name}"</strong>!</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Your bid:</strong> {your_bid:,} VND</p>
            <p><strong>New highest bid:</strong> {new_bid:,} VND</p>
        </div>
        <p>Place a higher bid to stay in the auction:</p>
        <a href="{auction_link}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Place Bid</a>
        <p>Best regards,<br>Auction System Team</p>
    </body>
    </html>
"""
    
    return plain_text, html


def format_auction_won_email(
    username: str,
    auction_name: str,
    winning_bid: int,
    payment_link: str
) -> tuple[str, str]:
    """
    Format auction won email
    
    Args:
        username: User's username
        auction_name: Name of auction
        winning_bid: Winning bid amount
        payment_link: Link to payment page
    
    Returns:
        Tuple of (plain_text, html)
    """
    plain_text = f"""
Congratulations {username}!

You won the auction for "{auction_name}"!

Winning bid: {winning_bid:,} VND

Complete your payment here:
{payment_link}

Best regards,
Auction System Team
"""
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #28a745;">Congratulations! 🎉</h2>
        <p>Hello {username},</p>
        <p>You won the auction for <strong>"{auction_name}"</strong>!</p>
        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Winning bid:</strong> {winning_bid:,} VND</p>
        </div>
        <p>Complete your payment to finalize the purchase:</p>
        <a href="{payment_link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Complete Payment</a>
        <p>Best regards,<br>Auction System Team</p>
    </body>
    </html>
"""
    
    return plain_text, html

from app.config import settings
email_service = EmailService(
    smtp_host=settings.SMTP_HOST,
    smtp_port=settings.SMTP_PORT,
    smtp_user=settings.SMTP_USER or "",
    smtp_password=settings.SMTP_PASSWORD or "",
    from_email=settings.EMAIL_FROM or "",
    from_name=settings.EMAIL_FROM_NAME or ""
)