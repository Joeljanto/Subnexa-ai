"""
SubSage Intelligence – main routes.
Provides KPI aggregations, risk distribution, and radar data for the dashboard.
"""
from flask import Blueprint, jsonify
from backend.database import get_session
from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.payments.models import Payment, PaymentStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus
from backend.auth.decorators import jwt_required, role_required

intelligence_bp = Blueprint("intelligence", __name__)


@intelligence_bp.get("/dashboard/kpis")
@jwt_required
@role_required("admin", "staff")
def dashboard_kpis():
    """Aggregate KPI metrics for the Overview dashboard."""
    db = get_session()
    try:
        # Revenue at risk = MRR of customers with risk_level high/critical
        high_risk_customers = (
            db.query(Customer)
            .filter(Customer.risk_level.in_([RiskLevel.high, RiskLevel.critical]))
            .all()
        )
        revenue_at_risk = sum(c.mrr for c in high_risk_customers)

        # High-risk customer count
        high_risk_count = len(high_risk_customers)

        # Failed payments (last 30-35 days)
        from datetime import datetime, timezone, timedelta
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=35)
        failed_payments = (
            db.query(Payment)
            .filter(
                Payment.status == PaymentStatus.failed,
                Payment.created_at >= thirty_days_ago,
            )
            .all()
        )
        failed_payment_count = len(failed_payments)
        failed_payment_amount = sum(p.amount for p in failed_payments)

        # Potential recovery = amount of failed payments
        potential_recovery = failed_payment_amount

        # Total MRR
        active_subs = (
            db.query(Subscription)
            .filter(Subscription.status == SubscriptionStatus.active)
            .all()
        )
        total_mrr = sum(s.amount for s in active_subs)

        # Total customers
        total_customers = db.query(Customer).count()

        return jsonify({
            "revenue_at_risk": round(revenue_at_risk, 2),
            "high_risk_customers": high_risk_count,
            "failed_payments_count": failed_payment_count,
            "failed_payments_amount": round(failed_payment_amount, 2),
            "potential_recovery": round(potential_recovery, 2),
            "total_mrr": round(total_mrr, 2),
            "total_customers": total_customers,
        })
    finally:
        db.close()


@intelligence_bp.get("/risk/distribution")
@jwt_required
@role_required("admin", "staff")
def risk_distribution():
    """Returns count of customers at each risk level."""
    db = get_session()
    try:
        distribution = {}
        for level in RiskLevel:
            count = db.query(Customer).filter(Customer.risk_level == level).count()
            distribution[level.value] = count
        return jsonify({"distribution": distribution})
    finally:
        db.close()


@intelligence_bp.get("/radar")
@jwt_required
@role_required("admin", "staff")
def revenue_rescue_radar():
    """
    Revenue Rescue Radar – returns at-risk customers with recommended actions
    from SubSage Intelligence.
    """
    db = get_session()
    try:
        at_risk = (
            db.query(Customer)
            .filter(
                Customer.risk_level.in_([RiskLevel.high, RiskLevel.critical])
            )
            .order_by(Customer.risk_score.desc())
            .limit(20)
            .all()
        )

        radar_items = []
        for c in at_risk:
            actions = _get_recommended_actions(c)
            radar_items.append({
                **c.to_dict(),
                "recommended_actions": actions,
            })

        return jsonify({"radar": radar_items})
    finally:
        db.close()


def _get_recommended_actions(customer: Customer) -> list[str]:
    """Simple rule-based recommendations from SubSage Intelligence."""
    actions = []
    if customer.failed_payments_count > 0:
        actions.append("Retry failed payment with alternate card")
    if customer.days_since_last_payment > 30:
        actions.append("Send payment reminder email")
    if customer.churn_probability > 0.7:
        actions.append("Offer retention discount")
    if customer.risk_score > 80:
        actions.append("Schedule customer success call")
    if not actions:
        actions.append("Monitor account closely")
    return actions


@intelligence_bp.get("/revenue/trend")
@jwt_required
@role_required("admin", "staff")
def revenue_trend():
    """
    Returns monthly revenue trend data for the last 6 months.
    Computed from payments.
    """
    from datetime import datetime, timezone, timedelta
    from collections import defaultdict

    db = get_session()
    try:
        now = datetime.now(timezone.utc)
        months_data = defaultdict(lambda: {"revenue": 0.0, "failed": 0.0})

        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            label = month_start.strftime("%b %Y")
            months_data[label]  # initialize

        # Get all payments in last 6 months
        six_months_ago = now - timedelta(days=180)
        payments = (
            db.query(Payment)
            .filter(Payment.created_at >= six_months_ago)
            .all()
        )

        for p in payments:
            if p.created_at:
                label = p.created_at.strftime("%b %Y")
                if p.status.value == "succeeded":
                    months_data[label]["revenue"] += p.amount
                elif p.status.value == "failed":
                    months_data[label]["failed"] += p.amount

        trend = [
            {"month": month, **data}
            for month, data in months_data.items()
        ]

        return jsonify({"trend": trend})
    finally:
        db.close()


# ── SubSage Explainable Risk Engine Endpoints ─────────────────────────────────

@intelligence_bp.get("/risk/explain/<string:customer_id>")
@jwt_required
@role_required("admin", "staff")
def explain_customer_risk(customer_id: str):
    """
    Generate an explainable risk report for a specific customer:
    - Analyzes failed payment count, late payment history, payment success ratio,
      subscription age, days until renewal, outstanding invoices, previous renewals.
    - Yields payment risk score, churn risk score, contributing factors with weights,
      and 5 contextual recommended actions.
    """
    from backend.intelligence.risk_engine.engine import (
        extract_customer_features,
        evaluate_explainable_risk,
    )
    db = get_session()
    try:
        features = extract_customer_features(db, customer_id)
        if not features:
            return jsonify({"error": "Customer not found"}), 404

        report = evaluate_explainable_risk(features)
        return jsonify(report)
    finally:
        db.close()


@intelligence_bp.get("/risk/batch-explain")
@jwt_required
@role_required("admin", "staff")
def batch_explain_risk():
    """
    Run explainable risk engine on all customers.
    """
    from backend.intelligence.risk_engine.engine import (
        extract_customer_features,
        evaluate_explainable_risk,
    )
    db = get_session()
    try:
        customers = db.query(Customer).all()
        results = []
        for c in customers:
            feat = extract_customer_features(db, c.id)
            if feat:
                res = evaluate_explainable_risk(feat)
                results.append(res)
        return jsonify({"results": results, "total": len(results)})
    finally:
        db.close()


@intelligence_bp.get("/risk/model-status")
@jwt_required
@role_required("admin", "staff")
def model_status():
    """
    Get current transparency status of the risk engine (Rule-Based vs Scikit-Learn ML).
    """
    from backend.intelligence.risk_engine.engine import get_ml_metrics
    return jsonify(get_ml_metrics())


@intelligence_bp.post("/risk/train")
@jwt_required
@role_required("admin")
def train_model():
    """
    Attempt to train Scikit-learn model on historical database.
    Transparently rejects/reports if insufficient labelled data exists.
    """
    from backend.intelligence.risk_engine.engine import train_ml_model_if_feasible
    db = get_session()
    try:
        metrics = train_ml_model_if_feasible(db)
        return jsonify(metrics)
    finally:
        db.close()

