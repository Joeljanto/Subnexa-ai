"""
Recovery Tracking and Audit Trail API Routes.
Enforces strict rule: only confirmed collected payments count towards actual recovery.
"""
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.auth.decorators import jwt_required, role_required
from backend.recovery.models import (
    RecoveryAction,
    RecoveryActionStatus,
    CustomerResponseStatus,
    RecoveryAuditLog,
)
from backend.customers.models import Customer
from backend.subscriptions.models import Subscription
from backend.payments.models import Payment, PaymentStatus, PaymentMethod

recovery_bp = Blueprint("recovery", __name__)


def log_audit(
    db,
    recovery_action_id: str,
    event_type: str,
    notes: str,
    details: dict = None,
):
    """Helper to append an immutable audit log entry."""
    actor_id = getattr(g.current_user, "id", None) if hasattr(g, "current_user") else None
    actor_email = getattr(g.current_user, "email", "system@subnexa.ai") if hasattr(g, "current_user") else "system@subnexa.ai"

    entry = RecoveryAuditLog(
        recovery_action_id=recovery_action_id,
        actor_id=actor_id,
        actor_email=actor_email,
        event_type=event_type,
        notes=notes,
    )
    if details:
        entry.set_details(details)
    db.add(entry)


@recovery_bp.get("/actions")
@jwt_required
@role_required("admin", "staff")
def list_actions():
    """
    List recovery actions with optional filters: status, customer_id, assigned_to.
    """
    status_filter = request.args.get("status")
    customer_id = request.args.get("customer_id")
    assigned_to = request.args.get("assigned_to")

    db = get_session()
    try:
        query = db.query(RecoveryAction)
        if status_filter and status_filter.lower() != "all":
            query = query.filter(RecoveryAction.status == status_filter.lower())
        if customer_id:
            query = query.filter(RecoveryAction.customer_id == customer_id)
        if assigned_to:
            query = query.filter(RecoveryAction.assigned_to == assigned_to)

        actions = query.order_by(RecoveryAction.created_at.desc()).all()
        return jsonify({"actions": [a.to_dict() for a in actions], "total": len(actions)})
    finally:
        db.close()


@recovery_bp.post("/actions")
@jwt_required
@role_required("admin", "staff")
def create_action():
    """
    Assign a recommended action to an at-risk customer.
    Snapshots initial revenue at risk and simulated recovery.
    """
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customer_id")
    action_type = data.get("action_type", "contact_customer")
    title = data.get("title") or action_type.replace("_", " ").title()
    description = data.get("description", "")
    assigned_to = data.get("assigned_to")
    simulated_recovery = float(data.get("simulated_recovery_amount", 0.0))

    if not customer_id:
        return jsonify({"error": "customer_id is required"}), 400

    db = get_session()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        # Primary subscription
        sub = (
            db.query(Subscription)
            .filter(Subscription.customer_id == customer_id)
            .order_by(Subscription.created_at.desc())
            .first()
        )

        # Snapshot initial revenue at risk
        initial_risk = max(customer.mrr or 0.0, 0.0)

        actor_id = getattr(g.current_user, "id", None) if hasattr(g, "current_user") else None

        action = RecoveryAction(
            customer_id=customer_id,
            subscription_id=sub.id if sub else None,
            action_type=action_type,
            title=title,
            description=description,
            assigned_to=assigned_to or actor_id,
            assigned_by=actor_id,
            status=RecoveryActionStatus.assigned,
            initial_revenue_at_risk=initial_risk,
            simulated_recovery_amount=simulated_recovery or (initial_risk * 0.45),
        )
        db.add(action)
        db.commit()
        db.refresh(action)

        # Log audit entry
        log_audit(
            db=db,
            recovery_action_id=action.id,
            event_type="ASSIGNED",
            notes=f"Action '{title}' assigned to staff for customer {customer.name}.",
            details={"initial_revenue_at_risk": initial_risk, "simulated_recovery": action.simulated_recovery_amount},
        )
        db.commit()

        return jsonify({"message": "Action assigned successfully", "action": action.to_dict()}), 201
    finally:
        db.close()


