"""
Seed initial demo data for SubNexa AI:
- Default Admin account
- Sample Customers with risk scores and ML churn indicators
- Subscriptions and Payments
- Invoices
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from backend.database import init_db, get_session
from backend.auth.models import User, UserRole
from backend.auth.utils import hash_password
from backend.customers.models import Customer, RiskLevel, CustomerStatus
from backend.subscriptions.models import Subscription, SubscriptionStatus, BillingInterval
from backend.payments.models import Payment, PaymentStatus, PaymentMethod
from backend.billing.models import Invoice, InvoiceStatus


def seed_data():
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin@1234")
    staff_password = os.getenv("SEED_STAFF_PASSWORD", "Staff@1234")
    init_db()
    db = get_session()
    try:
        # Check if admin already exists
        admin = db.query(User).filter_by(email="admin@subnexa.ai").first()
        if not admin:
            admin = User(
                email="admin@subnexa.ai",
                password_hash=hash_password(admin_password),
                role=UserRole.admin,
                first_name="Alex",
                last_name="Vance",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            print("Created seeded admin account: admin@subnexa.ai")

        # Check if staff already exists
        staff = db.query(User).filter_by(email="staff@subnexa.ai").first()
        if not staff:
            staff = User(
                email="staff@subnexa.ai",
                password_hash=hash_password(staff_password),
                role=UserRole.staff,
                first_name="Sarah",
                last_name="Connor",
                is_active=True,
                is_verified=True,
            )
            db.add(staff)
            print("Created seeded staff account: staff@subnexa.ai")

        # Check if customers exist
        if db.query(Customer).count() == 0:
            now = datetime.now(timezone.utc)
            sample_customers = [
                {
                    "name": "Acme Cloud Corp",
                    "email": "billing@acmecloud.io",
                    "company": "Acme Cloud",
                    "mrr": 4200.0,
                    "ltv": 54000.0,
                    "risk_score": 88.5,
                    "risk_level": RiskLevel.critical,
                    "status": CustomerStatus.at_risk,
                    "churn_prob": 0.82,
                    "days_since_payment": 42,
                    "failed_count": 3,
                },
                {
                    "name": "HyperScale Dynamics",
                    "email": "finance@hyperscale.tech",
                    "company": "HyperScale",
                    "mrr": 8900.0,
                    "ltv": 115000.0,
                    "risk_score": 79.2,
                    "risk_level": RiskLevel.high,
                    "status": CustomerStatus.at_risk,
                    "churn_prob": 0.74,
                    "days_since_payment": 35,
                    "failed_count": 2,
                },
                {
                    "name": "NovaPulse Media",
                    "email": "ops@novapulse.io",
                    "company": "NovaPulse",
                    "mrr": 2300.0,
                    "ltv": 27600.0,
                    "risk_score": 74.0,
                    "risk_level": RiskLevel.high,
                    "status": CustomerStatus.at_risk,
                    "churn_prob": 0.68,
                    "days_since_payment": 28,
                    "failed_count": 1,
                },
                {
                    "name": "QuantumByte Labs",
                    "email": "admin@quantumbyte.ai",
                    "company": "QuantumByte",
                    "mrr": 6500.0,
                    "ltv": 78000.0,
                    "risk_score": 48.0,
                    "risk_level": RiskLevel.medium,
                    "status": CustomerStatus.active,
                    "churn_prob": 0.35,
                    "days_since_payment": 12,
                    "failed_count": 0,
                },
                {
                    "name": "Vortex Flow Inc",
                    "email": "accounting@vortexflow.com",
                    "company": "Vortex Flow",
                    "mrr": 3100.0,
                    "ltv": 37200.0,
                    "risk_score": 38.0,
                    "risk_level": RiskLevel.medium,
                    "status": CustomerStatus.active,
                    "churn_prob": 0.28,
                    "days_since_payment": 9,
                    "failed_count": 0,
                },
                {
                    "name": "StrataSync Systems",
                    "email": "hello@stratasync.co",
                    "company": "StrataSync",
                    "mrr": 5200.0,
                    "ltv": 62400.0,
                    "risk_score": 15.0,
                    "risk_level": RiskLevel.low,
                    "status": CustomerStatus.active,
                    "churn_prob": 0.08,
                    "days_since_payment": 3,
                    "failed_count": 0,
                },
                {
                    "name": "Apex Logic Software",
                    "email": "billing@apexlogic.net",
                    "company": "Apex Logic",
                    "mrr": 9400.0,
                    "ltv": 132000.0,
                    "risk_score": 12.0,
                    "risk_level": RiskLevel.low,
                    "status": CustomerStatus.active,
                    "churn_prob": 0.05,
                    "days_since_payment": 2,
                    "failed_count": 0,
                },
            ]

            created_customers = []
            for sc in sample_customers:
                cust = Customer(
                    name=sc["name"],
                    email=sc["email"],
                    company=sc["company"],
                    mrr=sc["mrr"],
                    ltv=sc["ltv"],
                    risk_score=sc["risk_score"],
                    risk_level=sc["risk_level"],
                    status=sc["status"],
                    churn_probability=sc["churn_prob"],
                    days_since_last_payment=sc["days_since_payment"],
                    failed_payments_count=sc["failed_count"],
                    created_at=now - timedelta(days=120),
                )
                db.add(cust)
                created_customers.append((cust, sc))

            db.commit()

            # Create subscriptions, payments, and invoices
            for cust, sc in created_customers:
                db.refresh(cust)
                sub = Subscription(
                    customer_id=cust.id,
                    plan_name="Enterprise Shield" if sc["mrr"] > 5000 else "Growth Pro",
                    plan_tier="enterprise" if sc["mrr"] > 5000 else "pro",
                    amount=sc["mrr"],
                    currency="USD",
                    billing_interval=BillingInterval.monthly,
                    status=SubscriptionStatus.past_due if sc["failed_count"] > 0 else SubscriptionStatus.active,
                    current_period_start=now - timedelta(days=30),
                    current_period_end=now + timedelta(days=30),
                    created_at=now - timedelta(days=90),
                )
                db.add(sub)
                db.commit()
                db.refresh(sub)

                # Generate 3 historical payments (past months)
                for month_offset in [90, 60, 30]:
                    payment_date = now - timedelta(days=month_offset)
                    # For the most recent month if failed_count > 0, make it failed
                    is_failed = (month_offset == 30 and sc["failed_count"] > 0)
                    payment = Payment(
                        customer_id=cust.id,
                        subscription_id=sub.id,
                        amount=sc["mrr"],
                        currency="USD",
                        status=PaymentStatus.failed if is_failed else PaymentStatus.succeeded,
                        method=PaymentMethod.card,
                        description=f"Monthly subscription - {sub.plan_name}",
                        failure_reason="Card expired or insufficient funds" if is_failed else None,
                        paid_at=None if is_failed else payment_date,
                        created_at=payment_date,
                    )
                    db.add(payment)

                    inv = Invoice(
                        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                        customer_id=cust.id,
                        subscription_id=sub.id,
                        amount_due=sc["mrr"],
                        amount_paid=0.0 if is_failed else sc["mrr"],
                        currency="USD",
                        status=InvoiceStatus.open if is_failed else InvoiceStatus.paid,
                        description=f"Subscription invoice for {sub.plan_name}",
                        due_date=payment_date + timedelta(days=14),
                        paid_at=None if is_failed else payment_date,
                        attempt_count=sc["failed_count"] if is_failed else 1,
                        created_at=payment_date,
                    )
                    db.add(inv)

            db.commit()
            print("Sample customers, subscriptions, payments, and invoices created successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
