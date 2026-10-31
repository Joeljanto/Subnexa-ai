"""
SQLAlchemy database setup for SubNexa AI.
Provides a single shared engine and session factory used by all modules.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

# Engine is initialised lazily (after app config loads env vars)
_engine = None
_SessionLocal = None


def init_db(database_url: str | None = None) -> None:
    """Create engine and all tables. Call once at application startup."""
    global _engine, _SessionLocal
    url = database_url or os.getenv("DATABASE_URL", "sqlite:///subnexa.db")
    # SQLite requires connect_args for thread safety in Flask
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    _engine = create_engine(url, connect_args=connect_args, echo=False)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    # Import all models so their tables are registered with Base
    from backend.auth.models import User  # noqa: F401
    from backend.customers.models import Customer  # noqa: F401
    from backend.subscriptions.models import Subscription  # noqa: F401
    from backend.payments.models import Payment  # noqa: F401
    from backend.billing.models import Invoice  # noqa: F401
    from backend.intelligence.simulator.models import SavedScenario  # noqa: F401
    from backend.recovery.models import RecoveryAction, RecoveryAuditLog  # noqa: F401
    Base.metadata.create_all(bind=_engine)
def get_session():
    """Return a new SQLAlchemy session. Caller is responsible for closing it."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _SessionLocal()


def get_db():
    """Flask-friendly generator that yields a session and closes it after use."""
    db = get_session()
    try:
        yield db
    finally:
        db.close()
