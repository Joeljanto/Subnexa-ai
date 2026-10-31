"""
End-to-End Workflow Test:
Failed payment
-> Revenue at risk detected
-> Risk explained
-> Action recommended
-> Recovery simulated
-> Payment collected
-> Actual recovery confirmed.
"""
from datetime import datetime, timezone, timedelta
import pytest
import backend.database as _db_module
from backend.app import create_app
from backend.auth.models import User, UserRole
from backend.customers.models import Customer, CustomerStatus, RiskLevel
from backend.subscriptions.models import Subscription, SubscriptionStatus, BillingInterval
from backend.payments.models import Payment, PaymentStatus, PaymentMethod
from backend.billing.models import Invoice, InvoiceStatus
from backend.recovery.models import RecoveryAction, RecoveryActionStatus


@pytest.fixture
def workflow_client():
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


def test_full_revenue_rescue_lifecycle_workflow(workflow_client):
    """
    Executes the complete SubNexa AI revenue rescue pipeline from initial
    payment drop to final verified cash recovery.
    """
    # ── 0. Setup Staff User and Auth ──────────────────────────────────────────
    db = _db_module.get_session()
    now = datetime.now(timezone.utc)
    try:
        staff = User(
            email="rescue_agent@subnexa.ai",
            password_hash="some-hash",
            first_name="Jordan",
            last_name="Lee",
            role=UserRole.staff,
            is_active=True,
            is_verified=True,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)
        staff_id = staff.id
    finally:
        db.close()

    # Generate staff JWT token
    from backend.auth.utils import generate_access_token
    with workflow_client.application.app_context():
        token = generate_access_token(staff_id, "rescue_agent@subnexa.ai", "staff")
    headers = {"Authorization": f"Bearer {token}"}

    # ── 1. STEP 1: FAILED PAYMENT INGESTION ────────────────────────────────────
    db = _db_module.get_session()
    try:
        customer = Customer(
            name="Apex Dynamics Corp",
            email="finance@apexdynamics.com",
            company="Apex Dynamics",
            mrr=3500.0,
            ltv=42000.0,
            status=CustomerStatus.active,
            risk_level=RiskLevel.low,
            risk_score=15.0,
            days_since_last_payment=35,
            failed_payments_count=2,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        cust_id = customer.id

        sub = Subscription(
            customer_id=cust_id,
            plan_name="Enterprise Scale",
            amount=3500.0,
            billing_interval=BillingInterval.monthly,
            status=SubscriptionStatus.active,
            current_period_end=now + timedelta(days=12),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id

        # Past due overdue invoice
        inv = Invoice(
            customer_id=cust_id,
            subscription_id=sub_id,
            invoice_number="INV-APEX-9001",
            amount_due=3500.0,
            amount_paid=0.0,
            status=InvoiceStatus.open,
            due_date=now - timedelta(days=5),
        )
        db.add(inv)

        # Failed card charge
        failed_pay = Payment(
            customer_id=cust_id,
            subscription_id=sub_id,
            amount=3500.0,
            status=PaymentStatus.failed,
            method=PaymentMethod.card,
            description="Card declined",
            failure_reason="Insufficient funds (test trigger)",
            created_at=now - timedelta(days=5),
        )
        db.add(failed_pay)
        db.commit()
    finally:
        db.close()

    # ── 2. STEP 2: REVENUE AT RISK DETECTED BY RADAR ──────────────────────────
    radar_resp = workflow_client.get("/api/radar/customers", headers=headers)
    assert radar_resp.status_code == 200
    radar_data = radar_resp.get_json()
    apex_record = next((c for c in radar_data["customers"] if c["id"] == cust_id), None)
    assert apex_record is not None
    # Outstanding balance detected
    assert apex_record["outstanding_balance"] == 3500.0
    # Engine elevated risk score due to failed payments & overdue balance
    assert apex_record["risk_score"] > 50.0

    # Verify exposure totals
    exp_resp = workflow_client.get("/api/radar/exposures", headers=headers)
    assert exp_resp.status_code == 200
    exposures = exp_resp.get_json()
    assert exposures["overdue_invoice_exposure"] >= 3500.0
    assert exposures["total_net_exposure"] >= 3500.0

    # ── 3. STEP 3: RISK EXPLAINED BY SUBSAGE RISK ENGINE ──────────────────────
    explain_resp = workflow_client.get(f"/api/intelligence/risk/explain/{cust_id}", headers=headers)
    assert explain_resp.status_code == 200
    explain_data = explain_resp.get_json()
    assert explain_data["customer_id"] == cust_id
    assert "contributing_factors" in explain_data
    assert len(explain_data["contributing_factors"]) > 0
    # 7 explainable features extracted
    features = explain_data["evaluated_features"]
    assert features["failed_payment_count"] >= 1
    assert features["outstanding_balance"] >= 3500.0

    # ── 4. STEP 4: ACTIONS RECOMMENDED ────────────────────────────────────────
    recommendations = explain_data["recommended_actions"]
    assert len(recommendations) > 0
    rec_texts = [r["action"].lower() for r in recommendations]
    assert any("payment" in t or "failure" in t or "reminder" in t or "retention" in t for t in rec_texts)

    # ── 5. STEP 5: RECOVERY SIMULATED ─────────────────────────────────────────
    sim_resp = workflow_client.post(
        "/api/simulator/simulate",
        headers=headers,
        json={
            "cohort_filter": "all_at_risk",
            "payment_reminders_enabled": True,
            "payment_reminders_intensity": "aggressive",
            "personal_followup_enabled": True,
            "personal_followup_min_mrr": 2000.0,
            "eligible_discounts_enabled": False,
        },
    )
    assert sim_resp.status_code == 200
    sim_result = sim_resp.get_json()["summary"]
    assert sim_result["targeted_customers_count"] >= 1
    assert sim_result["revenue_at_risk"] >= 3500.0
    assert sim_result["estimated_recovered_revenue"] > 0
    assert sim_result["estimated_net_recovery"] > 0
    simulated_amount = sim_result["estimated_recovered_revenue"]

    # ── 6. STEP 6: WORKFLOW ASSIGNMENT & PAYMENT COLLECTED ─────────────────────
    # Assign recommended action
    assign_resp = workflow_client.post(
        "/api/recovery/actions",
        headers=headers,
        json={
            "customer_id": cust_id,
            "action_type": "payment_reminder",
            "title": "Aggressive Payment Recovery & Outreach",
            "simulated_recovery_amount": simulated_amount,
        },
    )
    assert assign_resp.status_code == 201
    action_id = assign_resp.get_json()["action"]["id"]

    # Customer responds with promise to clear balance
    resp_recorded = workflow_client.post(
        f"/api/recovery/actions/{action_id}/response",
        headers=headers,
        json={
            "customer_response": "promised_to_pay",
            "notes": "Spoke with VP Finance; updated payment method will clear within 24h.",
        },
    )
    assert resp_recorded.status_code == 200
    assert resp_recorded.get_json()["action"]["status"] == "in_progress"

    # Staff records payment collected (Confirmed: True, Costs: $75.00 for outreach labor)
    payment_resp = workflow_client.post(
        f"/api/recovery/actions/{action_id}/record-payment",
        headers=headers,
        json={
            "amount": 3500.0,
            "is_confirmed": True,
            "intervention_costs": 75.0,
            "notes": "ACH transfer cleared. Full subscription recovered.",
        },
    )
    assert payment_resp.status_code == 200
    action_data = payment_resp.get_json()["action"]
    assert action_data["status"] == "completed"
    assert action_data["is_confirmed_payment"] is True
    assert action_data["actual_recovered_amount"] == 3500.0
    assert action_data["net_recovered_revenue"] == 3425.0  # 3500 - 75

    # ── 7. STEP 7: ACTUAL RECOVERY CONFIRMED & AUDITED ────────────────────────
    # Verify immutable audit trail has all 3 chronological milestones
    audit_resp = workflow_client.get(f"/api/recovery/actions/{action_id}/audit", headers=headers)
    assert audit_resp.status_code == 200
    audit_logs = audit_resp.get_json()["audit_trail"]
    event_types = [e["event_type"] for e in audit_logs]
    assert "ASSIGNED" in event_types
    assert "RESPONSE_RECORDED" in event_types
    assert "PAYMENT_COLLECTED" in event_types

    # Verify Executive Comparison reflects confirmed recovered dollars
    comp_resp = workflow_client.get("/api/recovery/comparison", headers=headers)
    assert comp_resp.status_code == 200
    comparison = comp_resp.get_json()["summary"]
    assert comparison["actual_collected_recovery"] >= 3500.0
    assert comparison["intervention_costs"] >= 75.0
    assert comparison["net_recovered_revenue"] >= 3425.0
    assert comparison["realization_rate"] > 0

    # Verify Radar reflects completed recovery status for this customer
    radar_check = workflow_client.get("/api/radar/customers", headers=headers)
    assert radar_check.status_code == 200
    updated_apex = next((c for c in radar_check.get_json()["customers"] if c["id"] == cust_id), None)
    assert updated_apex is not None
    assert updated_apex["recovery_tracking"]["has_active_action"] is True
    assert updated_apex["recovery_tracking"]["action_status"] == "completed"
    assert updated_apex["recovery_tracking"]["actual_recovered_amount"] == 3500.0
