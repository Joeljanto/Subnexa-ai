"""
Recovery Tracking and Audit Models.
Enforces strict accounting rules: only confirmed collected payments count towards actual recovery.
"""
import uuid
import enum
import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Float,
    Enum,
    ForeignKey,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship
from backend.database import Base


class RecoveryActionStatus(str, enum.Enum):
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class CustomerResponseStatus(str, enum.Enum):
    unresponsive = "unresponsive"
    promised_to_pay = "promised_to_pay"
    paid_in_full = "paid_in_full"
    requested_discount = "requested_discount"
    updated_payment_method = "updated_payment_method"
    disputed = "disputed"
    declined = "declined"
    other = "other"


class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    subscription_id = Column(String(36), ForeignKey("subscriptions.id"), nullable=True)
    action_type = Column(String(100), nullable=False)  # e.g., 'resolve_payment_failure', 'contact_customer'
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Workflow & Assignment
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True)
    assigned_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(Enum(RecoveryActionStatus), default=RecoveryActionStatus.assigned, nullable=False, index=True)

    # Customer Response
    customer_response = Column(Enum(CustomerResponseStatus), default=CustomerResponseStatus.unresponsive)
    customer_response_notes = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Financial Exposure & Comparison Metrics
    initial_revenue_at_risk = Column(Float, default=0.0, nullable=False)
    simulated_recovery_amount = Column(Float, default=0.0, nullable=False)

    # Actual Confirmed Accounting: ONLY confirmed payments count as actual recovery!
    actual_recovered_amount = Column(Float, default=0.0, nullable=False)
    is_confirmed_payment = Column(Boolean, default=False, nullable=False)
    payment_id = Column(String(36), ForeignKey("payments.id"), nullable=True)
    recovery_date = Column(DateTime(timezone=True), nullable=True)

    # Intervention Costs (e.g. Labor or Discount granted)
    intervention_costs = Column(Float, default=0.0, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer = relationship("Customer", backref="recovery_actions")
    subscription = relationship("Subscription", backref="recovery_actions")
    audit_logs = relationship("RecoveryAuditLog", back_populates="recovery_action", cascade="all, delete-orphan", order_by="RecoveryAuditLog.timestamp.desc()")

    @property
    def net_recovered_revenue(self) -> float:
        """Net recovery = actual collected (if confirmed) minus intervention costs."""
        if not self.is_confirmed_payment:
            return 0.0
        return max(0.0, self.actual_recovered_amount - self.intervention_costs)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "customer_name": self.customer.name if self.customer else "Unknown",
            "customer_email": self.customer.email if self.customer else None,
            "customer_company": self.customer.company if self.customer else None,
            "subscription_id": self.subscription_id,
            "action_type": self.action_type,
            "title": self.title,
            "description": self.description,
            "assigned_to": self.assigned_to,
            "assigned_by": self.assigned_by,
            "status": self.status.value,
            "customer_response": self.customer_response.value if self.customer_response else "unresponsive",
            "customer_response_notes": self.customer_response_notes,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "initial_revenue_at_risk": round(self.initial_revenue_at_risk, 2),
            "simulated_recovery_amount": round(self.simulated_recovery_amount, 2),
            "actual_recovered_amount": round(self.actual_recovered_amount, 2),
            "is_confirmed_payment": self.is_confirmed_payment,
            "payment_id": self.payment_id,
            "recovery_date": self.recovery_date.isoformat() if self.recovery_date else None,
            "intervention_costs": round(self.intervention_costs, 2),
            "net_recovered_revenue": round(self.net_recovered_revenue, 2),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class RecoveryAuditLog(Base):
    __tablename__ = "recovery_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recovery_action_id = Column(String(36), ForeignKey("recovery_actions.id"), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    actor_email = Column(String(255), nullable=True)
    event_type = Column(String(50), nullable=False)  # ASSIGNED, STATUS_CHANGE, RESPONSE_RECORDED, PAYMENT_COLLECTED, COSTS_LOGGED
    notes = Column(Text, nullable=True)
    details_json = Column(Text, default="{}")
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    recovery_action = relationship("RecoveryAction", back_populates="audit_logs")

    def get_details(self) -> dict:
        try:
            return json.loads(self.details_json)
        except Exception:
            return {}

    def set_details(self, data: dict):
        self.details_json = json.dumps(data)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "recovery_action_id": self.recovery_action_id,
            "actor_id": self.actor_id,
            "actor_email": self.actor_email or "system@subnexa.ai",
            "event_type": self.event_type,
            "notes": self.notes,
            "details": self.get_details(),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
