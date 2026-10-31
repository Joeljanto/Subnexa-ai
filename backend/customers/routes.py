"""Customers API routes."""
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.customers.models import Customer
from backend.auth.decorators import jwt_required, role_required, customer_self_only

customers_bp = Blueprint("customers", __name__)


@customers_bp.get("/")
@jwt_required
@role_required("admin", "staff")
def list_customers():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    status = request.args.get("status")
    risk_level = request.args.get("risk_level")

    db = get_session()
    try:
        query = db.query(Customer)
        if status:
            query = query.filter(Customer.status == status)
        if risk_level:
            query = query.filter(Customer.risk_level == risk_level)
        total = query.count()
        customers = query.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            "customers": [c.to_dict() for c in customers],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        })
    finally:
        db.close()


@customers_bp.get("/risk")
@jwt_required
@role_required("admin", "staff")
def customers_risk_table():
    """Return customers sorted by risk score descending for the dashboard table."""
    db = get_session()
    try:
        customers = (
            db.query(Customer)
            .order_by(Customer.risk_score.desc())
            .limit(50)
            .all()
        )
        return jsonify({"customers": [c.to_dict() for c in customers]})
    finally:
        db.close()


@customers_bp.get("/<string:customer_id>")
@jwt_required
@customer_self_only
def get_customer(customer_id: str):
    db = get_session()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            return jsonify({"error": "Customer not found"}), 404
        return jsonify(customer.to_dict())
    finally:
        db.close()


@customers_bp.get("/me")
@jwt_required
def get_my_profile():
    """Customers can access their own profile via this endpoint."""
    db = get_session()
    try:
        customer = db.query(Customer).filter_by(user_id=g.current_user.id).first()
        if not customer:
            return jsonify({"error": "Customer profile not found"}), 404
        return jsonify(customer.to_dict())
    finally:
        db.close()
