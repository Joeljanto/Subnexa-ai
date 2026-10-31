"""
Unit and integration tests for Recovery Tracking, Accounting Rules, and Audit Trail.
"""
from datetime import datetime, timezone, timedelta
import pytest
import backend.database as _db_module
from backend.app import create_app
from backend.database import get_session
from backend.auth.models import User, UserRole
from backend.auth.utils import hash_password
from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus
from backend.recovery.models import (
    RecoveryAction,
    RecoveryActionStatus,
    CustomerResponseStatus,
    RecoveryAuditLog,
)


@pytest.fixture
def recovery_test_setup():
    _db_module._engine = None
    _db_module._SessionLocal = None
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    db = get_session()

    # Create admin and staff users
    admin = User(
        email="admin_rec@subnexa.ai",
        password_hash=hash_password("Admin@1234"),
        role=UserRole.admin,
        first_name="Admin",
        is_active=True,
    )
    staff = User(
        email="staff_rec@subnexa.ai",
        password_hash=hash_password("Staff@1234"),
        role=UserRole.staff,
        first_name="Staff",
        is_active=True,
    )
    db.add_all([admin, staff])
    db.commit()

    # Create test customer
    c1 = Customer(
        name="Zenith Media",
        email="zenith@media.com",
        mrr=5000.0,
        risk_level=RiskLevel.critical,
        status=CustomerStatus.at_risk,
    )
    db.add(c1)
    db.commit()
    db.refresh(c1)

    with app.test_client() as client:
        yield client, db, admin, staff, c1

    db.close()
    _db_module._engine = None
    _db_module._SessionLocal = None


