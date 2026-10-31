"""
Authentication routes for SubNexa AI.
"""
import os
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, current_app, g
from sqlalchemy.exc import IntegrityError
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from backend.database import get_session
from backend.auth.models import User, UserRole
from backend.auth.utils import (
    hash_password,
    check_password,
    validate_password,
    generate_access_token,
    generate_reset_token,
    send_reset_email,
)
from backend.auth.decorators import jwt_required, role_required

auth_bp = Blueprint("auth", __name__)


# ── Register ──────────────────────────────────────────────────────────────────

@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Password strength
    valid, msg = validate_password(password)
    if not valid:
        return jsonify({"error": msg}), 400

    db = get_session()
    try:
        # Unique email check
        existing = db.query(User).filter_by(email=email).first()
        if existing:
            return jsonify({"error": "Email already registered"}), 409

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.customer,  # Default role; admins use a separate flow
            first_name=first_name or None,
            last_name=last_name or None,
            is_verified=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = generate_access_token(user.id, user.email, user.role.value)
        return jsonify(
            {
                "message": "Registration successful",
                "access_token": token,
                "user": user.to_dict(),
            }
        ), 201

    except IntegrityError:
        db.rollback()
        return jsonify({"error": "Email already registered"}), 409
    finally:
        db.close()


# ── Login ─────────────────────────────────────────────────────────────────────

@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    db = get_session()
    try:
        user = db.query(User).filter_by(email=email).first()
        if not user or not user.password_hash:
            return jsonify({"error": "Invalid email or password"}), 401
        if not check_password(password, user.password_hash):
            return jsonify({"error": "Invalid email or password"}), 401
        if not user.is_active:
            return jsonify({"error": "Account deactivated. Contact support."}), 403

        token = generate_access_token(user.id, user.email, user.role.value)
        return jsonify(
            {
                "message": "Login successful",
                "access_token": token,
                "user": user.to_dict(),
            }
        )
    finally:
        db.close()


# ── Google OAuth ──────────────────────────────────────────────────────────────

@auth_bp.get("/config")
def auth_config():
    """
    Public configuration endpoint for frontend auth clients.
    Exposes Google Client ID without exposing secret credentials.
    """
    client_id = (current_app.config.get("GOOGLE_CLIENT_ID") or "").strip().strip('"').strip("'")
    return jsonify({
        "google_client_id": client_id,
        "google_auth_enabled": bool(client_id),
    })


@auth_bp.post("/google")
def google_auth():
    """
    Google OAuth token verification and login/registration.
    Validates token audience, issuer, expiration, and verified email.
    """
    data = request.get_json(silent=True) or {}
    id_token_str = (data.get("id_token") or "").strip()

    if not id_token_str:
        return jsonify({"error": "id_token is required"}), 400

    client_id = (current_app.config.get("GOOGLE_CLIENT_ID") or "").strip().strip('"').strip("'")
    if not client_id:
        return jsonify({
            "error": "Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID in your environment.",
            "code": "GOOGLE_OAUTH_NOT_CONFIGURED"
        }), 503

    try:
        # Validate audience and verify signature with Google's public certs
        idinfo = google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            audience=client_id,
        )
    except ValueError as e:
        return jsonify({"error": f"Invalid Google token: {str(e)}"}), 401
    except Exception as e:
        return jsonify({"error": f"Google token verification failed: {str(e)}"}), 401

    # Validate issuer explicitly (must be accounts.google.com or https://accounts.google.com)
    issuer = idinfo.get("iss", "")
    if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
        return jsonify({"error": f"Invalid Google token issuer: {issuer}"}), 401

    # Validate expiration
    exp = idinfo.get("exp")
    if exp and datetime.fromtimestamp(exp, timezone.utc) < datetime.now(timezone.utc):
        return jsonify({"error": "Google token has expired"}), 401

    # Validate email
    email = idinfo.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Could not retrieve email from Google token"}), 400

    # Validate email verification status
    email_verified = bool(idinfo.get("email_verified", False))
    if not email_verified:
        return jsonify({"error": "Google account email is not verified"}), 400

    google_id = idinfo.get("sub")
    first_name = idinfo.get("given_name", "")
    last_name = idinfo.get("family_name", "")
    avatar_url = idinfo.get("picture", "")

    db = get_session()
    try:
        # Look up existing user by email or google_id
        user = db.query(User).filter((User.email == email) | (User.google_id == google_id)).first()
        if user:
            # Handle existing account: link google_id without duplicating or changing user role
            if not user.google_id:
                user.google_id = google_id
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            if first_name and not user.first_name:
                user.first_name = first_name
            if last_name and not user.last_name:
                user.last_name = last_name
            if not user.is_verified and email_verified:
                user.is_verified = True
            db.commit()
        else:
            # Create new user
            user = User(
                email=email,
                google_id=google_id,
                first_name=first_name,
                last_name=last_name,
                avatar_url=avatar_url,
                role=UserRole.customer,
                is_verified=email_verified,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if not user.is_active:
            return jsonify({"error": "Account deactivated. Contact support."}), 403

        token = generate_access_token(user.id, user.email, user.role.value)
        return jsonify(
            {
                "message": "Google login successful",
                "access_token": token,
                "user": user.to_dict(),
            }
        )
    finally:
        db.close()


# ── Logout ────────────────────────────────────────────────────────────────────

@auth_bp.post("/logout")
@jwt_required
def logout():
    # Stateless JWT: client discards the token.
    # For production, maintain a token blacklist in Redis.
    return jsonify({"message": "Logged out successfully"})


# ── Current User ─────────────────────────────────────────────────────────────

@auth_bp.get("/me")
@jwt_required
def me():
    return jsonify(g.current_user.to_dict())


# ── Forgot Password ───────────────────────────────────────────────────────────

@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    db = get_session()
    try:
        user = db.query(User).filter_by(email=email).first()
        # Always return success to avoid email enumeration
        if user and user.password_hash:
            token = generate_reset_token()
            user.reset_token = token
            user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
            db.commit()
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            send_reset_email(email, token, frontend_url)

        return jsonify(
            {"message": "If that email exists, a reset link has been sent."}
        )
    finally:
        db.close()


# ── Reset Password ────────────────────────────────────────────────────────────

@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "Token and new_password are required"}), 400

    valid, msg = validate_password(new_password)
    if not valid:
        return jsonify({"error": msg}), 400

    db = get_session()
    try:
        user = db.query(User).filter_by(reset_token=token).first()
        if not user:
            return jsonify({"error": "Invalid or expired reset token"}), 400
        if user.reset_token_expires < datetime.now(timezone.utc):
            return jsonify({"error": "Reset token has expired"}), 400

        user.password_hash = hash_password(new_password)
        user.reset_token = None
        user.reset_token_expires = None
        db.commit()

        return jsonify({"message": "Password reset successful. Please log in."})
    finally:
        db.close()


# ── Admin: Create Staff Account ───────────────────────────────────────────────

@auth_bp.post("/create-staff")
@jwt_required
@role_required("admin")
def create_staff():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    valid, msg = validate_password(password)
    if not valid:
        return jsonify({"error": msg}), 400

    db = get_session()
    try:
        if db.query(User).filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        staff = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.staff,
            first_name=first_name or None,
            last_name=last_name or None,
            is_verified=True,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        return jsonify(
            {"message": "Staff account created", "user": staff.to_dict()}
        ), 201
    except IntegrityError:
        db.rollback()
        return jsonify({"error": "Email already registered"}), 409
    finally:
        db.close()
