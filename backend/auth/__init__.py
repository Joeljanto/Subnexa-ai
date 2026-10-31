"""Auth package."""
from backend.auth.utils import bcrypt


def init_bcrypt(app):
    bcrypt.init_app(app)
