"""
SubNexa AI – Flask Application Entry Point
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env before anything else
load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Configuration ────────────────────────────────────────────
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["DATABASE_URL"] = os.getenv("DATABASE_URL", "sqlite:///subnexa.db")
    app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "dev-jwt-secret-change-me")
    app.config["JWT_ALGORITHM"] = os.getenv("JWT_ALGORITHM", "HS256")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 3600)
    )
    app.config["GOOGLE_CLIENT_ID"] = os.getenv("GOOGLE_CLIENT_ID", "")

    # Mail config (for password reset)
    app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"] = bool(int(os.getenv("MAIL_USE_TLS", 1)))
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv(
        "MAIL_DEFAULT_SENDER", "noreply@subnexa.ai"
    )

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    allowed_origins = list(set([
        frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]))
    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    # ── Database ─────────────────────────────────────────────────
    from backend.database import init_db
    with app.app_context():
        init_db(app.config["DATABASE_URL"])

    # ── Blueprints ───────────────────────────────────────────────
    from backend.auth.routes import auth_bp
    from backend.customers.routes import customers_bp
    from backend.subscriptions.routes import subscriptions_bp
    from backend.payments.routes import payments_bp
    from backend.billing.routes import billing_bp
    from backend.intelligence.routes import intelligence_bp
    from backend.intelligence.radar.routes import radar_bp
    from backend.intelligence.simulator.routes import simulator_bp
    from backend.recovery.routes import recovery_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(customers_bp, url_prefix="/api/customers")
    app.register_blueprint(subscriptions_bp, url_prefix="/api/subscriptions")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(billing_bp, url_prefix="/api/billing")
    app.register_blueprint(intelligence_bp, url_prefix="/api/intelligence")
    app.register_blueprint(radar_bp, url_prefix="/api/radar")
    app.register_blueprint(simulator_bp, url_prefix="/api/simulator")
    app.register_blueprint(recovery_bp, url_prefix="/api/recovery")

    # ── Health Endpoint ───────────────────────────────────────────
    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "SubNexa AI",
                "tagline": "The Revenue Rescue Platform",
                "engine": "SubSage Intelligence",
                "version": "1.0.0",
            }
        )

    # ── Error Handlers ────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True, use_reloader=False)
