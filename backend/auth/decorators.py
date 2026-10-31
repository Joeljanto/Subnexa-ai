"""
JWT and role-based access decorators for SubNexa AI.
"""
from functools import wraps
import jwt
from flask import request, jsonify, g, current_app
from backend.auth.utils import decode_access_token
from backend.database import get_session
from backend.auth.models import User


def jwt_required(f):
    """
    Decorator that verifies the JWT Bearer token in the Authorization header.
    On success, sets g.current_user to the User ORM object.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        db = get_session()
        try:
            user = db.get(User, payload["sub"])
            if not user or not user.is_active:
                return jsonify({"error": "User not found or deactivated"}), 401
            g.current_user = user
            g.token_payload = payload
        finally:
            db.close()

        return f(*args, **kwargs)

    return decorated


def role_required(*roles):
    """
    Decorator factory that restricts access to users with one of the given roles.
    Must be used AFTER @jwt_required.

    Usage:
        @jwt_required
        @role_required('admin')
        def admin_only_view(): ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user: User = getattr(g, "current_user", None)
            if user is None:
                return jsonify({"error": "Authentication required"}), 401
            if user.role.value not in roles:
                return jsonify(
                    {
                        "error": "Forbidden",
                        "detail": f"Required role(s): {', '.join(roles)}",
                    }
                ), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def customer_self_only(f):
    """
    Decorator that ensures a Customer can only access their own resource.
    Expects <customer_id> or <user_id> in URL kwargs.
    Admins and Staff bypass this check.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user: User = getattr(g, "current_user", None)
        if user is None:
            return jsonify({"error": "Authentication required"}), 401
        # Admins and staff can access any resource
        if user.role.value in ("admin", "staff"):
            return f(*args, **kwargs)
        # Customers may only access their own data
        resource_id = kwargs.get("customer_id") or kwargs.get("user_id")
        if resource_id:
            if str(resource_id) == str(user.id):
                return f(*args, **kwargs)
            # Check Customer record by ID
            from backend.customers.models import Customer
            db = get_session()
            try:
                cust = db.get(Customer, resource_id)
                if not cust or (cust.user_id != user.id and cust.email != user.email):
                    return jsonify({"error": "Forbidden: access to own data only"}), 403
            finally:
                db.close()
        return f(*args, **kwargs)
    return decorated
