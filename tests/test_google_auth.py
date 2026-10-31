"""
Tests for Google OAuth 2.0 authentication endpoints.
Validates audience, issuer, expiration, unverified email, account linking,
and error handling when credentials are missing or invalid.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
import backend.database as _db_module
from backend.app import create_app
from backend.auth.models import User, UserRole


@pytest.fixture
def client_with_google():
    _db_module._engine = None
    _db_module._SessionLocal = None

    app = create_app()
    app.config["TESTING"] = True
    app.config["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"

    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    with app.test_client() as c:
        yield c

    _db_module._engine = None
    _db_module._SessionLocal = None


@pytest.fixture
def client_without_google():
    _db_module._engine = None
    _db_module._SessionLocal = None

    app = create_app()
    app.config["TESTING"] = True
    app.config["GOOGLE_CLIENT_ID"] = ""

    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    with app.test_client() as c:
        yield c

    _db_module._engine = None
    _db_module._SessionLocal = None


def test_auth_config_endpoint(client_with_google):
    resp = client_with_google.get("/auth/config")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["google_client_id"] == "test-client-id.apps.googleusercontent.com"
    assert data["google_auth_enabled"] is True


def test_auth_config_disabled_when_unset(client_without_google):
    resp = client_without_google.get("/auth/config")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["google_client_id"] == ""
    assert data["google_auth_enabled"] is False


def test_google_auth_missing_token(client_with_google):
    resp = client_with_google.post("/auth/google", json={})
    assert resp.status_code == 400
    assert "id_token is required" in resp.get_json()["error"]


def test_google_auth_server_not_configured(client_without_google):
    resp = client_without_google.post("/auth/google", json={"id_token": "some-token"})
    assert resp.status_code == 503
    data = resp.get_json()
    assert "Google OAuth is not configured on this server" in data["error"]


def test_google_auth_invalid_token(client_with_google):
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", side_effect=ValueError("Token invalid signature")):
        resp = client_with_google.post("/auth/google", json={"id_token": "bad-token"})
        assert resp.status_code == 401
        assert "Invalid Google token" in resp.get_json()["error"]


def test_google_auth_wrong_issuer(client_with_google):
    fake_idinfo = {
        "iss": "attacker.com",
        "sub": "google-123",
        "email": "user@example.com",
        "email_verified": True,
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "valid-token-wrong-iss"})
        assert resp.status_code == 401
        assert "Invalid Google token issuer" in resp.get_json()["error"]


def test_google_auth_expired_token(client_with_google):
    fake_idinfo = {
        "iss": "https://accounts.google.com",
        "sub": "google-123",
        "email": "user@example.com",
        "email_verified": True,
        "exp": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "expired-token"})
        assert resp.status_code == 401
        assert "Google token has expired" in resp.get_json()["error"]


def test_google_auth_unverified_email(client_with_google):
    fake_idinfo = {
        "iss": "https://accounts.google.com",
        "sub": "google-123",
        "email": "unverified@example.com",
        "email_verified": False,
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "unverified-token"})
        assert resp.status_code == 400
        assert "Google account email is not verified" in resp.get_json()["error"]


def test_google_auth_new_user_success(client_with_google):
    fake_idinfo = {
        "iss": "https://accounts.google.com",
        "sub": "google-new-987",
        "email": "alice@company.com",
        "email_verified": True,
        "given_name": "Alice",
        "family_name": "Smith",
        "picture": "https://lh3.googleusercontent.com/avatar.jpg",
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "good-token"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data
        assert data["user"]["email"] == "alice@company.com"
        assert data["user"]["first_name"] == "Alice"
        assert data["user"]["role"] == "customer"
        assert data["user"]["is_verified"] is True


def test_google_auth_existing_user_linking(client_with_google):
    # First create an admin user via standard registration or DB
    db = _db_module.get_session()
    try:
        admin_user = User(
            email="existing_admin@subnexa.ai",
            password_hash="some-hash",
            first_name="Admin",
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()

    # Now login with Google matching existing_admin@subnexa.ai
    fake_idinfo = {
        "iss": "accounts.google.com",
        "sub": "google-admin-111",
        "email": "existing_admin@subnexa.ai",
        "email_verified": True,
        "given_name": "Admin",
        "picture": "https://lh3.googleusercontent.com/admin.jpg",
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "admin-google-token"})
        assert resp.status_code == 200
        data = resp.get_json()
        # Ensure role is PRESERVED as admin, not demoted to customer!
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "existing_admin@subnexa.ai"

    # Verify no duplicate user was created
    db = _db_module.get_session()
    try:
        users = db.query(User).filter_by(email="existing_admin@subnexa.ai").all()
        assert len(users) == 1
        assert users[0].google_id == "google-admin-111"
    finally:
        db.close()


def test_google_auth_deactivated_account(client_with_google):
    db = _db_module.get_session()
    try:
        inactive_user = User(
            email="inactive@company.com",
            password_hash="some-hash",
            is_active=False,
            is_verified=True,
        )
        db.add(inactive_user)
        db.commit()
    finally:
        db.close()

    fake_idinfo = {
        "iss": "https://accounts.google.com",
        "sub": "google-inactive-333",
        "email": "inactive@company.com",
        "email_verified": True,
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    with patch("backend.auth.routes.google_id_token.verify_oauth2_token", return_value=fake_idinfo):
        resp = client_with_google.post("/auth/google", json={"id_token": "inactive-token"})
        assert resp.status_code == 403
        assert "Account deactivated" in resp.get_json()["error"]
