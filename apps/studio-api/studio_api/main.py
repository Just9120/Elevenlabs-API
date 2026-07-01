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
from .source_storage import get_source_storage, safe_filename

settings=get_settings()
app=FastAPI(docs_url="/docs" if settings.enable_api_docs else None, redoc_url=None, openapi_url="/openapi.json" if settings.enable_api_docs else None)
limiter=RateLimiter()

class LoginIn(BaseModel): email: EmailStr; password: str; login_csrf_token: str
class CredentialIn(BaseModel): provider: CredentialProvider; label: str=Field(min_length=1,max_length=120); raw_value: str=Field(min_length=8,max_length=4096)
class ProjectIn(BaseModel): title: str=Field(min_length=1,max_length=160); description: str|None=Field(default=None,max_length=2000)
class ProjectPatch(BaseModel):
    title: str|None=Field(default=None,min_length=1,max_length=160)
    description: str|None=Field(default=None,max_length=2000)
    output_drive_folder_id: str|None=Field(default=None,max_length=256)
    output_drive_folder_url: str|None=Field(default=None,max_length=2000)
    output_drive_folder_name: str|None=Field(default=None,max_length=512)

class GoogleDriveSourceIn(BaseModel):
    drive_file_id: str=Field(min_length=1,max_length=256)
    drive_file_url: str|None=Field(default=None,max_length=2000)
    original_filename: str=Field(min_length=1,max_length=255)
    mime_type: str|None=Field(default=None,max_length=255)
    size_bytes: int|None=Field(default=None,ge=0)

class LocalUploadInitiateIn(BaseModel):
    original_filename: str=Field(min_length=1,max_length=255)
    mime_type: str=Field(min_length=1,max_length=255)
    size_bytes: int=Field(ge=1)

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

