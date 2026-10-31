"""Payment model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Float, Enum, ForeignKey, Text
import enum
from backend.database import Base


class PaymentStatus(str, enum.Enum):
    succeeded = "succeeded"
    failed = "failed"
    pending = "pending"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    card = "card"
    bank_transfer = "bank_transfer"
    paypal = "paypal"
    crypto = "crypto"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    subscription_id = Column(String(36), ForeignKey("subscriptions.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(Enum(PaymentStatus), nullable=False)
    method = Column(Enum(PaymentMethod), default=PaymentMethod.card)
    description = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "subscription_id": self.subscription_id,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status.value if self.status else None,
            "method": self.method.value if self.method else None,
            "description": self.description,
            "failure_reason": self.failure_reason,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
