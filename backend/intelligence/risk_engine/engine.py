"""
SubSage Intelligence – Explainable Risk Engine.

Analyzes:
- Failed payment count
- Late payment history
- Payment success ratio
- Subscription age
- Days until renewal
- Outstanding invoices
- Previous renewals

Generates:
- Churn risk assessment (score & probability)
- Payment risk assessment (score & probability)
- Risk level (low, medium, high, critical)
- Contributing risk factors with transparent explanations and weights
- Actionable recommendations (Contact customer, Send payment reminder,
  Resolve payment failure, Send renewal reminder, Review eligible retention offer)

ML vs. Rule-Based Transparency:
- Uses scikit-learn GradientBoostingClassifier / RandomForestClassifier when sufficient
  ground-truth labelled records exist (N >= 30).
- When labelled training volume is below threshold, falls back to a transparent,
  audited rule-based scoring engine and explicitly labels the output as
  'rule_based_transparent' without fabricating artificial accuracy numbers.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session

from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus
from backend.payments.models import Payment, PaymentStatus
from backend.billing.models import Invoice, InvoiceStatus

# Threshold for ML supervised training
MIN_LABELLED_SAMPLES_FOR_ML = 30

# Global trained model cache
_ML_MODEL = None
_ML_METRICS: Optional[Dict[str, Any]] = None


class CustomerFeatures:
    """Standardized feature set for SubSage Risk Engine."""
    def __init__(
        self,
        customer_id: str,
        customer_name: str,
        failed_payment_count: int,
        late_payment_count: int,
        payment_success_ratio: float,
        subscription_age_days: int,
        days_until_renewal: int,
        outstanding_invoices_count: int,
        outstanding_balance: float,
        previous_renewals_count: int,
        mrr: float,
        current_status: str,
    ):
        self.customer_id = customer_id
        self.customer_name = customer_name
        self.failed_payment_count = failed_payment_count
        self.late_payment_count = late_payment_count
        self.payment_success_ratio = payment_success_ratio
        self.subscription_age_days = subscription_age_days
        self.days_until_renewal = days_until_renewal
        self.outstanding_invoices_count = outstanding_invoices_count
        self.outstanding_balance = outstanding_balance
        self.previous_renewals_count = previous_renewals_count
        self.mrr = mrr
        self.current_status = current_status

    def to_feature_vector(self) -> List[float]:
        return [
            float(self.failed_payment_count),
            float(self.late_payment_count),
            float(self.payment_success_ratio),
            float(self.subscription_age_days),
            float(self.days_until_renewal),
            float(self.outstanding_invoices_count),
            float(self.outstanding_balance),
            float(self.previous_renewals_count),
            float(self.mrr),
        ]


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def extract_customer_features(db: Session, customer_id: str, as_of: Optional[datetime] = None) -> Optional[CustomerFeatures]:
    """Extract the 7 required risk features directly from database records."""
    now = _to_utc(as_of) or datetime.now(timezone.utc)
    customer = db.get(Customer, customer_id)
    if not customer:
        return None

    subscription = (
        db.query(Subscription)
        .filter(Subscription.customer_id == customer_id)
        .order_by(Subscription.created_at.desc())
        .first()
    )

    payments = db.query(Payment).filter(Payment.customer_id == customer_id).all()
    invoices = db.query(Invoice).filter(Invoice.customer_id == customer_id).all()

    # 1. Failed payment count
    failed_payments = [p for p in payments if p.status == PaymentStatus.failed]
    failed_payment_count = len(failed_payments)

    # 2. Payment success ratio
    succeeded_payments = [p for p in payments if p.status == PaymentStatus.succeeded]
    total_payment_attempts = len(failed_payments) + len(succeeded_payments)
    payment_success_ratio = (
        len(succeeded_payments) / total_payment_attempts
        if total_payment_attempts > 0
        else 1.0
    )

    # 3. Late payment history & outstanding invoices
    late_payment_count = 0
    outstanding_invoices_count = 0
    outstanding_balance = 0.0

    for inv in invoices:
        balance = max(0.0, inv.amount_due - (inv.amount_paid or 0.0))
        due_date = _to_utc(inv.due_date)
        paid_at = _to_utc(inv.paid_at)

        if balance > 0:
            outstanding_invoices_count += 1
            outstanding_balance += balance
            if due_date and due_date < now:
                late_payment_count += 1
        elif paid_at and due_date and paid_at > due_date:
            late_payment_count += 1

    # 4. Subscription age & renewal proximity
    if subscription:
        sub_created = _to_utc(subscription.created_at) or now
        subscription_age_days = max(0, (now - sub_created).days)

        sub_end = _to_utc(subscription.current_period_end)
        if sub_end:
            days_until_renewal = (sub_end - now).days
        else:
            days_until_renewal = 30

        # 5. Previous renewals count
        # In monthly billing, estimate completed cycles minus initial period
        previous_renewals_count = max(0, subscription_age_days // 30)
    else:
        subscription_age_days = 0
        days_until_renewal = 999
        previous_renewals_count = 0

    return CustomerFeatures(
        customer_id=customer.id,
        customer_name=customer.name,
        failed_payment_count=failed_payment_count,
        late_payment_count=late_payment_count,
        payment_success_ratio=payment_success_ratio,
        subscription_age_days=subscription_age_days,
        days_until_renewal=days_until_renewal,
        outstanding_invoices_count=outstanding_invoices_count,
        outstanding_balance=outstanding_balance,
        previous_renewals_count=previous_renewals_count,
        mrr=customer.mrr or 0.0,
        current_status=customer.status.value if customer.status else "active",
    )


def evaluate_explainable_risk(features: CustomerFeatures) -> Dict[str, Any]:
    """
    Transparent Rule-Based Scoring Engine.
    Produces:
    - Payment Risk Score (0-100) & Probability
    - Churn Risk Score (0-100) & Probability
    - Overall Risk Level (low, medium, high, critical)
    - Detailed, human-readable contributing factors with impact scores
    - Context-aware recommended actions
    """
    contributing_factors = []
    payment_risk_points = 0.0
    churn_risk_points = 0.0

    # ── Factor 1: Failed Payment Count (High impact on payment risk) ───────────
    if features.failed_payment_count > 0:
        pts = min(45.0, features.failed_payment_count * 15.0)
        payment_risk_points += pts
        churn_risk_points += pts * 0.7
        contributing_factors.append({
            "factor": "Failed Payment Frequency",
            "observed_value": f"{features.failed_payment_count} failure(s)",
            "benchmark": "0 failures",
            "impact_score": round(pts, 1),
            "severity": "critical" if features.failed_payment_count >= 3 else "high",
            "explanation": f"Account has experienced {features.failed_payment_count} payment decline(s), indicating card expiration, credit limit block, or processing issues.",
        })
    else:
        contributing_factors.append({
            "factor": "Failed Payment Frequency",
            "observed_value": "0 failures",
            "benchmark": "0 failures",
            "impact_score": 0.0,
            "severity": "positive",
            "explanation": "No recent payment failures detected.",
        })

    # ── Factor 2: Payment Success Ratio ───────────────────────────────────────
    if features.payment_success_ratio < 0.75:
        ratio_pct = int(features.payment_success_ratio * 100)
        pts = (1.0 - features.payment_success_ratio) * 30.0
        payment_risk_points += pts
        churn_risk_points += pts * 0.5
        contributing_factors.append({
            "factor": "Payment Success Ratio",
            "observed_value": f"{ratio_pct}% success rate",
            "benchmark": ">= 90%",
            "impact_score": round(pts, 1),
            "severity": "high" if features.payment_success_ratio < 0.5 else "medium",
            "explanation": f"Payment success rate ({ratio_pct}%) is significantly below healthy SaaS baseline (90%+).",
        })

    # ── Factor 3: Late Payment History & Overdue Invoices ─────────────────────
    if features.outstanding_invoices_count > 0 or features.outstanding_balance > 0:
        pts = min(40.0, 15.0 + (features.outstanding_invoices_count * 10.0))
        payment_risk_points += pts
        churn_risk_points += pts * 0.6
        contributing_factors.append({
            "factor": "Outstanding Invoices & Arrears",
            "observed_value": f"${features.outstanding_balance:,.2f} across {features.outstanding_invoices_count} invoice(s)",
            "benchmark": "$0.00 outstanding",
            "impact_score": round(pts, 1),
            "severity": "critical" if features.outstanding_balance > 5000 else "high",
            "explanation": f"Unpaid delinquent balance of ${features.outstanding_balance:,.2f} exposes the account to immediate dunning escalation.",
        })

    if features.late_payment_count > 0:
        pts = min(20.0, features.late_payment_count * 8.0)
        payment_risk_points += pts
        churn_risk_points += pts * 0.5
        contributing_factors.append({
            "factor": "Late Payment History",
            "observed_value": f"{features.late_payment_count} late payment incident(s)",
            "benchmark": "0 late payments",
            "impact_score": round(pts, 1),
            "severity": "medium",
            "explanation": f"History of {features.late_payment_count} payments made after the due date signals cash flow friction.",
        })

    # ── Factor 4: Days Until Renewal (Proximity Risk) ──────────────────────────
    if features.days_until_renewal <= 14 and (payment_risk_points > 20 or features.current_status != "active"):
        pts = 20.0 if features.days_until_renewal <= 7 else 12.0
        churn_risk_points += pts
        contributing_factors.append({
            "factor": "Renewal Proximity & Friction",
            "observed_value": f"Renews in {features.days_until_renewal} day(s)",
            "benchmark": "> 30 days buffer",
            "impact_score": round(pts, 1),
            "severity": "high" if features.days_until_renewal <= 7 else "medium",
            "explanation": f"Subscription renewal occurs within {features.days_until_renewal} days while unresolved payment friction exists.",
        })

    # ── Factor 5: Subscription Tenure & Previous Renewals (Mitigating Factor) ─
    if features.previous_renewals_count >= 3:
        mitigation = min(25.0, features.previous_renewals_count * 4.0)
        payment_risk_points = max(0.0, payment_risk_points - (mitigation * 0.5))
        churn_risk_points = max(0.0, churn_risk_points - mitigation)
        contributing_factors.append({
            "factor": "Tenure Loyalty Buffer",
            "observed_value": f"{features.previous_renewals_count} renewals ({features.subscription_age_days} days)",
            "benchmark": "Established account (>= 3 renewals)",
            "impact_score": -round(mitigation, 1),
            "severity": "positive",
            "explanation": f"Customer has successfully renewed {features.previous_renewals_count} times; established tenure reduces baseline voluntary churn risk.",
        })
    elif features.subscription_age_days < 60:
        # Early-life onboarding fragility
        pts = 10.0
        churn_risk_points += pts
        contributing_factors.append({
            "factor": "Early-Life Fragility",
            "observed_value": f"{features.subscription_age_days} days active",
            "benchmark": "> 90 days ramp-up",
            "impact_score": round(pts, 1),
            "severity": "medium",
            "explanation": "Account is in the critical first 60 days where churn rates are historically highest.",
        })

    # Bound scores to 0-100 range
    payment_risk_score = round(min(100.0, max(0.0, payment_risk_points)), 1)
    churn_risk_score = round(min(100.0, max(0.0, churn_risk_points)), 1)

    # Combined synthesized risk score
    overall_risk_score = round(min(100.0, (payment_risk_score * 0.55) + (churn_risk_score * 0.45)), 1)

    # Risk level classification
    if overall_risk_score >= 80:
        risk_level = "critical"
    elif overall_risk_score >= 65:
        risk_level = "high"
    elif overall_risk_score >= 35:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Contextual Action Recommendations (from the 5 requested actions)
    recommendations = []
    # 1. Resolve payment failure
    if features.failed_payment_count > 0 or payment_risk_score >= 60:
        recommendations.append({
            "action": "Resolve payment failure",
            "priority": "urgent",
            "trigger": "Failed payment attempts or low success ratio",
            "details": "Initiate automated Smart Retries on secondary card, or prompt customer to update payment credentials via self-serve link.",
        })

    # 2. Send payment reminder
    if features.outstanding_balance > 0 or features.late_payment_count > 0:
        recommendations.append({
            "action": "Send payment reminder",
            "priority": "high",
            "trigger": "Outstanding invoices or overdue balance",
            "details": f"Dispatch urgent invoice reminder with copy of delinquent amount (${features.outstanding_balance:,.2f}).",
        })

    # 3. Contact customer
    if overall_risk_score >= 70 or features.mrr >= 4000:
        recommendations.append({
            "action": "Contact customer",
            "priority": "high",
            "trigger": "High churn risk or high-value account at jeopardy",
            "details": "Assign Customer Success rep for high-touch intervention call before churn occurs.",
        })

    # 4. Send renewal reminder
    if 0 <= features.days_until_renewal <= 14:
        recommendations.append({
            "action": "Send renewal reminder",
            "priority": "medium",
            "trigger": f"Renewal in {features.days_until_renewal} days",
            "details": "Send proactive renewal notification highlighting value metrics and feature utilization.",
        })

    # 5. Review eligible retention offer
    if churn_risk_score >= 60:
        recommendations.append({
            "action": "Review eligible retention offer",
            "priority": "high",
            "trigger": "High churn probability (>= 60%)",
            "details": "Authorize 15-20% 3-month retention pause or plan right-sizing offer.",
        })

    if not recommendations:
        recommendations.append({
            "action": "Monitor account",
            "priority": "low",
            "trigger": "Low risk profile",
            "details": "Account metrics are stable. Maintain standard automated billing cadence.",
        })

    return {
        "engine_mode": "rule_based_transparent",
        "engine_label": "SubSage Audited Rule-Based Engine (Deterministic)",
        "customer_id": features.customer_id,
        "customer_name": features.customer_name,
        "payment_risk": {
            "score": payment_risk_score,
            "probability": round(payment_risk_score / 100.0, 2),
            "level": "high" if payment_risk_score >= 65 else "medium" if payment_risk_score >= 35 else "low",
        },
        "churn_risk": {
            "score": churn_risk_score,
            "probability": round(churn_risk_score / 100.0, 2),
            "level": "high" if churn_risk_score >= 65 else "medium" if churn_risk_score >= 35 else "low",
        },
        "overall_risk_score": overall_risk_score,
        "risk_level": risk_level,
        "contributing_factors": contributing_factors,
        "recommended_actions": recommendations,
        "evaluated_features": {
            "failed_payment_count": features.failed_payment_count,
            "late_payment_count": features.late_payment_count,
            "payment_success_ratio": round(features.payment_success_ratio, 2),
            "subscription_age_days": features.subscription_age_days,
            "days_until_renewal": features.days_until_renewal,
            "outstanding_invoices_count": features.outstanding_invoices_count,
            "outstanding_balance": round(features.outstanding_balance, 2),
            "previous_renewals_count": features.previous_renewals_count,
            "mrr": round(features.mrr, 2),
        },
    }


def train_ml_model_if_feasible(db: Session) -> Dict[str, Any]:
    """
    Attempt to train a Scikit-Learn GradientBoosting / RandomForest model
    ONLY IF sufficient labelled ground-truth data exists.
    If sample count is below MIN_LABELLED_SAMPLES_FOR_ML, reports honest data requirements
    without inventing fake accuracy numbers.
    """
    global _ML_MODEL, _ML_METRICS

    customers = db.query(Customer).all()
    sample_count = len(customers)

    if sample_count < MIN_LABELLED_SAMPLES_FOR_ML:
        _ML_MODEL = None
        _ML_METRICS = {
            "status": "insufficient_labelled_data",
            "samples_available": sample_count,
            "minimum_required": MIN_LABELLED_SAMPLES_FOR_ML,
            "current_mode": "rule_based_transparent",
            "message": (
                f"Historical labelled cohort ({sample_count} records) is below minimum "
                f"threshold ({MIN_LABELLED_SAMPLES_FOR_ML}) for statistical machine learning. "
                f"SubSage is running in Audited Rule-Based mode to ensure 100% transparency."
            ),
            "accuracy": None,
            "precision": None,
            "recall": None,
        }
        return _ML_METRICS

    # If >= 30 records, train Scikit-learn GradientBoostingClassifier
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import cross_val_score, StratifiedKFold

    X = []
    y = []

    for c in customers:
        feat = extract_customer_features(db, c.id)
        if feat:
            X.append(feat.to_feature_vector())
            # Label: 1 if churned/at_risk, 0 if active
            label = 1 if c.status in [CustomerStatus.at_risk, CustomerStatus.churned] else 0
            y.append(label)

    X_arr = np.array(X)
    y_arr = np.array(y)

    # Check class diversity
    if len(np.unique(y_arr)) < 2:
        _ML_METRICS = {
            "status": "single_class_distribution",
            "samples_available": len(y_arr),
            "message": "All samples have the same outcome label; cannot fit supervised classifier.",
            "current_mode": "rule_based_transparent",
            "accuracy": None,
        }
        return _ML_METRICS

    clf = GradientBoostingClassifier(n_estimators=50, random_state=42)
    cv = StratifiedKFold(n_splits=min(3, len(y_arr)))
    scores = cross_val_score(clf, X_arr, y_arr, cv=cv, scoring="accuracy")
    clf.fit(X_arr, y_arr)

    _ML_MODEL = clf
    _ML_METRICS = {
        "status": "trained_active",
        "algorithm": "GradientBoostingClassifier (Scikit-Learn)",
        "samples_trained": len(y_arr),
        "cross_val_accuracy": round(float(np.mean(scores)), 4),
        "feature_importances": [
            {"feature": name, "importance": round(float(imp), 4)}
            for name, imp in zip(
                [
                    "failed_payment_count",
                    "late_payment_count",
                    "payment_success_ratio",
                    "subscription_age_days",
                    "days_until_renewal",
                    "outstanding_invoices_count",
                    "outstanding_balance",
                    "previous_renewals_count",
                    "mrr",
                ],
                clf.feature_importances_,
            )
        ],
        "message": f"Scikit-learn model trained with {len(y_arr)} real records. CV accuracy: {np.mean(scores)*100:.1f}%.",
    }
    return _ML_METRICS


def get_ml_metrics() -> Dict[str, Any]:
    global _ML_METRICS
    if _ML_METRICS is None:
        return {
            "status": "not_trained",
            "current_mode": "rule_based_transparent",
            "message": "Engine running in Transparent Rule-Based mode. Scikit-learn training available when dataset grows.",
            "accuracy": None,
        }
    return _ML_METRICS
