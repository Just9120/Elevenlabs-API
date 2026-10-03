from sqlalchemy import select

from .models import Session, User, UserStatus
from .security import token_hash


def lock_oauth_initiator(db, *, state, raw_session, now):
    """Serialize callback consumption against session revocation; never exchange anonymously."""
    if not state or not raw_session:
        return None
    session = db.execute(
        select(Session).where(Session.id == state.session_id).with_for_update()
    ).scalar_one_or_none()
    if (
        session is None
        or session.user_id != state.user_id
        or session.token_hash != token_hash(raw_session)
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        return None
    user = db.get(User, state.user_id)
    if user is None or user.status != UserStatus.active:
        return None
    return session
