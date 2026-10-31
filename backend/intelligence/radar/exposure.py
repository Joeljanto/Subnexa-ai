"""
SubSage Intelligence – Revenue Rescue Radar Exposure Engine.

Methodology for Revenue Exposure Calculations (Non-Overlapping):
---------------------------------------------------------------
1. Overdue Invoice Exposure:
   The total unpaid balance (amount_due - amount_paid) on open or uncollectible
   invoices whose due date has passed.

2. Failed Payment Exposure (De-duplicated):
   Failed payments within the last 35 days that are NOT linked to an invoice
   already counted in the Overdue Invoice Exposure. This avoids double-counting
   when a failed payment attempt corresponds to an already overdue invoice.

3. Upcoming Renewal Exposure:
   The contractual value of subscriptions renewing in the next 30 days that belong
   to customers evaluated at High or Critical churn risk, for which no overdue invoice
   has already been issued for that cycle.

4. High-Risk Recurring Revenue:
   The aggregate Monthly Recurring Revenue (MRR) for all customers flagged as
   High or Critical risk.

5. Total Net At-Risk Revenue (De-duplicated Combined Exposure):
   Sum of Overdue Invoices + De-duplicated Failed Payments + Upcoming Renewal Exposure.
   Guarantees no single financial amount is counted twice across historical unpaid
   balances, transaction failures, and forward renewal risk.

6. Number of Affected Customers:
   The count of unique customers facing at least one revenue loss vector.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc

from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus
from backend.payments.models import Payment, PaymentStatus
from backend.billing.models import Invoice, InvoiceStatus


def calculate_radar_exposures(db: Session, as_of: Optional[datetime] = None) -> Dict[str, Any]:
    now = as_of or datetime.now(timezone.utc)
    thirty_days_future = now + timedelta(days=30)
    thirty_five_days_ago = now - timedelta(days=35)

    affected_customer_ids = set()

    # 1. Total Overdue Invoice Exposure
    # Invoices where due_date < now, status in (open, uncollectible), and amount_due > amount_paid
    overdue_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status.in_([InvoiceStatus.open, InvoiceStatus.uncollectible]),
            Invoice.due_date < now,
            Invoice.amount_due > Invoice.amount_paid,
        )
        .all()
    )

    overdue_invoice_exposure = sum(
        max(0.0, inv.amount_due - (inv.amount_paid or 0.0)) for inv in overdue_invoices
    )

    overdue_invoice_ids = {inv.id for inv in overdue_invoices}
    overdue_sub_ids = {inv.subscription_id for inv in overdue_invoices if inv.subscription_id}
    for inv in overdue_invoices:
        affected_customer_ids.add(inv.customer_id)

    # 2. Failed Payment Exposure (De-duplicated)
    # Payments failed recently. If a payment was for a subscription that already has an overdue invoice,
    # or corresponds directly to that overdue liability, we do NOT count it again.
    recent_failed_payments = (
        db.query(Payment)
        .filter(
            Payment.status == PaymentStatus.failed,
            Payment.created_at >= thirty_five_days_ago,
        )
        .all()
    )

    # We match failed payments to subscriptions with overdue invoices to prevent double counting
    failed_payment_exposure = 0.0
    for p in recent_failed_payments:
        affected_customer_ids.add(p.customer_id)
        # If this subscription already has an overdue invoice counted above, do not double-count
        if p.subscription_id and p.subscription_id in overdue_sub_ids:
            continue
        failed_payment_exposure += p.amount

    # 3. Upcoming Renewal Exposure (Next 30 days for High & Critical risk)
    high_critical_customers = (
        db.query(Customer)
        .filter(Customer.risk_level.in_([RiskLevel.high, RiskLevel.critical]))
        .all()
    )
    high_critical_cust_ids = {c.id for c in high_critical_customers}

    upcoming_renewals = (
        db.query(Subscription)
        .filter(
            Subscription.customer_id.in_(high_critical_cust_ids),
            Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.past_due]),
            Subscription.current_period_end >= now,
            Subscription.current_period_end <= thirty_days_future,
        )
        .all()
    )

    upcoming_renewal_exposure = 0.0
    for sub in upcoming_renewals:
        # Avoid double-counting if the period is already uncollected and counted in overdue invoice
        if sub.id in overdue_sub_ids:
            continue
        upcoming_renewal_exposure += sub.amount
        affected_customer_ids.add(sub.customer_id)

    # 4. High-Risk Recurring Revenue (Net At-Risk MRR)
    # Sum of MRR for high & critical risk customers
    high_risk_recurring_revenue = sum(c.mrr for c in high_critical_customers)
    for c in high_critical_customers:
        affected_customer_ids.add(c.id)

    # 5. Combined De-duplicated Total Net Exposure
    # Overdue invoice debt + non-overlapping failed attempts + upcoming renewals at risk
    total_net_exposure = (
        overdue_invoice_exposure
        + failed_payment_exposure
        + upcoming_renewal_exposure
    )

    return {
        "overdue_invoice_exposure": round(overdue_invoice_exposure, 2),
        "failed_payment_exposure": round(failed_payment_exposure, 2),
        "upcoming_renewal_exposure": round(upcoming_renewal_exposure, 2),
        "high_risk_recurring_revenue": round(high_risk_recurring_revenue, 2),
        "total_net_exposure": round(total_net_exposure, 2),
        "affected_customers_count": len(affected_customer_ids),
        "calculation_rules": {
            "overdue_invoice": "Unpaid balance on invoices with due_date in the past",
            "failed_payment": "Recent payment failures excluding invoices already counted in overdue exposure",
            "upcoming_renewal": "Subscriptions renewing in next 30 days for High/Critical risk accounts without overdue invoice overlap",
            "high_risk_mrr": "Sum of MRR across all High & Critical risk accounts",
            "total_net_exposure": "De-duplicated sum (Overdue Invoices + Non-overlapping Failed Payments + Upcoming High-Risk Renewals)",
        },
    }


def get_radar_customer_records(
    db: Session,
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    payment_status: Optional[str] = None,
    sort_by: str = "risk_score",
    sort_order: str = "desc",
) -> List[Dict[str, Any]]:
    """
    Fetch comprehensive customer & subscription radar records with:
    - Customer name
    - Subscription number
    - Outstanding balance
    - Renewal date
    - Payment status
    - Risk level
    - Risk score
    """
    now = datetime.now(timezone.utc)

    # Join Customer and primary Subscription
    query = (
        db.query(Customer, Subscription)
        .outerjoin(Subscription, Subscription.customer_id == Customer.id)
    )

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(search_pattern),
                Customer.email.ilike(search_pattern),
                Customer.company.ilike(search_pattern),
                Subscription.plan_name.ilike(search_pattern),
            )
        )

    if risk_level and risk_level.lower() != "all":
        query = query.filter(Customer.risk_level == risk_level.lower())

    results = query.all()

    # Pre-fetch invoices and recent payments to calculate outstanding balances
    records = []
    for customer, sub in results:
        # Calculate outstanding balance for this customer
        cust_invoices = (
            db.query(Invoice)
            .filter(
                Invoice.customer_id == customer.id,
                Invoice.status.in_([InvoiceStatus.open, InvoiceStatus.uncollectible]),
            )
            .all()
        )
        outstanding_balance = sum(
            max(0.0, inv.amount_due - (inv.amount_paid or 0.0)) for inv in cust_invoices
        )

        # Most recent payment for this customer
        last_payment = (
            db.query(Payment)
            .filter(Payment.customer_id == customer.id)
            .order_by(Payment.created_at.desc())
            .first()
        )

        # Determine effective payment status
        if last_payment and last_payment.status == PaymentStatus.failed:
            display_payment_status = "failed"
        elif sub and sub.status == SubscriptionStatus.past_due:
            display_payment_status = "past_due"
        elif outstanding_balance > 0:
            display_payment_status = "unpaid"
        elif sub:
            display_payment_status = sub.status.value
        else:
            display_payment_status = customer.status.value

        if payment_status and payment_status.lower() != "all":
            if display_payment_status.lower() != payment_status.lower():
                continue

        # Format subscription number
        if sub:
            sub_number = f"SUB-{sub.id[:8].upper()}"
            renewal_date = sub.current_period_end.isoformat() if sub.current_period_end else None
            plan_name = sub.plan_name
            sub_id = sub.id
        else:
            sub_number = "N/A"
            renewal_date = None
            plan_name = "None"
            sub_id = None

        # Evaluate explainable risk metrics
        from backend.intelligence.risk_engine.engine import (
            extract_customer_features,
            evaluate_explainable_risk,
        )
        feat = extract_customer_features(db, customer.id)
        if feat:
            risk_eval = evaluate_explainable_risk(feat)
            calculated_risk_score = max(round(customer.risk_score or 0.0, 1), risk_eval["overall_risk_score"])
            if calculated_risk_score >= 80:
                calculated_risk_level = "critical"
            elif calculated_risk_score >= 65:
                calculated_risk_level = "high"
            elif calculated_risk_score >= 35:
                calculated_risk_level = "medium"
            else:
                calculated_risk_level = "low"
            payment_risk_score = risk_eval["payment_risk"]["score"]
            churn_risk_score = risk_eval["churn_risk"]["score"]
            contributing_factors = risk_eval["contributing_factors"]
            recommended_actions = risk_eval["recommended_actions"]
            engine_mode = risk_eval["engine_mode"]
        else:
            calculated_risk_score = round(customer.risk_score, 1)
            calculated_risk_level = customer.risk_level.value if customer.risk_level else "low"
            payment_risk_score = calculated_risk_score
            churn_risk_score = calculated_risk_score
            contributing_factors = []
            recommended_actions = []
            engine_mode = "rule_based_transparent"

        # Query active recovery tracking action
        from backend.recovery.models import RecoveryAction
        latest_action = (
            db.query(RecoveryAction)
            .filter(RecoveryAction.customer_id == customer.id)
            .order_by(RecoveryAction.created_at.desc())
            .first()
        )
        recovery_tracking = {
            "has_active_action": latest_action is not None,
            "action_id": latest_action.id if latest_action else None,
            "action_title": latest_action.title if latest_action else None,
            "action_status": latest_action.status.value if latest_action else "unassigned",
            "assigned_to": latest_action.assigned_to if latest_action else None,
            "customer_response": latest_action.customer_response.value if latest_action else "none",
            "is_confirmed_payment": latest_action.is_confirmed_payment if latest_action else False,
            "actual_recovered_amount": latest_action.actual_recovered_amount if latest_action else 0.0,
            "net_recovered_revenue": latest_action.net_recovered_revenue if latest_action else 0.0,
        }

        records.append({
            "id": customer.id,
            "customer_name": customer.name,
            "email": customer.email,
            "company": customer.company,
            "subscription_id": sub_id,
            "subscription_number": sub_number,
            "plan_name": plan_name,
            "mrr": customer.mrr,
            "outstanding_balance": round(outstanding_balance, 2),
            "renewal_date": renewal_date,
            "payment_status": display_payment_status,
            "risk_level": calculated_risk_level,
            "risk_score": calculated_risk_score,
            "payment_risk_score": payment_risk_score,
            "churn_risk_score": churn_risk_score,
            "churn_probability": round(churn_risk_score / 100.0, 2),
            "days_since_last_payment": customer.days_since_last_payment,
            "failed_payments_count": customer.failed_payments_count,
            "contributing_factors": contributing_factors,
            "recommended_actions": recommended_actions,
            "engine_mode": engine_mode,
            "recovery_tracking": recovery_tracking,
        })

    # Sort in python for flexibility across joined/calculated fields
    reverse = sort_order.lower() == "desc"
    if sort_by == "risk_score":
        records.sort(key=lambda x: x["risk_score"], reverse=reverse)
    elif sort_by == "outstanding_balance":
        records.sort(key=lambda x: x["outstanding_balance"], reverse=reverse)
    elif sort_by == "customer_name":
        records.sort(key=lambda x: x["customer_name"].lower(), reverse=reverse)
    elif sort_by == "renewal_date":
        records.sort(key=lambda x: x["renewal_date"] or "", reverse=reverse)
    elif sort_by == "mrr":
        records.sort(key=lambda x: x["mrr"], reverse=reverse)
    else:
        records.sort(key=lambda x: x["risk_score"], reverse=reverse)

    return records
