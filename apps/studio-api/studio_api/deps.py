from ipaddress import ip_address
from fastapi import Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from .config import Settings, get_settings
from .db import get_db
from .models import Session as DbSession, User, UserStatus
from .security import safe_eq, token_hash, utcnow

def origin_ok(request: Request, settings: Settings) -> bool:
    origin=request.headers.get("origin")
    referer=request.headers.get("referer")
    return origin == settings.app_origin or (not origin and bool(referer and referer.startswith(settings.app_origin + "/")))

def require_same_origin(request: Request, settings: Settings=Depends(get_settings)):
    if not origin_ok(request, settings): raise HTTPException(403, "Недопустимый источник запроса")

def get_client_ip(request: Request, settings: Settings) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        trusted = ip_address(settings.trusted_proxy_ip)
        direct = ip_address(peer)
    except ValueError:
        return peer
    if direct == trusted:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            try:
                return str(ip_address(forwarded))
            except ValueError:
                return peer
    return peer

def current_session(request: Request, db: Session=Depends(get_db), settings: Settings=Depends(get_settings)):
    raw=request.cookies.get(settings.cookie_name)
    if not raw: raise HTTPException(401, "Требуется вход")
    sess=db.query(DbSession).filter_by(token_hash=token_hash(raw), revoked_at=None).first()
    if not sess or sess.expires_at <= utcnow(): raise HTTPException(401, "Требуется вход")
    user=db.get(User, sess.user_id)
    if not user or user.status != UserStatus.active: raise HTTPException(401, "Требуется вход")
    sess.last_seen_at=utcnow(); db.commit(); return sess, user

def require_csrf(request: Request, x_csrf_token: str=Header(default=""), pair=Depends(current_session), _=Depends(require_same_origin)):
    sess,user=pair
    if not x_csrf_token or not safe_eq(token_hash(x_csrf_token), sess.csrf_hash): raise HTTPException(403, "Недействительный CSRF токен")
    return sess,user
