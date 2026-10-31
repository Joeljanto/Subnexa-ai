"""Customer model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Float, Enum, ForeignKey, Integer
import enum
from backend.database import Base


class CustomerStatus(str, enum.Enum):
    active = "active"
    at_risk = "at_risk"
    churned = "churned"
    suspended = "suspended"


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    company = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    mrr = Column(Float, default=0.0)  # Monthly Recurring Revenue
    ltv = Column(Float, default=0.0)  # Lifetime Value
    risk_score = Column(Float, default=0.0)  # 0-100
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.low)
    status = Column(Enum(CustomerStatus), default=CustomerStatus.active)
    churn_probability = Column(Float, default=0.0)
    days_since_last_payment = Column(Integer, default=0)
    failed_payments_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "company": self.company,
            "phone": self.phone,
            "mrr": self.mrr,
            "ltv": self.ltv,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level.value if self.risk_level else None,
            "status": self.status.value if self.status else None,
            "churn_probability": self.churn_probability,
            "days_since_last_payment": self.days_since_last_payment,
            "failed_payments_count": self.failed_payments_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
