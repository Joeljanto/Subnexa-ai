"""Payments API routes."""
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.payments.models import Payment
from backend.auth.decorators import jwt_required, role_required

payments_bp = Blueprint("payments", __name__)


@payments_bp.get("/")
@jwt_required
@role_required("admin", "staff")
def list_payments():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    status = request.args.get("status")

    db = get_session()
    try:
        query = db.query(Payment)
        if status:
            query = query.filter(Payment.status == status)
        total = query.count()
        payments = (
            query.order_by(Payment.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return jsonify({
            "payments": [p.to_dict() for p in payments],
            "total": total,
            "page": page,
            "per_page": per_page,
        })
    finally:
        db.close()


@payments_bp.get("/recent")
@jwt_required
@role_required("admin", "staff")
def recent_payments():
    """Latest 10 payments for dashboard feed."""
    db = get_session()
    try:
        payments = (
            db.query(Payment)
            .order_by(Payment.created_at.desc())
            .limit(10)
            .all()
        )
        return jsonify({"payments": [p.to_dict() for p in payments]})
    finally:
        db.close()


from backend.auth.decorators import jwt_required, role_required, customer_self_only


@payments_bp.get("/customer/<string:customer_id>")
@jwt_required
@customer_self_only
def get_customer_payments(customer_id: str):
    db = get_session()
    try:
        payments = (
            db.query(Payment)
            .filter_by(customer_id=customer_id)
            .order_by(Payment.created_at.desc())
            .all()
        )
        return jsonify({"payments": [p.to_dict() for p in payments]})
    finally:
        db.close()
