"""Subscription model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Float, Enum, ForeignKey, Integer, Boolean
import enum
from backend.database import Base


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    trialing = "trialing"
    paused = "paused"


class BillingInterval(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"
    quarterly = "quarterly"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    plan_name = Column(String(100), nullable=False)
    plan_tier = Column(String(50), nullable=True)  # starter, pro, enterprise
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    billing_interval = Column(Enum(BillingInterval), default=BillingInterval.monthly)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.active)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "plan_name": self.plan_name,
            "plan_tier": self.plan_tier,
            "amount": self.amount,
            "currency": self.currency,
            "billing_interval": self.billing_interval.value if self.billing_interval else None,
            "status": self.status.value if self.status else None,
            "trial_ends_at": self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            "current_period_start": self.current_period_start.isoformat() if self.current_period_start else None,
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
            "canceled_at": self.canceled_at.isoformat() if self.canceled_at else None,
            "cancel_at_period_end": self.cancel_at_period_end,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
