"""
Unit and integration tests for Revenue Rescue Radar exposure calculations.
"""
from datetime import datetime, timezone, timedelta
import pytest
import backend.database as _db_module
from backend.app import create_app
from backend.database import get_session
from backend.auth.models import User, UserRole
from backend.auth.utils import hash_password
from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus, BillingInterval
from backend.payments.models import Payment, PaymentStatus, PaymentMethod
from backend.billing.models import Invoice, InvoiceStatus
from backend.intelligence.radar.exposure import (
    calculate_radar_exposures,
    get_radar_customer_records,
)


@pytest.fixture
def client_and_db():
    _db_module._engine = None
    _db_module._SessionLocal = None
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    db = get_session()

    # Create admin user
    admin = User(
        email="radar_admin@subnexa.ai",
        password_hash=hash_password("Admin@1234"),
        role=UserRole.admin,
        first_name="Admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()

    with app.test_client() as client:
        yield client, db

    db.close()
    _db_module._engine = None
    _db_module._SessionLocal = None


def test_exposure_no_double_counting(client_and_db):
    """
    Verify that an overdue invoice of $1,000 and a failed payment of $1,000
    on the SAME subscription are NOT double-counted.
    """
    _, db = client_and_db
    now = datetime.now(timezone.utc)

    # 1. Customer
    cust = Customer(
        name="Acme Corp",
        email="acme@corp.com",
        mrr=1000.0,
        risk_level=RiskLevel.critical,
        risk_score=90.0,
        status=CustomerStatus.at_risk,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    # 2. Subscription
    sub = Subscription(
        customer_id=cust.id,
        plan_name="Enterprise Plan",
        amount=1000.0,
        billing_interval=BillingInterval.monthly,
        status=SubscriptionStatus.past_due,
        current_period_end=now + timedelta(days=5),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # 3. Overdue Invoice for $1000
    inv = Invoice(
        invoice_number="INV-001",
        customer_id=cust.id,
        subscription_id=sub.id,
        amount_due=1000.0,
        amount_paid=0.0,
        status=InvoiceStatus.open,
        due_date=now - timedelta(days=10),
    )
    db.add(inv)

    # 4. Failed Payment for the same subscription
    failed_pmt = Payment(
        customer_id=cust.id,
        subscription_id=sub.id,
        amount=1000.0,
        status=PaymentStatus.failed,
        method=PaymentMethod.card,
        created_at=now - timedelta(days=2),
    )
    db.add(failed_pmt)
    db.commit()

    exposures = calculate_radar_exposures(db, as_of=now)

    # Overdue invoice should be exactly 1000
    assert exposures["overdue_invoice_exposure"] == 1000.0

    # Failed payment exposure should be 0 because it was already counted under overdue invoice for this sub
    assert exposures["failed_payment_exposure"] == 0.0

    # Upcoming renewal should be 0 because the subscription period is already counted in overdue invoice
    assert exposures["upcoming_renewal_exposure"] == 0.0

    # High risk MRR reflects customer's monthly recurring commitment
    assert exposures["high_risk_recurring_revenue"] == 1000.0

    # Total net exposure is strictly 1000, NOT 2000 or 3000!
    assert exposures["total_net_exposure"] == 1000.0

    # Affected customer count
    assert exposures["affected_customers_count"] == 1


def test_independent_failed_payment_counted(client_and_db):
    """
    Verify that a failed payment on a DIFFERENT customer without overdue invoices
    IS included in failed_payment_exposure.
    """
    _, db = client_and_db
    now = datetime.now(timezone.utc)

    cust = Customer(
        name="Beta LLC",
        email="beta@llc.com",
        mrr=500.0,
        risk_level=RiskLevel.medium,
        risk_score=45.0,
        status=CustomerStatus.active,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    failed_pmt = Payment(
        customer_id=cust.id,
        amount=500.0,
        status=PaymentStatus.failed,
        method=PaymentMethod.card,
        created_at=now - timedelta(days=5),
    )
    db.add(failed_pmt)
    db.commit()

    exposures = calculate_radar_exposures(db, as_of=now)
    assert exposures["overdue_invoice_exposure"] == 0.0
    assert exposures["failed_payment_exposure"] == 500.0
    assert exposures["total_net_exposure"] == 500.0
    assert exposures["affected_customers_count"] == 1


def test_upcoming_renewal_exposure(client_and_db):
    """
    Verify high risk customer with renewal in next 15 days is counted in upcoming renewal exposure.
    """
    _, db = client_and_db
    now = datetime.now(timezone.utc)

    cust = Customer(
        name="Gamma Inc",
        email="gamma@inc.com",
        mrr=2500.0,
        risk_level=RiskLevel.high,
        risk_score=75.0,
        status=CustomerStatus.active,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    sub = Subscription(
        customer_id=cust.id,
        plan_name="Growth Tier",
        amount=2500.0,
        status=SubscriptionStatus.active,
        current_period_end=now + timedelta(days=12),
    )
    db.add(sub)
    db.commit()

    exposures = calculate_radar_exposures(db, as_of=now)
    assert exposures["upcoming_renewal_exposure"] == 2500.0
    assert exposures["high_risk_recurring_revenue"] == 2500.0
    assert exposures["total_net_exposure"] == 2500.0


def test_radar_customer_records_filter_and_search(client_and_db):
    """
    Test search, filter by risk level and payment status, and sorting in get_radar_customer_records.
    """
    _, db = client_and_db
    now = datetime.now(timezone.utc)

    c1 = Customer(
        name="Zeta Analytics",
        email="zeta@analytics.com",
        mrr=3000.0,
        risk_level=RiskLevel.critical,
        risk_score=95.0,
        status=CustomerStatus.at_risk,
    )
    c2 = Customer(
        name="Alpha Health",
        email="alpha@health.com",
        mrr=1200.0,
        risk_level=RiskLevel.low,
        risk_score=15.0,
        status=CustomerStatus.active,
    )
    db.add_all([c1, c2])
    db.commit()

    # Search for Zeta
    records = get_radar_customer_records(db, search="zeta")
    assert len(records) == 1
    assert records[0]["customer_name"] == "Zeta Analytics"
    assert records[0]["risk_score"] == 95.0

    # Filter by risk_level
    low_records = get_radar_customer_records(db, risk_level="low")
    assert len(low_records) == 1
    assert low_records[0]["customer_name"] == "Alpha Health"

    # Sorting test
    sorted_desc = get_radar_customer_records(db, sort_by="risk_score", sort_order="desc")
    assert sorted_desc[0]["customer_name"] == "Zeta Analytics"
    assert sorted_desc[1]["customer_name"] == "Alpha Health"

    sorted_asc = get_radar_customer_records(db, sort_by="risk_score", sort_order="asc")
    assert sorted_asc[0]["customer_name"] == "Alpha Health"
    assert sorted_asc[1]["customer_name"] == "Zeta Analytics"


def test_radar_api_endpoints(client_and_db):
    """
    Test GET /api/radar/exposures and GET /api/radar/customers via authenticated HTTP request.
    """
    client, _ = client_and_db

    # Login as admin
    login_resp = client.post(
        "/auth/login",
        json={"email": "radar_admin@subnexa.ai", "password": "Admin@1234"},
    )
    assert login_resp.status_code == 200
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test exposures endpoint
    resp = client.get("/api/radar/exposures", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "overdue_invoice_exposure" in data
    assert "failed_payment_exposure" in data
    assert "upcoming_renewal_exposure" in data
    assert "high_risk_recurring_revenue" in data
    assert "total_net_exposure" in data
    assert "affected_customers_count" in data

    # Test customers endpoint
    resp_cust = client.get("/api/radar/customers?search=test", headers=headers)
    assert resp_cust.status_code == 200
    assert "customers" in resp_cust.get_json()

    # Test trigger action endpoint
    resp_act = client.post(
        "/api/radar/trigger-action",
        headers=headers,
        json={"customer_id": "cust-123", "action_type": "dunning_retry"},
    )
    assert resp_act.status_code == 200
    assert resp_act.get_json()["status"] == "success"
