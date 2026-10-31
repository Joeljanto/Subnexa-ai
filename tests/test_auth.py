"""Tests for authentication endpoints."""
import pytest
import backend.database as _db_module
from backend.app import create_app


@pytest.fixture
def client():
    # Reset the global engine so each test gets a fresh in-memory DB
    _db_module._engine = None
    _db_module._SessionLocal = None

    app = create_app()
    app.config["TESTING"] = True
    # Re-initialise with a fresh in-memory SQLite for each test
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    with app.test_client() as c:
        yield c

    # Cleanup: reset globals after test
    _db_module._engine = None
    _db_module._SessionLocal = None


VALID_PASSWORD = "Test@1234"
TEST_EMAIL = "test@subnexa.ai"


def test_register_success(client):
    resp = client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": VALID_PASSWORD, "first_name": "Test"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "access_token" in data
    assert data["user"]["email"] == TEST_EMAIL
    assert data["user"]["role"] == "customer"


def test_register_duplicate_email(client):
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": VALID_PASSWORD})
    resp = client.post("/auth/register", json={"email": TEST_EMAIL, "password": VALID_PASSWORD})
    assert resp.status_code == 409


def test_register_weak_password(client):
    resp = client.post(
        "/auth/register",
        json={"email": "weak@subnexa.ai", "password": "short"},
    )
    assert resp.status_code == 400


def test_register_missing_fields(client):
    resp = client.post("/auth/register", json={"email": TEST_EMAIL})
    assert resp.status_code == 400


def test_login_success(client):
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": VALID_PASSWORD})
    resp = client.post("/auth/login", json={"email": TEST_EMAIL, "password": VALID_PASSWORD})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data


def test_login_wrong_password(client):
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": VALID_PASSWORD})
    resp = client.post("/auth/login", json={"email": TEST_EMAIL, "password": "WrongPass@1"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post(
        "/auth/login", json={"email": "nobody@subnexa.ai", "password": VALID_PASSWORD}
    )
    assert resp.status_code == 401


def test_me_endpoint(client):
    reg = client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": VALID_PASSWORD},
    )
    token = reg.get_json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.get_json()["email"] == TEST_EMAIL


def test_me_no_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_logout(client):
    reg = client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": VALID_PASSWORD},
    )
    token = reg.get_json()["access_token"]
    resp = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_forgot_password_always_ok(client):
    # Should succeed even if email doesn't exist (anti-enumeration)
    resp = client.post("/auth/forgot-password", json={"email": "nobody@subnexa.ai"})
    assert resp.status_code == 200


def test_create_staff_forbidden_for_customer(client):
    reg = client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": VALID_PASSWORD},
    )
    token = reg.get_json()["access_token"]
    resp = client.post(
        "/auth/create-staff",
        json={"email": "staff@subnexa.ai", "password": VALID_PASSWORD},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
