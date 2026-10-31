"""
Auth utilities: password hashing, JWT, email sending, password validation.
"""
import os
import re
import jwt
import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from flask import current_app
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()

# ── Password Validation ───────────────────────────────────────────────────────

PASSWORD_MIN_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_.#\-])[A-Za-z\d@$!%*?&_.#\-]{8,}$"
)


def validate_password(password: str) -> tuple[bool, str]:
    """
    Returns (is_valid, error_message).
    Requires: 8+ chars, uppercase, lowercase, digit, special char.
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if not PASSWORD_PATTERN.match(password):
        return (
            False,
            "Password must contain uppercase, lowercase, digit, and special character.",
        )
    return True, ""


# ── Bcrypt Helpers ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.generate_password_hash(plain).decode("utf-8")


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.check_password_hash(hashed, plain)


# ── JWT Helpers ───────────────────────────────────────────────────────────────

def generate_access_token(user_id: str, email: str, role: str) -> str:
    secret = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    expires_in = current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        "type": "access",
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure."""
    secret = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    return jwt.decode(token, secret, algorithms=[algorithm])


# ── Password Reset Token ──────────────────────────────────────────────────────

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


# ── Email Sending ─────────────────────────────────────────────────────────────

def send_reset_email(to_email: str, reset_token: str, frontend_url: str) -> None:
    """
    Send a password reset email.
    Falls back to printing the link to console if SMTP is not configured.
    """
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    mail_server = current_app.config.get("MAIL_SERVER")
    mail_username = current_app.config.get("MAIL_USERNAME")
    mail_password = current_app.config.get("MAIL_PASSWORD")
    mail_port = current_app.config.get("MAIL_PORT", 587)
    mail_sender = current_app.config.get("MAIL_DEFAULT_SENDER", "noreply@subnexa.ai")

    if not mail_username or not mail_password:
        # Dev mode: print to console
        print(f"\n[SubNexa AI] Password reset link for {to_email}:\n{reset_link}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "SubNexa AI – Reset Your Password"
    msg["From"] = mail_sender
    msg["To"] = to_email

    text_body = f"Visit this link to reset your password:\n{reset_link}\n\nExpires in 1 hour."
    html_body = f"""
    <html><body>
    <h2>SubNexa AI – Password Reset</h2>
    <p>Click the button below to reset your password. This link expires in 1 hour.</p>
    <a href="{reset_link}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
      Reset Password
    </a>
    <p>If you didn't request this, ignore this email.</p>
    </body></html>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(mail_server, mail_port) as server:
        server.starttls()
        server.login(mail_username, mail_password)
        server.sendmail(mail_sender, to_email, msg.as_string())
