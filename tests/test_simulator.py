"""
Unit and integration tests for What-If Revenue Recovery Simulator.
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
from backend.intelligence.simulator.engine import (
    run_recovery_simulation,
    get_benchmark_specifications,
    HISTORICAL_BENCHMARKS,
)
from backend.intelligence.simulator.models import SavedScenario


@pytest.fixture
def sim_test_setup():
    _db_module._engine = None
    _db_module._SessionLocal = None
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        _db_module.init_db("sqlite:///:memory:")

    db = get_session()

    # Create admin
    admin = User(
        email="sim_admin@subnexa.ai",
        password_hash=hash_password("Admin@1234"),
        role=UserRole.admin,
        first_name="Admin",
        is_active=True,
    )
    db.add(admin)

    # Seed 3 at-risk customers
    now = datetime.now(timezone.utc)
    c1 = Customer(name="Corp One", email="one@corp.com", mrr=4000.0, risk_level=RiskLevel.critical, status=CustomerStatus.at_risk)
    c2 = Customer(name="Corp Two", email="two@corp.com", mrr=6000.0, risk_level=RiskLevel.high, status=CustomerStatus.at_risk)
    c3 = Customer(name="Corp Three", email="three@corp.com", mrr=2000.0, risk_level=RiskLevel.low, status=CustomerStatus.active)
    db.add_all([c1, c2, c3])
    db.commit()

    db.refresh(c1)
    db.refresh(c2)
    db.refresh(c3)

    # Add open invoices and subscriptions for c1 & c2
    inv1 = Invoice(invoice_number="INV-C1", customer_id=c1.id, amount_due=4000.0, amount_paid=0.0, status=InvoiceStatus.open, due_date=now - timedelta(days=10))
    inv2 = Invoice(invoice_number="INV-C2", customer_id=c2.id, amount_due=6000.0, amount_paid=0.0, status=InvoiceStatus.open, due_date=now - timedelta(days=5))
    s1 = Subscription(customer_id=c1.id, plan_name="Pro", amount=4000.0, status=SubscriptionStatus.past_due, current_period_end=now + timedelta(days=10))
    s2 = Subscription(customer_id=c2.id, plan_name="Enterprise", amount=6000.0, status=SubscriptionStatus.past_due, current_period_end=now + timedelta(days=15))
    db.add_all([inv1, inv2, s1, s2])
    db.commit()

    with app.test_client() as client:
        yield client, db

    db.close()
    _db_module._engine = None
    _db_module._SessionLocal = None


def test_simulation_never_alters_core_database(sim_test_setup):
    """
    STRICT SAFETY TEST:
    Verify that running the simulation NEVER mutates or creates real
    Invoices, Payments, Subscriptions, or Customers.
    """
    _, db = sim_test_setup

    inv_count_before = db.query(Invoice).count()
    pmt_count_before = db.query(Payment).count()
    sub_count_before = db.query(Subscription).count()
    cust_count_before = db.query(Customer).count()

    params = {
        "cohort_filter": "all_at_risk",
        "payment_reminders_enabled": True,
        "payment_reminders_intensity": "aggressive",
        "personal_followup_enabled": True,
        "eligible_discounts_enabled": True,
        "discount_percent": 20.0,
        "discount_duration_months": 3,
    }

    res = run_recovery_simulation(db, params)

    assert res["safety_verification"]["database_mutated"] is False
    assert res["safety_verification"]["core_tables_altered"] is False

    # Check database counts remain strictly unchanged
    assert db.query(Invoice).count() == inv_count_before
    assert db.query(Payment).count() == pmt_count_before
    assert db.query(Subscription).count() == sub_count_before
    assert db.query(Customer).count() == cust_count_before


def test_simulation_financial_calculations(sim_test_setup):
    """
    Test accuracy of simulated financial metrics:
    - targeted customers
    - revenue at risk
    - expected recovery rate
    - estimated recovered revenue
    - discount costs
    - net recovery = gross recovered - (discount costs + operational costs)
    """
    _, db = sim_test_setup

    # Test single intervention: Standard payment reminders (22% recovery baseline)
    params = {
        "cohort_filter": "all_at_risk",
        "payment_reminders_enabled": True,
        "payment_reminders_intensity": "standard",
        "personal_followup_enabled": False,
        "renewal_reminders_enabled": False,
        "eligible_discounts_enabled": False,
    }

    res = run_recovery_simulation(db, params)
    summary = res["summary"]

    assert summary["targeted_customers_count"] == 2  # c1 and c2
    assert summary["revenue_at_risk"] == 10000.0      # $4,000 + $6,000
    assert summary["expected_recovery_rate"] == 22.0
    assert summary["estimated_recovered_revenue"] == 2200.0  # 10,000 * 22%
    assert summary["discount_costs"] == 0.0
    assert summary["estimated_net_recovery"] == 2200.0


def test_discount_cost_and_net_recovery_deduction(sim_test_setup):
    """
    Verify that applying discounts calculates the cost and deducts it from gross recovery.
    """
    _, db = sim_test_setup

    params = {
        "cohort_filter": "all_at_risk",
        "payment_reminders_enabled": False,
        "personal_followup_enabled": False,
        "renewal_reminders_enabled": False,
        "eligible_discounts_enabled": True,
        "discount_percent": 10.0,           # 10% discount
        "discount_duration_months": 3,       # 3 months
    }

    res = run_recovery_simulation(db, params)
    summary = res["summary"]

    assert summary["discount_costs"] > 0.0
    # Net recovery must strictly equal gross recovery minus total costs
    assert summary["estimated_net_recovery"] == pytest.approx(
        max(0.0, summary["estimated_recovered_revenue"] - summary["total_intervention_costs"]),
        0.01,
    )


def test_combined_interventions_ceiling_and_diminishing_returns(sim_test_setup):
    """
    Verify that combining multiple aggressive interventions respects diminishing marginal returns
    and never exceeds the empirical ceiling (85%).
    """
    _, db = sim_test_setup

    params = {
        "cohort_filter": "all_at_risk",
        "payment_reminders_enabled": True,
        "payment_reminders_intensity": "aggressive",
        "personal_followup_enabled": True,
        "renewal_reminders_enabled": True,
        "eligible_discounts_enabled": True,
        "discount_percent": 30.0,
        "discount_duration_months": 6,
    }

    res = run_recovery_simulation(db, params)
    summary = res["summary"]

    # Must be capped at ceiling (85%)
    assert summary["expected_recovery_rate"] <= 85.0
    assert summary["expected_recovery_rate"] > 50.0  # Combined synergy should be strong


def test_saved_scenarios_api_lifecycle(sim_test_setup):
    """
    Test API endpoints:
    - POST /api/simulator/simulate
    - GET /api/simulator/benchmarks
    - POST /api/simulator/scenarios (Save)
    - GET /api/simulator/scenarios (List)
    - GET /api/simulator/scenarios/<id> (Get)
    - DELETE /api/simulator/scenarios/<id> (Delete)
    """
    client, _ = sim_test_setup

    login_resp = client.post(
        "/auth/login",
        json={"email": "sim_admin@subnexa.ai", "password": "Admin@1234"},
    )
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Simulate API
    sim_resp = client.post(
        "/api/simulator/simulate",
        headers=headers,
        json={"cohort_filter": "all_at_risk", "payment_reminders_enabled": True},
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.get_json()
    assert "summary" in sim_data
    assert "safety_verification" in sim_data

    # 2. Benchmarks API
    bm_resp = client.get("/api/simulator/benchmarks", headers=headers)
    assert bm_resp.status_code == 200
    assert "benchmarks" in bm_resp.get_json()

    # 3. Save Scenario
    save_resp = client.post(
        "/api/simulator/scenarios",
        headers=headers,
        json={
            "name": "Q4 Aggressive Rescue Campaign",
            "description": "Combines multi-touch dunning with 15% discount for 3mo.",
            "parameters": {"payment_reminders_intensity": "aggressive", "discount_percent": 15.0},
            "results": sim_data["summary"],
        },
    )
    assert save_resp.status_code == 201
    saved_scenario = save_resp.get_json()["scenario"]
    scenario_id = saved_scenario["id"]
    assert saved_scenario["name"] == "Q4 Aggressive Rescue Campaign"

    # 4. List Scenarios
    list_resp = client.get("/api/simulator/scenarios", headers=headers)
    assert list_resp.status_code == 200
    scenarios = list_resp.get_json()["scenarios"]
    assert len(scenarios) == 1
    assert scenarios[0]["id"] == scenario_id

    # 5. Get Specific Scenario
    get_resp = client.get(f"/api/simulator/scenarios/{scenario_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.get_json()["id"] == scenario_id

    # 6. Delete Scenario
    del_resp = client.delete(f"/api/simulator/scenarios/{scenario_id}", headers=headers)
    assert del_resp.status_code == 200

    # Verify deleted
    list_resp2 = client.get("/api/simulator/scenarios", headers=headers)
    assert len(list_resp2.get_json()["scenarios"]) == 0
