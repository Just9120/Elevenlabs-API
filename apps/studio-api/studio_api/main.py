import json
from datetime import timedelta
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from alembic.config import Config
from alembic.script import ScriptDirectory
from .audit import audit
from .config import get_settings
from .db import Base, engine, get_db
from .deps import current_session, get_client_ip, require_csrf, require_same_origin
from .models import *
from .rate_limit import RateLimiter
from .security import *

settings=get_settings()
app=FastAPI(docs_url="/docs" if settings.enable_api_docs else None, redoc_url=None, openapi_url="/openapi.json" if settings.enable_api_docs else None)
limiter=RateLimiter()

class LoginIn(BaseModel): email: EmailStr; password: str; login_csrf_token: str
class CredentialIn(BaseModel): provider: CredentialProvider; label: str=Field(min_length=1,max_length=120); raw_value: str=Field(min_length=8,max_length=4096)

def client_id(request: Request):
    return get_client_ip(request, settings)

def set_cookie(resp: Response, token: str):
    resp.set_cookie(settings.cookie_name, token, max_age=settings.session_days*86400, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")
def clear_cookie(resp: Response): resp.delete_cookie(settings.cookie_name, path="/")

def session_payload(sess, user): return {"authenticated": True, "csrf_token": getattr(sess,"_raw_csrf", None), "user": {"id": user.id, "email": user.email, "role": user.role.value}}

@app.get("/api/healthz")
def healthz(db: Session=Depends(get_db)):
    try:
        db.execute(text("select 1"))
        from pathlib import Path
        cfg_path = "alembic.ini" if Path("alembic.ini").exists() else "apps/studio-api/alembic.ini"
        cfg=Config(cfg_path); expected=ScriptDirectory.from_config(cfg).get_current_head()
        current=None
        try: current=db.execute(text("select version_num from alembic_version")).scalar()
        except Exception: current=None
        if current != expected:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "service unavailable")
        return {"ok": True, "database": "reachable", "migrations": "current"}
    except Exception:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "service unavailable")

@app.get("/api/auth/bootstrap-status")
def bootstrap_status(db: Session=Depends(get_db)):
    limiter.check("bootstrap-status", 60, 60)
    active_admin=db.query(User).filter_by(role=UserRole.admin, status=UserStatus.active).first()
    return {"bootstrap_required": active_admin is None}

@app.post("/api/auth/login-context")
def login_context(request: Request, db: Session=Depends(get_db), _=Depends(require_same_origin)):
    limiter.check("login-context:"+rate_key_part(client_id(request)), 20, 300)
    raw=new_token(); ctx=LoginContext(csrf_hash=token_hash(raw), expires_at=utcnow()+timedelta(minutes=10)); db.add(ctx); db.commit(); return {"login_csrf_token": raw}

@app.post("/api/auth/login")
def login(data: LoginIn, request: Request, response: Response, db: Session=Depends(get_db), _=Depends(require_same_origin)):
    email=normalize_email(data.email); limiter.check("login:"+rate_key_part(client_id(request))+":"+rate_key_part(email), 5, 300)
    ctx=db.query(LoginContext).filter_by(csrf_hash=token_hash(data.login_csrf_token), used_at=None).first()
    if not ctx or ctx.expires_at <= utcnow(): raise HTTPException(403, "Не удалось выполнить вход")
    ctx.used_at=utcnow()
    user=db.query(User).filter_by(email=email, status=UserStatus.active).first(); ident=db.get(LocalIdentity, user.id) if user else None
    if not user or not ident or not verify_password(ident.password_hash, data.password):
        audit(db,"auth.login_failed"); db.commit(); raise HTTPException(401, "Неверная почта или пароль")
    raw_session, raw_csrf = new_token(), new_token()
    sess=Session(user_id=user.id, token_hash=token_hash(raw_session), csrf_hash=token_hash(raw_csrf), expires_at=expires(settings.session_days), rotated_at=utcnow())
    db.add(sess); audit(db,"auth.login", actor_user_id=user.id, subject_user_id=user.id); db.commit(); sess._raw_csrf=raw_csrf; set_cookie(response, raw_session); return session_payload(sess,user)