def project_payload(p: Project):
    return {"id": p.id, "owner_user_id": p.owner_user_id, "title": p.title, "description": p.description, "output_drive_folder_id": p.output_drive_folder_id, "output_drive_folder_url": p.output_drive_folder_url, "output_drive_folder_name": p.output_drive_folder_name, "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(), "archived_at": p.archived_at.isoformat() if p.archived_at else None}

def source_payload(s: Source):
    return {"id": s.id, "project_id": s.project_id, "source_type": s.source_type.value, "original_filename": s.original_filename, "mime_type": s.mime_type, "size_bytes": s.size_bytes, "drive_file_id": s.drive_file_id, "drive_file_url": s.drive_file_url, "upload_status": s.upload_status.value, "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None, "expires_at": s.expires_at.isoformat() if s.expires_at else None, "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None, "delete_reason": s.delete_reason, "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat()}

def clean_project_title(title: str) -> str:
    value=title.strip()
    if not value: raise HTTPException(422, "Название проекта обязательно")
    if len(value)>160: raise HTTPException(422, "Название проекта слишком длинное")
    return value

def clean_project_description(description: str|None) -> str|None:
    if description is None: return None
    value=description.strip()
    if len(value)>2000: raise HTTPException(422, "Описание проекта слишком длинное")
    return value or None

def clean_drive_id(value: str|None, label="ID Google Drive") -> str|None:
    if value is None: return None
    value=value.strip()
    if not value: return None
    if len(value)>256 or not all(ch.isalnum() or ch in "_-" for ch in value): raise HTTPException(422, f"Некорректный {label}")
    return value

def clean_drive_url(value: str|None) -> str|None:
    if value is None: return None
    value=value.strip()
    if not value: return None
    if len(value)>2000 or not (value.startswith("https://drive.google.com/") or value.startswith("https://docs.google.com/")):
        raise HTTPException(422, "Некорректная ссылка Google Drive")
    return value

def clean_optional_name(value: str|None) -> str|None:
    if value is None: return None
    value=value.strip()
    return value[:512] or None

ALLOWED_SOURCE_MIME_PREFIXES=("audio/", "video/")
ALLOWED_SOURCE_MIME_TYPES={"application/ogg"}

def validate_upload(mime_type: str, size_bytes: int):
    m=mime_type.strip().lower()
    if not (m.startswith(ALLOWED_SOURCE_MIME_PREFIXES) or m in ALLOWED_SOURCE_MIME_TYPES): raise HTTPException(422, "Неподдерживаемый тип файла")
    if size_bytes > settings.source_max_upload_bytes: raise HTTPException(422, "Файл слишком большой")
    return m

def owned_project_or_404(db: Session, user: User, project_id: str) -> Project:
    p=db.get(Project, project_id)
    if not p or p.owner_user_id!=user.id or p.archived_at is not None: raise HTTPException(404,"Не найдено")
    return p

@app.get("/api/projects")
def list_projects(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair
    rows=db.query(Project).filter(Project.owner_user_id==user.id, Project.archived_at.is_(None)).order_by(Project.updated_at.desc(), Project.created_at.desc()).all()
    return {"projects":[project_payload(p) for p in rows]}

@app.post("/api/projects")
def create_project(data: ProjectIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("project:create:"+user.id, 60, 3600)
    p=Project(owner_user_id=user.id, title=clean_project_title(data.title), description=clean_project_description(data.description))
    db.add(p); db.flush(); audit(db,"project.created",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return project_payload(p)

@app.patch("/api/projects/{project_id}")
def update_project(project_id: str, data: ProjectPatch, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("project:update:"+user.id, 120, 3600); p=owned_project_or_404(db,user,project_id)
    if data.title is not None: p.title=clean_project_title(data.title)
    if data.description is not None: p.description=clean_project_description(data.description)
    if "output_drive_folder_id" in data.model_fields_set: p.output_drive_folder_id=clean_drive_id(data.output_drive_folder_id, "ID папки Google Drive")
    if "output_drive_folder_url" in data.model_fields_set: p.output_drive_folder_url=clean_drive_url(data.output_drive_folder_url)
    if "output_drive_folder_name" in data.model_fields_set: p.output_drive_folder_name=clean_optional_name(data.output_drive_folder_name)
    p.updated_at=utcnow(); audit(db,"project.updated",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return project_payload(p)

@app.post("/api/projects/{project_id}/archive")
def archive_project(project_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("project:archive:"+user.id, 120, 3600); p=owned_project_or_404(db,user,project_id)
    now=utcnow(); p.archived_at=now; p.updated_at=now; audit(db,"project.archived",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return {"ok": True}



def owned_source_or_404(db: Session, user: User, source_id: str) -> Source:
    src=db.get(Source, source_id)
    if not src: raise HTTPException(404,"Не найдено")
    p=db.get(Project, src.project_id)
    if not p or p.owner_user_id!=user.id or p.archived_at is not None: raise HTTPException(404,"Не найдено")
    return src

@app.get("/api/projects/{project_id}/sources")
def list_sources(project_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; p=owned_project_or_404(db,user,project_id)
    rows=db.query(Source).filter(Source.project_id==p.id).order_by(Source.created_at.desc()).all()
    return {"sources":[source_payload(r) for r in rows]}

@app.post("/api/projects/{project_id}/sources/google-drive")
def create_google_drive_source(project_id: str, data: GoogleDriveSourceIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("source:gdrive:create:"+user.id, 120, 3600); p=owned_project_or_404(db,user,project_id)
    src=Source(project_id=p.id, source_type=SourceType.google_drive, original_filename=safe_filename(data.original_filename), mime_type=data.mime_type.strip() if data.mime_type else None, size_bytes=data.size_bytes, drive_file_id=clean_drive_id(data.drive_file_id, "ID файла Google Drive"), drive_file_url=clean_drive_url(data.drive_file_url), upload_status=SourceUploadStatus.uploaded, uploaded_at=utcnow())
    db.add(src); audit(db,"source.google_drive.created",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return source_payload(src)

@app.post("/api/projects/{project_id}/sources/local-upload/initiate")
def initiate_local_upload(project_id: str, data: LocalUploadInitiateIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("source:local:initiate:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    mime=validate_upload(data.mime_type, data.size_bytes)
    if not settings.source_storage_configured(): raise HTTPException(503, "Временное хранилище источников не настроено")
    now=utcnow(); src=Source(project_id=p.id, source_type=SourceType.local_upload, original_filename=safe_filename(data.original_filename), mime_type=mime, size_bytes=data.size_bytes, upload_status=SourceUploadStatus.pending, expires_at=now+timedelta(seconds=settings.source_upload_ttl_seconds))
    db.add(src); db.flush(); src.s3_bucket=settings.source_s3_bucket; src.s3_object_key=f"users/{user.id}/projects/{p.id}/sources/{src.id}/source"
    storage=get_source_storage(settings); url=storage.presigned_put_url(src.s3_object_key, mime, settings.source_presign_ttl_seconds)
    audit(db,"source.local_upload.initiated",actor_user_id=user.id,subject_user_id=user.id); db.commit()
    return {"source_id": src.id, "upload": {"method":"PUT", "url": url, "headers": {"Content-Type": mime}, "expires_in": settings.source_presign_ttl_seconds}, "expires_at": src.expires_at.isoformat()}

@app.post("/api/sources/{source_id}/local-upload/complete")
def complete_local_upload(source_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; src=owned_source_or_404(db,user,source_id)
    if src.source_type!=SourceType.local_upload or src.upload_status!=SourceUploadStatus.pending or src.deleted_at is not None: raise HTTPException(404,"Не найдено")
    try:
        head=get_source_storage(settings).head_object(src.s3_object_key)
    except FileNotFoundError:
        raise HTTPException(409, "Загруженный объект источника не найден")
    if head.size_bytes is not None and src.size_bytes is not None and head.size_bytes > settings.source_max_upload_bytes: raise HTTPException(422, "Файл слишком большой")
    if head.content_type and not (head.content_type.lower().startswith(ALLOWED_SOURCE_MIME_PREFIXES) or head.content_type.lower() in ALLOWED_SOURCE_MIME_TYPES): raise HTTPException(422, "Неподдерживаемый тип файла")
    src.upload_status=SourceUploadStatus.uploaded; src.uploaded_at=utcnow(); src.updated_at=utcnow(); audit(db,"source.local_upload.completed",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return source_payload(src)

@app.delete("/api/sources/{source_id}")
def delete_source(source_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; src=owned_source_or_404(db,user,source_id)
    if src.deleted_at is None:
        if src.source_type==SourceType.local_upload and src.s3_object_key:
            get_source_storage(settings).delete_object(src.s3_object_key)
        src.upload_status=SourceUploadStatus.deleted; src.deleted_at=utcnow(); src.delete_reason="user_deleted"; src.updated_at=src.deleted_at
        audit(db,"source.deleted",actor_user_id=user.id,subject_user_id=user.id)
        db.commit()
    return {"ok": True}

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
