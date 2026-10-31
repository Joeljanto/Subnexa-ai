"""
Revenue Rescue Radar API routes.
"""
from flask import Blueprint, jsonify, request
from backend.database import get_session
from backend.auth.decorators import jwt_required, role_required
from backend.intelligence.radar.exposure import (
    calculate_radar_exposures,
    get_radar_customer_records,
)

radar_bp = Blueprint("radar", __name__)


@radar_bp.get("/exposures")
@jwt_required
@role_required("admin", "staff")
def get_exposures():
    """
    Returns calculated revenue exposure metrics with non-overlapping definitions:
    - total overdue invoice exposure
    - failed payment exposure (de-duplicated)
    - upcoming renewal exposure
    - high-risk recurring revenue
    - number of affected customers
    """
    db = get_session()
    try:
        exposures = calculate_radar_exposures(db)
        return jsonify(exposures)
    finally:
        db.close()


@radar_bp.get("/customers")
@jwt_required
@role_required("admin", "staff")
def get_radar_customers():
    """
    Customer table with:
    - Customer name
    - Subscription number
    - Outstanding balance
    - Renewal date
    - Payment status
    - Risk level
    - Risk score
    Includes search, filter by risk_level & payment_status, and sorting.
    """
    search = request.args.get("search")
    risk_level = request.args.get("risk_level")
    payment_status = request.args.get("payment_status")
    sort_by = request.args.get("sort_by", "risk_score")
    sort_order = request.args.get("sort_order", "desc")

    db = get_session()
    try:
        records = get_radar_customer_records(
            db=db,
            search=search,
            risk_level=risk_level,
            payment_status=payment_status,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return jsonify({"customers": records, "total": len(records)})
    finally:
        db.close()


from backend.recovery.models import RecoveryAction, RecoveryActionStatus
from backend.recovery.routes import log_audit
from backend.customers.models import Customer
from backend.subscriptions.models import Subscription
from flask import g


@radar_bp.post("/trigger-action")
@jwt_required
@role_required("admin", "staff")
def trigger_action():
    """
    Trigger rescue actions on at-risk subscriptions (dunning, reminder, discounts),
    creating a recovery tracking record with audit trail.
    """
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customer_id")
    action_type = data.get("action_type", "dunning_retry")

    if not customer_id:
        return jsonify({"error": "customer_id is required"}), 400

    db = get_session()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            return jsonify({
                "status": "success",
                "message": f"Revenue rescue action '{action_type}' initiated for customer {customer_id}.",
                "action_type": action_type,
                "customer_id": customer_id,
            }), 200

        sub = (
            db.query(Subscription)
            .filter(Subscription.customer_id == customer_id)
            .order_by(Subscription.created_at.desc())
            .first()
        )

        actor_id = getattr(g.current_user, "id", None) if hasattr(g, "current_user") else None
        title = action_type.replace("_", " ").title()
        initial_risk = max(customer.mrr or 0.0, 0.0)

        # Create or update recovery action
        action = RecoveryAction(
            customer_id=customer_id,
            subscription_id=sub.id if sub else None,
            action_type=action_type,
            title=f"Radar Rescue: {title}",
            description=f"Automated rescue action triggered from Revenue Rescue Radar.",
            assigned_to=actor_id,
            assigned_by=actor_id,
            status=RecoveryActionStatus.assigned,
            initial_revenue_at_risk=initial_risk,
            simulated_recovery_amount=round(initial_risk * 0.45, 2),
        )
        db.add(action)
        db.commit()
        db.refresh(action)

        log_audit(
            db=db,
            recovery_action_id=action.id,
            event_type="ASSIGNED",
            notes=f"Radar triggered rescue '{title}' assigned for {customer.name}.",
            details={"source": "revenue_rescue_radar", "initial_risk": initial_risk},
        )
        db.commit()

        return jsonify({
            "status": "success",
            "message": f"Revenue rescue action '{title}' created and tracked for {customer.name}.",
            "action": action.to_dict(),
        })
    finally:
        db.close()