@app.post("/api/auth/logout")
def logout(response: Response, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    sess,user=pair; sess.revoked_at=utcnow(); audit(db,"auth.logout", actor_user_id=user.id, subject_user_id=user.id, session_id=sess.id); db.commit(); clear_cookie(response); return {"ok": True}

@app.get("/api/auth/session")
def session(pair=Depends(current_session)):
    sess,user=pair; return {"authenticated": True, "user": {"id": user.id,"email": user.email,"role": user.role.value}, "session": {"expires_at": sess.expires_at.isoformat()}}

@app.post("/api/auth/csrf")
def refresh_csrf(pair=Depends(current_session), db: Session=Depends(get_db), _=Depends(require_same_origin)):
    sess,user=pair; raw_csrf=new_token(); sess.csrf_hash=token_hash(raw_csrf); sess.rotated_at=utcnow(); audit(db,"auth.csrf_refreshed", actor_user_id=user.id, subject_user_id=user.id, session_id=sess.id); db.commit(); return {"csrf_token": raw_csrf, "user": {"id": user.id,"email": user.email,"role": user.role.value}, "session": {"expires_at": sess.expires_at.isoformat()}}

@app.get("/api/account")
def account(pair=Depends(current_session)): return session(pair)

@app.post("/api/auth/sessions/revoke-other")
def revoke_other(pair=Depends(require_csrf), db: Session=Depends(get_db)):
    sess,user=pair; n=db.query(Session).filter(Session.user_id==user.id, Session.id!=sess.id, Session.revoked_at.is_(None)).update({"revoked_at": utcnow()}); audit(db,"auth.sessions_revoked", actor_user_id=user.id, subject_user_id=user.id); db.commit(); return {"revoked": n}

@app.get("/api/credentials")
def list_credentials(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; rows=db.query(ProviderCredential).filter_by(user_id=user.id).all(); out=[]
    for c in rows:
        v=db.get(ProviderCredentialVersion, c.active_version_id) if c.active_version_id else None
        out.append({"id":c.id,"provider":c.provider.value,"label":c.label,"status":c.status.value,"active_version":v.version if v else None,"masked_value":v.masked_value if v else None,"created_at":c.created_at.isoformat()})
    return {"credentials": out}

def key(): return master_key_from_b64(settings.master_key_b64())
def add_version(db,user,c,raw):
    nextv=(db.query(func.max(ProviderCredentialVersion.version)).filter_by(credential_id=c.id).scalar() or 0)+1
    v=ProviderCredentialVersion(credential_id=c.id, version=nextv, ciphertext=b"pending", nonce=b"pending", key_id=settings.credential_key_id, masked_value=mask_secret(raw), fingerprint=fingerprint(raw))
    db.add(v); db.flush(); ct,nonce=encrypt(raw,key(),aad(user.id,c.id,v.id,c.provider.value)); v.ciphertext=ct; v.nonce=nonce; c.active_version_id=v.id; c.status=CredentialStatus.active; return v

@app.post("/api/credentials")
def create_credential(data: CredentialIn, request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    sess,user=pair; limiter.check("cred:create:"+user.id, 20, 3600)
    c=ProviderCredential(user_id=user.id, provider=data.provider, label=data.label.strip()); db.add(c); db.flush(); v=add_version(db,user,c,data.raw_value)
    audit(db,"credential.created",actor_user_id=user.id,subject_user_id=user.id,provider=c.provider.value,credential_id=c.id,version=v.version); db.commit(); return {"id": c.id, "provider": c.provider.value, "label": c.label, "status": c.status.value, "masked_value": v.masked_value}

@app.post("/api/credentials/{credential_id}/replace")
def replace_credential(credential_id: str, data: CredentialIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("cred:replace:"+user.id, 20, 3600); c=db.get(ProviderCredential, credential_id)
    if not c or c.user_id!=user.id or c.provider!=data.provider: raise HTTPException(404,"Не найдено")
    v=add_version(db,user,c,data.raw_value); audit(db,"credential.replaced",actor_user_id=user.id,subject_user_id=user.id,provider=c.provider.value,credential_id=c.id,version=v.version); db.commit(); return {"ok": True, "active_version": v.version, "masked_value": v.masked_value}

@app.post("/api/credentials/{credential_id}/revoke")
def revoke_credential(credential_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("cred:revoke:"+user.id, 20, 3600); c=db.get(ProviderCredential, credential_id)
    if not c or c.user_id!=user.id: raise HTTPException(404,"Не найдено")
    c.status=CredentialStatus.revoked; audit(db,"credential.revoked",actor_user_id=user.id,subject_user_id=user.id,provider=c.provider.value,credential_id=c.id); db.commit(); return {"ok": True}

@app.delete("/api/credentials/{credential_id}")
def delete_credential(credential_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("cred:delete:"+user.id, 20, 3600); c=db.get(ProviderCredential, credential_id)
    if not c or c.user_id!=user.id: raise HTTPException(404,"Не найдено")
    c.status=CredentialStatus.deleted; c.deleted_at=utcnow();
    for v in db.query(ProviderCredentialVersion).filter_by(credential_id=c.id): v.ciphertext=None; v.nonce=None; v.deleted_at=utcnow()
    audit(db,"credential.deleted",actor_user_id=user.id,subject_user_id=user.id,provider=c.provider.value,credential_id=c.id); db.commit(); return {"ok": True}

@app.get("/api/audit-events")
def audit_events(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; rows=db.query(AuditEvent).filter(AuditEvent.subject_user_id==user.id).order_by(AuditEvent.created_at.desc()).limit(50).all()
    return {"events":[{"id":r.id,"type":r.event_type,"metadata":json.loads(r.metadata_json),"created_at":r.created_at.isoformat()} for r in rows]}
