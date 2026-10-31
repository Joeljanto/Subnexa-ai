"""Billing/Invoices API routes."""
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.billing.models import Invoice
from backend.auth.decorators import jwt_required, role_required

billing_bp = Blueprint("billing", __name__)


@billing_bp.get("/invoices")
@jwt_required
@role_required("admin", "staff")
def list_invoices():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    status = request.args.get("status")

    db = get_session()
    try:
        query = db.query(Invoice)
        if status:
            query = query.filter(Invoice.status == status)
        total = query.count()
        invoices = (
            query.order_by(Invoice.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return jsonify({
            "invoices": [i.to_dict() for i in invoices],
            "total": total,
            "page": page,
            "per_page": per_page,
        })
    finally:
        db.close()


from backend.auth.decorators import jwt_required, role_required, customer_self_only


@billing_bp.get("/invoices/customer/<string:customer_id>")
@jwt_required
@customer_self_only
def get_customer_invoices(customer_id: str):
    db = get_session()
    try:
        invoices = (
            db.query(Invoice)
            .filter_by(customer_id=customer_id)
            .order_by(Invoice.created_at.desc())
            .all()
        )
        return jsonify({"invoices": [i.to_dict() for i in invoices]})
    finally:
        db.close()
