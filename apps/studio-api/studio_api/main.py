import json
from datetime import timedelta
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
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
from .job_lifecycle import safe_failure_metadata_value
from .job_processing_lifecycle import request_job_cancellation

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

class TranscriptionJobCreateIn(BaseModel):
    source_ids: list[str]=Field(min_length=1, max_length=50)
    provider_credential_id: str|None=Field(default=None, max_length=36)
    title: str|None=Field(default=None, max_length=160)
    language: str|None=Field(default=None, max_length=40)
    options: dict|None=None

    @field_validator("provider_credential_id", mode="before")
    @classmethod
    def normalize_provider_credential_id(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            value=value.strip()
            return value or None
        return value

    @field_validator("source_ids")
    @classmethod
    def unique_source_ids(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Повторяющиеся источники не допускаются")
        return value

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

def clean_job_title(value: str|None) -> str|None:
    if value is None: return None
    value=value.strip()
    if len(value)>160: raise HTTPException(422, "Название задания слишком длинное")
    return value or None

def clean_job_language(value: str|None) -> str|None:
    if value is None: return None
    value=value.strip().lower()
    if not value: return None
    if len(value)>40 or not all(ch.isalnum() or ch in "_-" for ch in value): raise HTTPException(422, "Некорректный язык задания")
    return value

def safe_job_options(value: dict|None) -> str|None:
    if value is None: return None
    encoded=json.dumps(value, ensure_ascii=False, sort_keys=True)
    if len(encoded)>4000: raise HTTPException(422, "Параметры задания слишком большие")
    lowered=encoded.lower()
    forbidden=("secret", "token", "api_key", "apikey", "password", "credential", "authorization", "refresh")
    if any(word in lowered for word in forbidden): raise HTTPException(422, "Параметры задания содержат недопустимые поля")
    return encoded

def job_source_payload(js: TranscriptionJobSource):
    data=source_payload(js.source)
    data.pop("drive_file_url", None)
    data["position"]=js.position
    data["job_source_status"]=js.status.value
    return data

def job_payload(job: TranscriptionJob, include_sources=False):
    payload={"id": job.id, "project_id": job.project_id, "status": job.status.value, "title": job.title, "provider": job.provider, "provider_credential_id": job.provider_credential_id, "source_count": len(job.sources), "created_at": job.created_at.isoformat(), "updated_at": job.updated_at.isoformat(), "cancelled_at": job.cancelled_at.isoformat() if job.cancelled_at else None, "cancel_requested_at": job.cancel_requested_at.isoformat() if job.cancel_requested_at else None, "attempt_count": job.attempt_count or 0, "started_at": job.started_at.isoformat() if job.started_at else None, "finished_at": job.finished_at.isoformat() if job.finished_at else None, "error_code": safe_failure_metadata_value(job.error_code), "error_message": safe_failure_metadata_value(job.error_message)}
    if include_sources: payload["sources"]=[job_source_payload(s) for s in sorted(job.sources, key=lambda item: item.position)]
    return payload

def owned_job_or_404(db: Session, user: User, job_id: str) -> TranscriptionJob:
    job=db.get(TranscriptionJob, job_id)
    if not job or job.owner_user_id!=user.id: raise HTTPException(404, "Не найдено")
    return job

def validate_job_sources(db: Session, project_id: str, source_ids: list[str]) -> list[Source]:
    rows=db.query(Source).filter(Source.id.in_(source_ids), Source.project_id==project_id).all()
    by_id={r.id:r for r in rows}
    ordered=[]
    for sid in source_ids:
        src=by_id.get(sid)
        if not src or src.deleted_at is not None:
            raise HTTPException(422, "Один или несколько источников недоступны для задания")
        if src.source_type==SourceType.google_drive:
            usable=bool(src.drive_file_id) and src.upload_status==SourceUploadStatus.uploaded
        elif src.source_type==SourceType.local_upload:
            usable=src.upload_status==SourceUploadStatus.uploaded and src.s3_object_key is not None
        else:
            usable=False
        if not usable:
            raise HTTPException(422, "Один или несколько источников недоступны для задания")
        ordered.append(src)
    return ordered

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



@app.get("/api/projects/{project_id}/jobs")
def list_project_jobs(project_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; p=owned_project_or_404(db,user,project_id)
    rows=db.query(TranscriptionJob).filter(TranscriptionJob.project_id==p.id, TranscriptionJob.owner_user_id==user.id).order_by(TranscriptionJob.created_at.desc()).all()
    return {"jobs":[job_payload(r) for r in rows]}

@app.post("/api/projects/{project_id}/jobs")
def create_transcription_job(project_id: str, data: TranscriptionJobCreateIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("job:create:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    sources=validate_job_sources(db, p.id, data.source_ids)
    if data.provider_credential_id:
        cred=db.get(ProviderCredential, data.provider_credential_id)
        if not cred or cred.user_id!=user.id or cred.status!=CredentialStatus.active: raise HTTPException(422, "Учетные данные провайдера недоступны")
    job=TranscriptionJob(project_id=p.id, owner_user_id=user.id, status=JobStatus.queued, provider_credential_id=data.provider_credential_id, title=clean_job_title(data.title), language=clean_job_language(data.language), options_json=safe_job_options(data.options))
    db.add(job); db.flush()
    for idx, src in enumerate(sources):
        db.add(TranscriptionJobSource(job_id=job.id, source_id=src.id, position=idx, status=JobSourceStatus.queued))
    audit(db,"job.created",actor_user_id=user.id,subject_user_id=user.id,project_id=p.id,job_id=job.id,source_count=len(sources))
    db.commit(); db.refresh(job)
    return job_payload(job, include_sources=True)

@app.get("/api/jobs/{job_id}")
def get_transcription_job(job_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; job=owned_job_or_404(db,user,job_id)
    return job_payload(job, include_sources=True)

@app.post("/api/jobs/{job_id}/cancel")
def cancel_transcription_job(job_id: str, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("job:cancel:"+user.id, 120, 3600); job=owned_job_or_404(db,user,job_id)
    _, changed, event_type = request_job_cancellation(db, job_id=job.id, now=utcnow())
    if changed and event_type:
        audit(db,event_type,actor_user_id=user.id,subject_user_id=user.id,project_id=job.project_id,job_id=job.id)
        db.commit(); db.refresh(job)
    return job_payload(job, include_sources=True)

def google_connection_payload(c: GoogleConnection|None):
    if not c or c.status != GoogleConnectionStatus.active:
        return {"connected": False, "status": c.status.value if c else None, "google_email": c.google_email if c else None, "scopes": c.scopes if c else None, "connected_at": c.connected_at.isoformat() if c and c.connected_at else None, "revoked_at": c.revoked_at.isoformat() if c and c.revoked_at else None}
    return {"connected": True, "status": c.status.value, "google_email": c.google_email, "scopes": c.scopes, "connected_at": c.connected_at.isoformat() if c.connected_at else None, "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None}

def current_google_connection(db: Session, user: User) -> GoogleConnection|None:
    return db.query(GoogleConnection).filter_by(user_id=user.id, provider=GoogleProvider.google).first()

def google_config_or_503():
    from .google_oauth import GoogleOAuthConfigError, config_unavailable, load_google_oauth_config
    try:
        return load_google_oauth_config(settings)
    except GoogleOAuthConfigError:
        raise config_unavailable()

def google_token_aad(user_id: str, connection_id: str) -> bytes:
    return aad(user_id, connection_id, "refresh", "google")

@app.get("/api/google/connection")
def get_google_connection(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair
    return google_connection_payload(current_google_connection(db, user))

@app.post("/api/google/oauth/start")
def start_google_oauth(request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    sess,user=pair; limiter.check("google:oauth:start:"+user.id, 20, 3600)
    cfg=google_config_or_503()
    from .google_oauth import authorization_url
    raw_state=new_token()
    state=GoogleOAuthState(user_id=user.id, session_id=sess.id, state_hash=token_hash(raw_state), expires_at=utcnow()+timedelta(seconds=settings.google_oauth_state_ttl_seconds))
    db.add(state); audit(db,"google.oauth_started",actor_user_id=user.id,subject_user_id=user.id,session_id=sess.id); db.commit()
    return {"authorization_url": authorization_url(cfg, raw_state), "expires_at": state.expires_at.isoformat()}

@app.get("/api/google/oauth/callback")
def google_oauth_callback(state: str|None=None, code: str|None=None, error: str|None=None, db: Session=Depends(get_db)):
    if error:
        audit(db,"google.oauth_failed"); db.commit(); raise HTTPException(400, "Google OAuth failed")
    if not state or not code:
        raise HTTPException(400, "Invalid OAuth callback")
    row=db.query(GoogleOAuthState).filter_by(state_hash=token_hash(state)).first()
    if not row or row.used_at is not None or row.expires_at <= utcnow():
        raise HTTPException(400, "Invalid OAuth state")
    cfg=google_config_or_503()
    from .google_oauth import exchange_code_for_tokens
    try:
        tokens=exchange_code_for_tokens(cfg, code)
    except Exception:
        audit(db,"google.oauth_failed",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit(); raise HTTPException(400, "Google OAuth failed")
    if not tokens.refresh_token:
        audit(db,"google.oauth_failed",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit(); raise HTTPException(400, "Google OAuth did not return offline access")
    conn=db.query(GoogleConnection).filter_by(user_id=row.user_id, provider=GoogleProvider.google).first()
    now=utcnow()
    if not conn:
        conn=GoogleConnection(user_id=row.user_id, provider=GoogleProvider.google, created_at=now)
        db.add(conn); db.flush()
    ct,nonce=encrypt(tokens.refresh_token, key(), google_token_aad(row.user_id, conn.id))
    conn.status=GoogleConnectionStatus.active; conn.google_subject=tokens.google_subject; conn.google_email=tokens.google_email; conn.scopes=tokens.scope or cfg.scopes; conn.refresh_token_ciphertext=ct; conn.refresh_token_nonce=nonce; conn.key_id=settings.credential_key_id; conn.connected_at=now; conn.revoked_at=None; conn.updated_at=now
    row.used_at=now
    audit(db,"google.connected",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit()
    return {"ok": True, "connected": True}

@app.delete("/api/google/connection")
def delete_google_connection(pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("google:disconnect:"+user.id, 20, 3600)
    conn=current_google_connection(db, user)
    if not conn: return google_connection_payload(None)
    now=utcnow(); conn.status=GoogleConnectionStatus.revoked; conn.refresh_token_ciphertext=None; conn.refresh_token_nonce=None; conn.key_id=None; conn.revoked_at=now; conn.updated_at=now
    audit(db,"google.disconnected",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return google_connection_payload(conn)


def google_drive_metadata_payload(meta):
    return {"id": meta.id, "name": meta.name, "mime_type": meta.mime_type, "size_bytes": meta.size_bytes, "web_view_link": meta.web_view_link, "created_time": meta.created_time, "modified_time": meta.modified_time, "is_folder": meta.is_folder}

def refreshed_google_drive_access_token(db: Session, user: User) -> str:
    cfg=google_config_or_503()
    conn=current_google_connection(db, user)
    if not conn:
        raise HTTPException(404, "Google Drive connection is not connected")
    if conn.status != GoogleConnectionStatus.active:
        raise HTTPException(409, "Google Drive connection is not active")
    if not conn.refresh_token_ciphertext or not conn.refresh_token_nonce or not conn.key_id:
        raise HTTPException(409, "Google Drive connection is not active")
    refresh_token=decrypt(conn.refresh_token_ciphertext, conn.refresh_token_nonce, key(), google_token_aad(user.id, conn.id))
    from .google_drive import refresh_access_token
    return refresh_access_token(cfg, refresh_token)

@app.get("/api/google/drive/files/{drive_file_id}/metadata")
def get_google_drive_file_metadata(drive_file_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("google:drive:metadata:"+user.id, 120, 3600)
    clean_id=clean_drive_id(drive_file_id, "ID файла Google Drive")
    if not clean_id: raise HTTPException(422, "Некорректный ID файла Google Drive")
    try:
        from .google_drive import fetch_drive_file_metadata
        access_token=refreshed_google_drive_access_token(db, user)
        meta=fetch_drive_file_metadata(access_token, clean_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Google Drive metadata is unavailable")
    return google_drive_metadata_payload(meta)

@app.get("/api/google/drive/folders/{folder_id}/children")
def get_google_drive_folder_children(folder_id: str, page_size: int=Query(50, ge=1, le=100), page_token: str|None=Query(None, min_length=1, max_length=512), pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("google:drive:folder-children:"+user.id, 120, 3600)
    clean_id=clean_drive_id(folder_id, "ID папки Google Drive")
    if not clean_id: raise HTTPException(422, "Некорректный ID папки Google Drive")
    try:
        from .google_drive import list_drive_folder_children
        access_token=refreshed_google_drive_access_token(db, user)
        children=list_drive_folder_children(access_token, clean_id, page_size=page_size, page_token=page_token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Google Drive folder children are unavailable")
    return {"folder_id": children.folder_id, "items": [google_drive_metadata_payload(item) for item in children.items], "next_page_token": children.next_page_token}

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