def test_assign_recovery_action_and_audit_trail(recovery_test_setup):
    """
    Test staff assigning a recommended action to an at-risk customer.
    Verifies audit log is created with ASSIGNED event.
    """
    client, db, admin, staff, c1 = recovery_test_setup

    login_resp = client.post(
        "/auth/login",
        json={"email": "admin_rec@subnexa.ai", "password": "Admin@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/recovery/actions",
        headers=headers,
        json={
            "customer_id": c1.id,
            "action_type": "resolve_payment_failure",
            "title": "Resolve Declined Card on Growth Plan",
            "description": "Customer had card decline on billing date. Reach out to update payment.",
            "assigned_to": staff.id,
            "simulated_recovery_amount": 2500.0,
        },
    )
    assert create_resp.status_code == 201
    action_data = create_resp.get_json()["action"]
    action_id = action_data["id"]

    assert action_data["status"] == "assigned"
    assert action_data["customer_name"] == "Zenith Media"
    assert action_data["initial_revenue_at_risk"] == 5000.0
    assert action_data["simulated_recovery_amount"] == 2500.0

    # Verify audit trail
    audit_resp = client.get(f"/api/recovery/actions/{action_id}/audit", headers=headers)
    assert audit_resp.status_code == 200
    trail = audit_resp.get_json()["audit_trail"]
    assert len(trail) == 1
    assert trail[0]["event_type"] == "ASSIGNED"


def test_workflow_lifecycle_status_and_response(recovery_test_setup):
    """
    Test updating action status and recording customer responses.
    """
    client, db, admin, staff, c1 = recovery_test_setup

    login_resp = client.post(
        "/auth/login",
        json={"email": "staff_rec@subnexa.ai", "password": "Staff@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create action
    action = RecoveryAction(
        customer_id=c1.id,
        action_type="contact_customer",
        title="High-Touch Executive Call",
        status=RecoveryActionStatus.assigned,
        initial_revenue_at_risk=5000.0,
        simulated_recovery_amount=2250.0,
    )
    db.add(action)
    db.commit()
    db.refresh(action)

    # 2. Advance to in_progress
    patch_resp = client.patch(
        f"/api/recovery/actions/{action.id}/status",
        headers=headers,
        json={"status": "in_progress", "notes": "Outreach call scheduled with VP of Finance."},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.get_json()["action"]["status"] == "in_progress"

    # 3. Record customer response
    resp_call = client.post(
        f"/api/recovery/actions/{action.id}/response",
        headers=headers,
        json={
            "customer_response": "promised_to_pay",
            "notes": "Customer agreed to clear delinquent invoice by Friday using new corporate card.",
        },
    )
    assert resp_call.status_code == 200
    act_data = resp_call.get_json()["action"]
    assert act_data["customer_response"] == "promised_to_pay"
    assert act_data["customer_response_notes"] is not None

    # Verify audit log sequence
    audit_resp = client.get(f"/api/recovery/actions/{action.id}/audit", headers=headers)
    trail = audit_resp.get_json()["audit_trail"]
    event_types = [t["event_type"] for t in trail]
    assert "STATUS_CHANGED" in event_types
    assert "RESPONSE_RECORDED" in event_types


def test_confirmed_vs_unconfirmed_payment_accounting(recovery_test_setup):
    """
    STRICT ACCOUNTING RULE TEST:
    Only count confirmed collected payments as actual recovery!
    Unconfirmed payments must NOT be counted in actual recovery comparisons.
    """
    client, db, admin, staff, c1 = recovery_test_setup

    login_resp = client.post(
        "/auth/login",
        json={"email": "admin_rec@subnexa.ai", "password": "Admin@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Action 1: Confirmed recovery payment of $4,000 with $200 intervention cost
    act1 = RecoveryAction(
        customer_id=c1.id,
        action_type="resolve_payment_failure",
        title="Card Recovery 1",
        status=RecoveryActionStatus.in_progress,
        initial_revenue_at_risk=4000.0,
        simulated_recovery_amount=2000.0,
    )
    # Action 2: Unconfirmed payment attempt of $3,000 (pending dispute / unverified)
    act2 = RecoveryAction(
        customer_id=c1.id,
        action_type="send_payment_reminder",
        title="Reminder 2",
        status=RecoveryActionStatus.in_progress,
        initial_revenue_at_risk=3000.0,
        simulated_recovery_amount=1500.0,
    )
    db.add_all([act1, act2])
    db.commit()

    # Record confirmed payment for act1
    resp_pay1 = client.post(
        f"/api/recovery/actions/{act1.id}/record-payment",
        headers=headers,
        json={
            "amount": 4000.0,
            "is_confirmed": True,
            "intervention_costs": 200.0,
            "notes": "Card re-billed successfully via Stripe.",
        },
    )
    assert resp_pay1.status_code == 200
    res1_data = resp_pay1.get_json()["action"]
    assert res1_data["actual_recovered_amount"] == 4000.0
    assert res1_data["net_recovered_revenue"] == 3800.0  # 4000 - 200
    assert res1_data["status"] == "completed"

    # Record unconfirmed payment for act2 (is_confirmed = False)
    resp_pay2 = client.post(
        f"/api/recovery/actions/{act2.id}/record-payment",
        headers=headers,
        json={
            "amount": 3000.0,
            "is_confirmed": False,  # NOT confirmed!
            "intervention_costs": 50.0,
            "notes": "Customer claimed transfer was wired; bank has not confirmed deposit yet.",
        },
    )
    assert resp_pay2.status_code == 200
    res2_data = resp_pay2.get_json()["action"]
    assert res2_data["is_confirmed_payment"] is False
    assert res2_data["net_recovered_revenue"] == 0.0  # Unconfirmed = $0 credited net

    # Check executive comparison summary endpoint
    comp_resp = client.get("/api/recovery/comparison", headers=headers)
    assert comp_resp.status_code == 200
    summary = comp_resp.get_json()["summary"]

    assert summary["initial_revenue_at_risk"] == 7000.0  # 4000 + 3000
    assert summary["simulated_recovery"] == 3500.0      # 2000 + 1500

    # STRICT RULE VERIFICATION:
    # Actual recovery must ONLY count the $4,000 confirmed payment, NOT the $3,000 unconfirmed payment!
    assert summary["actual_collected_recovery"] == 4000.0
    assert summary["intervention_costs"] == 200.0
    assert summary["net_recovered_revenue"] == 3800.0   # 4000 - 200
    assert summary["realization_rate"] == pytest.approx((4000.0 / 3500.0) * 100.0, 0.1)


def test_radar_shows_recovery_tracking(recovery_test_setup):
    """
    Test that the Radar customer registry includes live recovery tracking status.
    """
    client, db, admin, staff, c1 = recovery_test_setup

    # Assign action to c1
    act = RecoveryAction(
        customer_id=c1.id,
        action_type="contact_customer",
        title="Urgent Churn Prevention",
        status=RecoveryActionStatus.in_progress,
        assigned_to=staff.id,
        initial_revenue_at_risk=5000.0,
        simulated_recovery_amount=2500.0,
    )
    db.add(act)
    db.commit()

    login_resp = client.post(
        "/auth/login",
        json={"email": "admin_rec@subnexa.ai", "password": "Admin@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    radar_resp = client.get(f"/api/radar/customers?search={c1.name}", headers=headers)
    assert radar_resp.status_code == 200
    cust_record = radar_resp.get_json()["customers"][0]

    assert "recovery_tracking" in cust_record
    tracking = cust_record["recovery_tracking"]
    assert tracking["has_active_action"] is True
    assert tracking["action_status"] == "in_progress"
    assert tracking["action_title"] == "Urgent Churn Prevention"
