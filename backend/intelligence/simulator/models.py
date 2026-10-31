"""SavedScenario model for What-if Revenue Recovery Simulator."""
import uuid
from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from backend.database import Base


class SavedScenario(Base):
    __tablename__ = "saved_scenarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    parameters_json = Column(Text, nullable=False, default="{}")
    results_json = Column(Text, nullable=False, default="{}")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def get_parameters(self) -> dict:
        try:
            return json.loads(self.parameters_json)
        except Exception:
            return {}

    def set_parameters(self, data: dict):
        self.parameters_json = json.dumps(data)

    def get_results(self) -> dict:
        try:
            return json.loads(self.results_json)
        except Exception:
            return {}

    def set_results(self, data: dict):
        self.results_json = json.dumps(data)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_by": self.created_by,
            "parameters": self.get_parameters(),
            "results": self.get_results(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
