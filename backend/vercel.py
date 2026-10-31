"""Vercel WSGI entrypoint for the SubNexa Flask API."""
import os

required_env = (
    "DATABASE_URL",
    "SECRET_KEY",
    "JWT_SECRET",
    "SEED_ADMIN_PASSWORD",
    "SEED_STAFF_PASSWORD",
)
missing_env = [key for key in required_env if not os.getenv(key)]
if missing_env:
    raise RuntimeError(
        "Configure these Vercel environment variables before deploying: "
        + ", ".join(missing_env)
    )

from backend.app import create_app
from backend.seed import seed_data

app = create_app()
seed_data()
