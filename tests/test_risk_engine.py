"""
Unit and integration tests for SubSage Explainable Risk Engine.
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
from backend.intelligence.risk_engine.engine import (
    CustomerFeatures,
    extract_customer_features,
    evaluate_explainable_risk,
    train_ml_model_if_feasible,
    get_ml_metrics,
    MIN_LABELLED_SAMPLES_FOR_ML,
)


@pytest.fixture
def risk_test_setup():
    _db_module._engine = None
    _db_module._SessionLocal = None
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    db = get_session()

    # Create admin
    admin = User(
        email="risk_admin@subnexa.ai",
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


def test_feature_extraction_all_7_dimensions(risk_test_setup):
    """
    Test extraction of all 7 required dimensions:
    - failed payment count
    - late payment history
    - payment success ratio
    - subscription age
    - days until renewal
    - outstanding invoices
    - previous renewals
    """
    _, db = risk_test_setup
    now = datetime.now(timezone.utc)

    cust = Customer(
        name="Alpha Tech",
        email="alpha@tech.io",
        mrr=3500.0,
        status=CustomerStatus.active,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    # 120 days old subscription
    sub = Subscription(
        customer_id=cust.id,
        plan_name="Enterprise Plan",
        amount=3500.0,
        status=SubscriptionStatus.active,
        created_at=now - timedelta(days=120),
        current_period_end=now + timedelta(days=8),
    )
    db.add(sub)

    # 3 payments: 2 succeeded, 1 failed
    p1 = Payment(customer_id=cust.id, amount=3500.0, status=PaymentStatus.succeeded, created_at=now - timedelta(days=90))
    p2 = Payment(customer_id=cust.id, amount=3500.0, status=PaymentStatus.succeeded, created_at=now - timedelta(days=60))
    p3 = Payment(customer_id=cust.id, amount=3500.0, status=PaymentStatus.failed, created_at=now - timedelta(days=30))
    db.add_all([p1, p2, p3])

    # 1 open overdue invoice
    inv = Invoice(
        invoice_number="INV-ALPHA-1",
        customer_id=cust.id,
        amount_due=3500.0,
        amount_paid=0.0,
        status=InvoiceStatus.open,
        due_date=now - timedelta(days=15),
    )
    db.add(inv)
    db.commit()

    feat = extract_customer_features(db, cust.id, as_of=now)
    assert feat is not None
    assert feat.failed_payment_count == 1
    assert feat.payment_success_ratio == pytest.approx(2 / 3, 0.01)
    assert feat.subscription_age_days >= 119
    assert feat.days_until_renewal == 8
    assert feat.outstanding_invoices_count == 1
    assert feat.outstanding_balance == 3500.0
    assert feat.late_payment_count == 1
    assert feat.previous_renewals_count >= 3


def test_explainable_risk_scoring_and_factor_breakdown():
    """
    Test that evaluate_explainable_risk produces both churn and payment risk assessments,
    computes risk levels, and generates explainable contributing factors.
    """
    feat = CustomerFeatures(
        customer_id="test-1",
        customer_name="High Risk Co",
        failed_payment_count=3,
        late_payment_count=2,
        payment_success_ratio=0.5,
        subscription_age_days=45,
        days_until_renewal=4,
        outstanding_invoices_count=2,
        outstanding_balance=7200.0,
        previous_renewals_count=1,
        mrr=3600.0,
        current_status="at_risk",
    )

    result = evaluate_explainable_risk(feat)

    assert result["engine_mode"] == "rule_based_transparent"
    assert "payment_risk" in result
    assert "churn_risk" in result
    assert result["payment_risk"]["score"] > 60.0
    assert result["churn_risk"]["score"] > 50.0
    assert result["risk_level"] in ["high", "critical"]

    # Contributing factors
    factors = result["contributing_factors"]
    assert len(factors) >= 3
    factor_names = [f["factor"] for f in factors]
    assert "Failed Payment Frequency" in factor_names
    assert "Outstanding Invoices & Arrears" in factor_names

    # Recommended actions should contain the 5 requested actions based on triggers
    action_names = [a["action"] for a in result["recommended_actions"]]
    assert "Resolve payment failure" in action_names
    assert "Send payment reminder" in action_names
    assert "Contact customer" in action_names
    assert "Send renewal reminder" in action_names


def test_recommended_actions_eligibility():
    """
    Verify specific action recommendations:
    - Contact customer
    - Send payment reminder
    - Resolve payment failure
    - Send renewal reminder
    - Review eligible retention offer
    """
    feat_churn = CustomerFeatures(
        customer_id="test-churn",
        customer_name="Churn Risk LLC",
        failed_payment_count=1,
        late_payment_count=1,
        payment_success_ratio=0.6,
        subscription_age_days=50,
        days_until_renewal=6,
        outstanding_invoices_count=1,
        outstanding_balance=2000.0,
        previous_renewals_count=1,
        mrr=5000.0,
        current_status="at_risk",
    )
    res = evaluate_explainable_risk(feat_churn)
    actions = {a["action"] for a in res["recommended_actions"]}

    assert "Contact customer" in actions
    assert "Send payment reminder" in actions
    assert "Resolve payment failure" in actions
    assert "Send renewal reminder" in actions
    assert "Review eligible retention offer" in actions


def test_honest_accuracy_when_insufficient_training_data(risk_test_setup):
    """
    Test that when training data is below threshold (e.g. 5 customers < 30 required),
    the engine does NOT invent model accuracy and transparently reports insufficient data.
    """
    _, db = risk_test_setup

    # Insert 3 customers (< MIN_LABELLED_SAMPLES_FOR_ML)
    for i in range(3):
        c = Customer(
            name=f"Customer {i}",
            email=f"cust{i}@example.com",
            mrr=1000.0,
            status=CustomerStatus.active,
        )
        db.add(c)
    db.commit()

    metrics = train_ml_model_if_feasible(db)
    assert metrics["status"] == "insufficient_labelled_data"
    assert metrics["accuracy"] is None  # Never invented!
    assert metrics["current_mode"] == "rule_based_transparent"
    assert metrics["samples_available"] == 3
    assert metrics["minimum_required"] == MIN_LABELLED_SAMPLES_FOR_ML


def test_explain_api_endpoints(risk_test_setup):
    """
    Test GET /api/intelligence/risk/explain/<customer_id> and model-status endpoint.
    """
    client, db = risk_test_setup

    cust = Customer(
        name="Beta Labs",
        email="beta@labs.io",
        mrr=4000.0,
        status=CustomerStatus.active,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    login_resp = client.post(
        "/auth/login",
        json={"email": "risk_admin@subnexa.ai", "password": "Admin@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test single customer explain endpoint
    resp = client.get(f"/api/intelligence/risk/explain/{cust.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["customer_id"] == cust.id
    assert "payment_risk" in data
    assert "churn_risk" in data
    assert "contributing_factors" in data
    assert "recommended_actions" in data
    assert data["engine_mode"] == "rule_based_transparent"

    # Test model status endpoint
    resp_status = client.get("/api/intelligence/risk/model-status", headers=headers)
    assert resp_status.status_code == 200
    assert "current_mode" in resp_status.get_json()
