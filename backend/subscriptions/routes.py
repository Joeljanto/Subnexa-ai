"""Subscriptions API routes."""
from flask import Blueprint, jsonify, request, g
from backend.database import get_session
from backend.subscriptions.models import Subscription
from backend.auth.decorators import jwt_required, role_required

subscriptions_bp = Blueprint("subscriptions", __name__)


@subscriptions_bp.get("/")
@jwt_required
@role_required("admin", "staff")
def list_subscriptions():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    status = request.args.get("status")

    db = get_session()
    try:
        query = db.query(Subscription)
        if status:
            query = query.filter(Subscription.status == status)
        total = query.count()
        subs = query.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            "subscriptions": [s.to_dict() for s in subs],
            "total": total,
            "page": page,
            "per_page": per_page,
        })
    finally:
        db.close()


@subscriptions_bp.get("/<string:subscription_id>")
@jwt_required
@role_required("admin", "staff")
def get_subscription(subscription_id: str):
    db = get_session()
    try:
        sub = db.get(Subscription, subscription_id)
        if not sub:
            return jsonify({"error": "Subscription not found"}), 404
        return jsonify(sub.to_dict())
    finally:
        db.close()


from backend.auth.decorators import jwt_required, role_required, customer_self_only


@subscriptions_bp.get("/customer/<string:customer_id>")
@jwt_required
@customer_self_only
def get_customer_subscriptions(customer_id: str):
    db = get_session()
    try:
        subs = db.query(Subscription).filter_by(customer_id=customer_id).all()
        return jsonify({"subscriptions": [s.to_dict() for s in subs]})
    finally:
        db.close()
