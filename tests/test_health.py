"""Tests for Flask health endpoint."""
import pytest
import backend.database as _db_module
from backend.app import create_app


@pytest.fixture
def client():
    _db_module._engine = None
    _db_module._SessionLocal = None
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")
    with app.test_client() as c:
        yield c
    _db_module._engine = None
    _db_module._SessionLocal = None


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "SubNexa AI"
    assert "engine" in data
