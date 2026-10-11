"""Local identity implementation of the authorization capability."""
from . import security
from .models import LocalIdentity, Session, User, UserStatus


class LocalAuthorizationProvider:
    def resolve_session(self, db, *, token_hash: str, now):
        session = db.query(Session).filter_by(token_hash=token_hash, revoked_at=None).first()
        if not session or session.expires_at <= now:
            return None
        user = db.get(User, session.user_id)
        if not user or user.status != UserStatus.active:
            return None
        return session, user

    def authenticate(self, db, *, email: str, password: str):
        user = db.query(User).filter_by(email=email, status=UserStatus.active).first()
        identity = db.get(LocalIdentity, user.id) if user else None
        return user if identity and self.verify_password(identity.password_hash, password) else None

    def verify_password(self, encoded: str, password: str) -> bool:
        return security.verify_password(encoded, password)

    def hash_password(self, password: str) -> str:
        return security.hash_password(password)