@recovery_bp.patch("/actions/<string:action_id>/status")
@jwt_required
@role_required("admin", "staff")
def update_status(action_id: str):
    """
    Advance recovery action status (e.g. assigned -> in_progress -> completed / failed).
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    notes = data.get("notes", "")

    if not new_status or new_status not in [s.value for s in RecoveryActionStatus]:
        return jsonify({"error": f"Invalid status: {new_status}"}), 400

    db = get_session()
    try:
        action = db.get(RecoveryAction, action_id)
        if not action:
            return jsonify({"error": "Action not found"}), 404

        old_status = action.status.value
        action.status = RecoveryActionStatus(new_status)
        if new_status == "completed":
            action.completed_at = datetime.now(timezone.utc)

        log_audit(
            db=db,
            recovery_action_id=action.id,
            event_type="STATUS_CHANGED",
            notes=notes or f"Status transitioned from {old_status.upper()} to {new_status.upper()}.",
            details={"previous_status": old_status, "new_status": new_status},
        )
        db.commit()
        db.refresh(action)

        return jsonify({"message": "Status updated successfully", "action": action.to_dict()})
    finally:
        db.close()


@recovery_bp.post("/actions/<string:action_id>/response")
@jwt_required
@role_required("admin", "staff")
def record_response(action_id: str):
    """
    Record customer response and qualitative notes from outreach.
    """
    data = request.get_json(silent=True) or {}
    customer_response = data.get("customer_response")
    notes = data.get("notes", "")

    if not customer_response or customer_response not in [s.value for s in CustomerResponseStatus]:
        return jsonify({"error": f"Invalid customer_response: {customer_response}"}), 400

    db = get_session()
    try:
        action = db.get(RecoveryAction, action_id)
        if not action:
            return jsonify({"error": "Action not found"}), 404

        action.customer_response = CustomerResponseStatus(customer_response)
        action.customer_response_notes = notes
        action.responded_at = datetime.now(timezone.utc)

        # If in assigned status, advance to in_progress
        if action.status == RecoveryActionStatus.assigned:
            action.status = RecoveryActionStatus.in_progress

        log_audit(
            db=db,
            recovery_action_id=action.id,
            event_type="RESPONSE_RECORDED",
            notes=f"Customer response recorded: {customer_response.replace('_', ' ').title()}.",
            details={"customer_response": customer_response, "notes": notes},
        )
        db.commit()
        db.refresh(action)

        return jsonify({"message": "Customer response recorded", "action": action.to_dict()})
    finally:
        db.close()


@recovery_bp.post("/actions/<string:action_id>/record-payment")
@jwt_required
@role_required("admin", "staff")
def record_payment(action_id: str):
    """
    Record actual payment collected.
    STRICT ACCOUNTING RULE:
    Only count confirmed collected payments (is_confirmed_payment == True)
    as actual recovery!
    """
    data = request.get_json(silent=True) or {}
    amount = float(data.get("amount", 0.0))
    is_confirmed = bool(data.get("is_confirmed", True))
    recovery_date_str = data.get("recovery_date")
    intervention_costs = float(data.get("intervention_costs", 0.0))
    notes = data.get("notes", "")

    if amount <= 0:
        return jsonify({"error": "Payment amount must be greater than 0"}), 400

    recovery_date = datetime.fromisoformat(recovery_date_str) if recovery_date_str else datetime.now(timezone.utc)

    db = get_session()
    try:
        action = db.get(RecoveryAction, action_id)
        if not action:
            return jsonify({"error": "Action not found"}), 404

        # If confirmed, record actual payment transaction in payments table for audit consistency
        payment_record = None
        if is_confirmed:
            payment_record = Payment(
                customer_id=action.customer_id,
                subscription_id=action.subscription_id,
                amount=amount,
                currency="USD",
                status=PaymentStatus.succeeded,
                method=PaymentMethod.card,
                description=f"Recovered via action: {action.title}",
                paid_at=recovery_date,
            )
            db.add(payment_record)
            db.commit()
            db.refresh(payment_record)

        action.actual_recovered_amount = amount
        action.is_confirmed_payment = is_confirmed
        action.recovery_date = recovery_date
        action.intervention_costs = intervention_costs
        action.payment_id = payment_record.id if payment_record else None
        if is_confirmed:
            action.status = RecoveryActionStatus.completed
            action.completed_at = recovery_date

        log_audit(
            db=db,
            recovery_action_id=action.id,
            event_type="PAYMENT_COLLECTED",
            notes=f"Actual recovery payment of ${amount:,.2f} recorded (Confirmed: {is_confirmed}). Cost: ${intervention_costs:,.2f}.",
            details={
                "amount": amount,
                "is_confirmed": is_confirmed,
                "intervention_costs": intervention_costs,
                "net_recovery": action.net_recovered_revenue,
                "payment_id": payment_record.id if payment_record else None,
                "notes": notes,
            },
        )
        db.commit()
        db.refresh(action)

        return jsonify({
            "message": "Payment recovery recorded successfully",
            "action": action.to_dict(),
        })
    finally:
        db.close()


@recovery_bp.get("/actions/<string:action_id>/audit")
@jwt_required
@role_required("admin", "staff")
def get_audit_trail(action_id: str):
    """
    Get chronological immutable audit trail for a recovery action.
    """
    db = get_session()
    try:
        logs = (
            db.query(RecoveryAuditLog)
            .filter(RecoveryAuditLog.recovery_action_id == action_id)
            .order_by(RecoveryAuditLog.timestamp.asc())
            .all()
        )
        return jsonify({"audit_trail": [log.to_dict() for log in logs], "total": len(logs)})
    finally:
        db.close()


@recovery_bp.get("/comparison")
@jwt_required
@role_required("admin", "staff")
def get_recovery_comparison():
    """
    Aggregate executive comparison metrics:
    - Initial revenue at risk
    - Simulated recovery
    - Actual collected recovery (ONLY confirmed payments!)
    - Net recovered revenue
    - Realization percentage
    """
    db = get_session()
    try:
        actions = db.query(RecoveryAction).all()

        initial_risk_sum = sum(a.initial_revenue_at_risk for a in actions)
        simulated_recovery_sum = sum(a.simulated_recovery_amount for a in actions)

        # STRICT RULE: only confirmed collected payments count towards actual recovery!
        actual_collected_sum = sum(
            a.actual_recovered_amount for a in actions if a.is_confirmed_payment
        )
        intervention_costs_sum = sum(
            a.intervention_costs for a in actions if a.is_confirmed_payment
        )
        net_recovered_sum = sum(
            a.net_recovered_revenue for a in actions if a.is_confirmed_payment
        )

        realization_rate = (
            round((actual_collected_sum / simulated_recovery_sum) * 100.0, 1)
            if simulated_recovery_sum > 0
            else 0.0
        )

        completed_count = sum(1 for a in actions if a.status == RecoveryActionStatus.completed)
        in_progress_count = sum(1 for a in actions if a.status == RecoveryActionStatus.in_progress)
        assigned_count = sum(1 for a in actions if a.status == RecoveryActionStatus.assigned)

        return jsonify({
            "summary": {
                "initial_revenue_at_risk": round(initial_risk_sum, 2),
                "simulated_recovery": round(simulated_recovery_sum, 2),
                "actual_collected_recovery": round(actual_collected_sum, 2),
                "intervention_costs": round(intervention_costs_sum, 2),
                "net_recovered_revenue": round(net_recovered_sum, 2),
                "realization_rate": realization_rate,
            },
            "counts": {
                "total_actions": len(actions),
                "completed": completed_count,
                "in_progress": in_progress_count,
                "assigned": assigned_count,
            },
            "accounting_rule": "Only confirmed collected payments are credited as actual recovery. Net recovery deducts intervention costs.",
        })
    finally:
        db.close()
