import hashlib, json, re
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse, Response as FastAPIResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import text, func
from sqlalchemy.exc import IntegrityError
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
from .source_storage import get_source_storage, normalize_source_display_filename
from .source_policy import is_supported_source_mime_type, normalize_source_mime_type, validate_source_size
from .google_connection_access import GoogleConnectionAccessError, GoogleConnectionAccessReason, active_google_connection_for_user, google_token_aad, refresh_user_google_drive_access_token, require_drive_file_scope
from .google_scopes import has_drive_file_scope
from .job_lifecycle import safe_failure_metadata_value
from .job_processing_lifecycle import request_job_cancellation
from .diagnostics import REGISTRY, cleanup_expired_diagnostics, cursor_context, decode_cursor_payload, encode_cursor, markdown_escape, new_correlation_id, new_request_id, sanitize_build_id, sanitize_inbound_correlation, valid_correlation_id, valid_uuid, write_diagnostic_event
from .job_output_read import browser_job_output_payload, load_browser_job_output_rows
from .job_output_folder_selection import VerifiedOutputFolderSelection, verify_output_folder_selection

settings=get_settings()
app=FastAPI(docs_url="/docs" if settings.enable_api_docs else None, redoc_url=None, openapi_url="/openapi.json" if settings.enable_api_docs else None)
limiter=RateLimiter()

@app.middleware("http")
async def request_correlation_middleware(request: Request, call_next):
    request_id = new_request_id()
    correlation_id = sanitize_inbound_correlation(request.headers.get("x-correlation-id"))
    request.state.request_id = request_id
    request.state.correlation_id = correlation_id
    try:
        response = await call_next(request)
    except Exception:
        response = JSONResponse({"detail": "Internal server error"}, status_code=500)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = correlation_id
    return response


class LoginIn(BaseModel): email: EmailStr; password: str; login_csrf_token: str
class CredentialIn(BaseModel): provider: CredentialProvider; label: str=Field(min_length=1,max_length=120); raw_value: str=Field(min_length=8,max_length=4096)
class ProjectIn(BaseModel): title: str=Field(min_length=1,max_length=160); description: str|None=Field(default=None,max_length=2000)
class ProjectPatch(BaseModel):
    title: str|None=Field(default=None,min_length=1,max_length=160)
    description: str|None=Field(default=None,max_length=2000)
    output_drive_folder_id: str|None=Field(default=None,max_length=256)
    output_drive_folder_url: str|None=Field(default=None,max_length=2000)
    output_drive_folder_name: str|None=Field(default=None,max_length=512)

class GooglePickerSourceSelectionIn(BaseModel):
    file_ids: list[str]=Field(min_length=1,max_length=50)

    @field_validator("file_ids")
    @classmethod
    def unique_file_ids(cls, value):
        cleaned=[]
        for item in value:
            if not isinstance(item, str):
                raise ValueError("Некорректный ID файла Google Drive")
            normalized=item.strip()
            if not normalized:
                raise ValueError("Некорректный ID файла Google Drive")
            cleaned.append(normalized)
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Повторяющиеся Google Drive файлы не допускаются")
        return cleaned

class GooglePickerOutputFolderIn(BaseModel):
    folder_id: str=Field(min_length=1,max_length=256)

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

class BatchJobItemIn(BaseModel):
    source_id: str=Field(min_length=1,max_length=36)
    output_folder_id: str=Field(min_length=1,max_length=256)
    title: str|None=Field(default=None,max_length=160)

class TranscriptionJobBatchCreateIn(BaseModel):
    provider_credential_id: str|None=Field(default=None, max_length=36)
    language: str|None=Field(default=None, max_length=40)
    options: dict|None=None
    items: list[BatchJobItemIn]=Field(min_length=1,max_length=50)

class DiagnosticDebugSessionIn(BaseModel):
    duration_minutes: int=Field(ge=1, le=30)

class PwaDiagnosticEventIn(BaseModel):
    event_code: str=Field(min_length=1, max_length=80)
    level: str|None=Field(default=None, min_length=1, max_length=10)
    correlation_id: str|None=Field(default=None, max_length=128)
    project_id: str|None=Field(default=None, min_length=36, max_length=36)
    job_id: str|None=Field(default=None, min_length=36, max_length=36)
    metadata: dict|None=Field(default=None)

class PwaDiagnosticsIn(BaseModel):
    events: list[PwaDiagnosticEventIn]=Field(min_length=1, max_length=20)

class DiagnosticReportIn(BaseModel):
    start: datetime|None=None
    end: datetime|None=None
    level: str|None=Field(default=None, min_length=1, max_length=10)
    component: str|None=Field(default=None, min_length=1, max_length=20)
    event_code: str|None=Field(default=None, min_length=1, max_length=80)
    project_id: str|None=Field(default=None, min_length=36, max_length=36)
    job_id: str|None=Field(default=None, min_length=36, max_length=36)

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

def safe_job_output_folder_payload(job: TranscriptionJob):
    if not job.output_drive_folder_id:
        return None
    try:
        url=clean_drive_url(job.output_drive_folder_url)
    except HTTPException:
        url=None
    return {"name": clean_optional_name(job.output_drive_folder_name) or "Папка Google Drive", "web_view_url": url}

def job_payload(job: TranscriptionJob, include_sources=False):
    payload={"id": job.id, "project_id": job.project_id, "status": job.status.value, "title": job.title, "provider": job.provider, "provider_credential_id": job.provider_credential_id, "source_count": len(job.sources), "created_at": job.created_at.isoformat(), "updated_at": job.updated_at.isoformat(), "cancelled_at": job.cancelled_at.isoformat() if job.cancelled_at else None, "cancel_requested_at": job.cancel_requested_at.isoformat() if job.cancel_requested_at else None, "attempt_count": job.attempt_count or 0, "started_at": job.started_at.isoformat() if job.started_at else None, "finished_at": job.finished_at.isoformat() if job.finished_at else None, "error_code": safe_failure_metadata_value(job.error_code), "error_message": safe_failure_metadata_value(job.error_message), "output_folder": safe_job_output_folder_payload(job)}
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

def validate_upload(mime_type: str, size_bytes: int):
    m=normalize_source_mime_type(mime_type)
    if not is_supported_source_mime_type(m): raise HTTPException(422, "Неподдерживаемый тип файла")
    if not validate_source_size(size_bytes, settings.source_max_upload_bytes): raise HTTPException(422, "Файл слишком большой")
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
    rows=db.query(Source).filter(Source.project_id==p.id, Source.deleted_at.is_(None)).order_by(Source.created_at.desc()).all()
    return {"sources":[source_payload(r) for r in rows]}

def _picker_cache_headers(response: Response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

@app.post("/api/google/picker/session")
def create_google_picker_session(response: Response, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("google:picker:session:"+user.id, 30, 300); _picker_cache_headers(response)
    if not settings.google_picker_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google Picker is not configured")
    try:
        conn=active_google_connection_for_user(db, user_id=user.id)
        require_drive_file_scope(conn)
        access_token=refresh_user_google_drive_access_token(db, user_id=user.id, settings=settings)
    except GoogleConnectionAccessError as exc:
        if exc.reason == GoogleConnectionAccessReason.missing:
            raise HTTPException(404, "Google Drive connection is not connected")
        if exc.reason == GoogleConnectionAccessReason.inactive:
            raise HTTPException(409, "Google Drive connection is not active")
        if exc.reason == GoogleConnectionAccessReason.scope_unavailable:
            raise HTTPException(409, "Google Drive reconnect is required")
        if exc.reason == GoogleConnectionAccessReason.config_unavailable:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")
        raise HTTPException(502, "Google Picker session is unavailable")
    return {"access_token": access_token, "api_key": settings.google_picker_api_key.strip(), "app_id": settings.google_picker_app_id.strip(), "scope_ready": True}

def _validated_drive_metadata_for_picker(db: Session, user: User, drive_id: str):
    from .google_drive import GoogleDriveMetadataError, fetch_drive_file_metadata
    clean_id=clean_drive_id(drive_id, "ID Google Drive")
    if not clean_id: raise HTTPException(422, "Некорректный ID Google Drive")
    try:
        access_token=refreshed_google_drive_access_token(db, user)
        return fetch_drive_file_metadata(access_token, clean_id)
    except HTTPException:
        raise
    except GoogleDriveMetadataError:
        raise HTTPException(422, "Выбранный ресурс Google Drive недоступен")
    except Exception:
        raise HTTPException(502, "Google Drive metadata is unavailable")

@app.post("/api/projects/{project_id}/sources/google-picker")
def create_google_picker_sources(project_id: str, data: GooglePickerSourceSelectionIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("source:gpicker:create:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    metas=[]
    for raw_id in data.file_ids:
        meta=_validated_drive_metadata_for_picker(db, user, raw_id)
        if meta.is_folder:
            raise HTTPException(422, "Папки Google Drive нельзя добавить как source")
        mime=normalize_source_mime_type(meta.mime_type or "")
        if not is_supported_source_mime_type(mime):
            raise HTTPException(422, "Неподдерживаемый тип файла")
        if meta.size_bytes is not None and not validate_source_size(meta.size_bytes, settings.source_max_upload_bytes):
            raise HTTPException(422, "Файл слишком большой")
        metas.append((meta, mime))
    now=utcnow(); created=[]
    try:
        for meta,mime in metas:
            src=Source(project_id=p.id, source_type=SourceType.google_drive, original_filename=normalize_source_display_filename(meta.name or f"Google Drive source {meta.id}"), mime_type=mime, size_bytes=meta.size_bytes, drive_file_id=clean_drive_id(meta.id, "ID файла Google Drive"), drive_file_url=clean_drive_url(meta.web_view_link), upload_status=SourceUploadStatus.uploaded, uploaded_at=now)
            db.add(src); created.append(src)
        audit(db,"source.google_picker.created",actor_user_id=user.id,subject_user_id=user.id,project_id=p.id,source_count=len(created)); db.commit()
    except Exception:
        db.rollback(); raise
    return {"sources":[source_payload(src) for src in created]}

@app.post("/api/projects/{project_id}/output-folder/google-picker")
def set_google_picker_output_folder(project_id: str, data: GooglePickerOutputFolderIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("project:gpicker:folder:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    access_token=refreshed_google_drive_access_token(db, user)
    verified=verify_output_folder_selection(access_token, data.folder_id)
    p.output_drive_folder_id=verified.id
    p.output_drive_folder_url=verified.web_view_url
    p.output_drive_folder_name=verified.name
    p.updated_at=utcnow(); audit(db,"project.output_folder.google_picker_set",actor_user_id=user.id,subject_user_id=user.id,project_id=p.id); db.commit(); db.refresh(p)
    return project_payload(p)


@app.post("/api/projects/{project_id}/output-folders/google-picker/verify")
def verify_google_picker_output_folder(project_id: str, data: GooglePickerOutputFolderIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("project:gpicker:folder:verify:"+user.id, 120, 3600); owned_project_or_404(db,user,project_id)
    access_token=refreshed_google_drive_access_token(db, user)
    verified=verify_output_folder_selection(access_token, data.folder_id)
    return {"name": verified.name or "Папка Google Drive", "web_view_url": verified.web_view_url}

_IDEMPOTENCY_RE=re.compile(r"^[A-Za-z0-9_.-]{8,128}$")
def _clean_idempotency_key(value: str|None) -> str:
    key=(value or "").strip()
    if not _IDEMPOTENCY_RE.fullmatch(key):
        raise HTTPException(422, "Некорректный Idempotency-Key")
    return key

def _load_existing_batch(db, user_id, project_id, key):
    return db.query(TranscriptionJob).filter(TranscriptionJob.owner_user_id==user_id, TranscriptionJob.project_id==project_id, TranscriptionJob.batch_idempotency_key==key).order_by(TranscriptionJob.batch_position.asc(), TranscriptionJob.id.asc()).all()

def _batch_hash(project_id, provider_credential_id, language, options_json, items):
    canonical={"project_id":project_id,"provider_credential_id":provider_credential_id,"language":language,"options":json.loads(options_json) if options_json else None,"items":items}
    return hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def _existing_batch_is_complete(existing, request_hash: str, expected_count: int) -> bool:
    if len(existing) != expected_count:
        return False
    positions=[job.batch_position for job in existing]
    return positions == list(range(expected_count)) and all(job.batch_request_hash == request_hash for job in existing)

@app.post("/api/projects/{project_id}/jobs/batch")
def create_transcription_jobs_batch(project_id: str, data: TranscriptionJobBatchCreateIn, request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("job:batch:create:"+user.id, 30, 3600); p=owned_project_or_404(db,user,project_id)
    key=_clean_idempotency_key(request.headers.get("Idempotency-Key"))
    language=clean_job_language(data.language); options_json=safe_job_options(data.options)
    provider_credential_id=data.provider_credential_id.strip() if isinstance(data.provider_credential_id, str) and data.provider_credential_id.strip() else None
    pairs=set(); duplicate_pair_found=False; source_ids=[]; folder_ids=[]; titles=[]
    for item in data.items:
        sid=item.source_id.strip(); fid=clean_drive_id(item.output_folder_id, "ID папки Google Drive")
        pair_key=(sid,fid)
        if pair_key in pairs: duplicate_pair_found=True
        pairs.add(pair_key); source_ids.append(sid); folder_ids.append(fid); titles.append(clean_job_title(item.title))
    hash_items=[{"source_id": sid, "output_folder_id": fid, "title": title} for sid,fid,title in zip(source_ids,folder_ids,titles)]
    request_hash=_batch_hash(p.id, provider_credential_id, language, options_json, hash_items)
    existing=_load_existing_batch(db,user.id,p.id,key)
    if existing:
        if not _existing_batch_is_complete(existing, request_hash, len(data.items)):
            raise HTTPException(409, "Idempotency-Key already used with a different request")
        return {"jobs":[job_payload(j, include_sources=True) for j in existing], "created_count": len(existing), "replayed": True}
    if duplicate_pair_found:
        raise HTTPException(422, "Повторяющиеся source/folder пары не допускаются")
    if provider_credential_id:
        cred=db.get(ProviderCredential, provider_credential_id)
        if not cred or cred.user_id!=user.id or cred.status!=CredentialStatus.active: raise HTTPException(422, "Учетные данные провайдера недоступны")
    sources=validate_job_sources(db, p.id, source_ids)
    unique_folders=list(dict.fromkeys(folder_ids))
    access_token=refreshed_google_drive_access_token(db, user)
    verified_by_id={fid: verify_output_folder_selection(access_token, fid) for fid in unique_folders}
    try:
        jobs=[]
        for idx,(src,fid,title) in enumerate(zip(sources,folder_ids,titles)):
            vf=verified_by_id[fid]
            job=TranscriptionJob(project_id=p.id, owner_user_id=user.id, status=JobStatus.queued, provider_credential_id=provider_credential_id, title=title, language=language, options_json=options_json, batch_idempotency_key=key, batch_request_hash=request_hash, batch_position=idx)
            job.apply_output_folder_snapshot(folder_id=vf.id, folder_url=vf.web_view_url, folder_name=vf.name)
            db.add(job); db.flush(); db.add(TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0, status=JobSourceStatus.queued)); jobs.append(job)
        audit(db,"job.batch_created",actor_user_id=user.id,subject_user_id=user.id,project_id=p.id,created_count=len(jobs))
        db.commit()
        for job in jobs:
            write_diagnostic_event(owner_user_id=user.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=job.id, request_id=getattr(request.state,"request_id",None), correlation_id=getattr(request.state,"correlation_id",None), metadata={"source_count": 1, "batch_position": job.batch_position or 0, "credential_selected": bool(provider_credential_id)})
    except IntegrityError:
        db.rollback(); existing=_load_existing_batch(db,user.id,p.id,key)
        if _existing_batch_is_complete(existing, request_hash, len(data.items)):
            return {"jobs":[job_payload(j, include_sources=True) for j in existing], "created_count": len(existing), "replayed": True}
        raise HTTPException(409, "Idempotency-Key already used with a different request")
    for job in jobs: db.refresh(job)
    return {"jobs":[job_payload(j, include_sources=True) for j in sorted(jobs, key=lambda j: j.batch_position or 0)], "created_count": len(jobs), "replayed": False}

@app.post("/api/projects/{project_id}/sources/google-drive")
def create_google_drive_source(project_id: str, data: GoogleDriveSourceIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("source:gdrive:create:"+user.id, 120, 3600); p=owned_project_or_404(db,user,project_id)
    src=Source(project_id=p.id, source_type=SourceType.google_drive, original_filename=normalize_source_display_filename(data.original_filename), mime_type=data.mime_type.strip() if data.mime_type else None, size_bytes=data.size_bytes, drive_file_id=clean_drive_id(data.drive_file_id, "ID файла Google Drive"), drive_file_url=clean_drive_url(data.drive_file_url), upload_status=SourceUploadStatus.uploaded, uploaded_at=utcnow())
    db.add(src); audit(db,"source.google_drive.created",actor_user_id=user.id,subject_user_id=user.id); db.commit(); return source_payload(src)

@app.post("/api/projects/{project_id}/sources/local-upload/initiate")
def initiate_local_upload(project_id: str, data: LocalUploadInitiateIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("source:local:initiate:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    mime=validate_upload(data.mime_type, data.size_bytes)
    if not settings.source_storage_configured(): raise HTTPException(503, "Временное хранилище источников не настроено")
    now=utcnow(); src=Source(project_id=p.id, source_type=SourceType.local_upload, original_filename=normalize_source_display_filename(data.original_filename), mime_type=mime, size_bytes=data.size_bytes, upload_status=SourceUploadStatus.pending, expires_at=now+timedelta(seconds=settings.source_upload_ttl_seconds))
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
    if head.content_type and not is_supported_source_mime_type(head.content_type): raise HTTPException(422, "Неподдерживаемый тип файла")
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
def create_transcription_job(project_id: str, data: TranscriptionJobCreateIn, request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("job:create:"+user.id, 60, 3600); p=owned_project_or_404(db,user,project_id)
    sources=validate_job_sources(db, p.id, data.source_ids)
    if data.provider_credential_id:
        cred=db.get(ProviderCredential, data.provider_credential_id)
        if not cred or cred.user_id!=user.id or cred.status!=CredentialStatus.active: raise HTTPException(422, "Учетные данные провайдера недоступны")
    job=TranscriptionJob(project_id=p.id, owner_user_id=user.id, status=JobStatus.queued, provider_credential_id=data.provider_credential_id, title=clean_job_title(data.title), language=clean_job_language(data.language), options_json=safe_job_options(data.options))
    job.apply_output_folder_snapshot(folder_id=p.output_drive_folder_id, folder_url=p.output_drive_folder_url, folder_name=p.output_drive_folder_name)
    db.add(job); db.flush()
    for idx, src in enumerate(sources):
        db.add(TranscriptionJobSource(job_id=job.id, source_id=src.id, position=idx, status=JobSourceStatus.queued))
    audit(db,"job.created",actor_user_id=user.id,subject_user_id=user.id,project_id=p.id,job_id=job.id,source_count=len(sources))
    db.commit(); write_diagnostic_event(owner_user_id=user.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=job.id, request_id=getattr(request.state,"request_id",None), correlation_id=getattr(request.state,"correlation_id",None), metadata={"source_count": len(sources), "credential_selected": bool(data.provider_credential_id)}); db.refresh(job)
    return job_payload(job, include_sources=True)

@app.get("/api/jobs/{job_id}")
def get_transcription_job(job_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; job=owned_job_or_404(db,user,job_id)
    return job_payload(job, include_sources=True)


@app.get("/api/jobs/{job_id}/outputs")
def get_transcription_job_outputs(job_id: str, pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; job=owned_job_or_404(db,user,job_id)
    try:
        rows=load_browser_job_output_rows(db, job.id)
        outputs=[browser_job_output_payload(output, job_source, source) for output, job_source, source in rows]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Не удалось загрузить результаты задания") from None
    return {"job_id": job.id, "job_status": job.status.value, "output_count": len(outputs), "outputs": outputs}

@app.post("/api/jobs/{job_id}/cancel")
def cancel_transcription_job(job_id: str, request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("job:cancel:"+user.id, 120, 3600); job=owned_job_or_404(db,user,job_id)
    _, changed, event_type = request_job_cancellation(db, job_id=job.id, now=utcnow())
    if changed and event_type:
        audit(db,event_type,actor_user_id=user.id,subject_user_id=user.id,project_id=job.project_id,job_id=job.id)
        db.commit(); db.refresh(job); event_code="JOB_CANCELLED" if job.status==JobStatus.cancelled else "JOB_CANCEL_REQUESTED"; write_diagnostic_event(owner_user_id=user.id, component="api", event_code=event_code, project_id=job.project_id, job_id=job.id, request_id=getattr(request.state,"request_id",None), correlation_id=getattr(request.state,"correlation_id",None), metadata={"final_job_status": job.status.value})
    return job_payload(job, include_sources=True)


def _diag_dt(value: datetime | None, default: datetime) -> datetime:
    if value is None: return default
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value

def _diag_filters(db: Session, user: User, *, start=None, end=None, level=None, component=None, event_code=None, project_id=None, job_id=None):
    now_dt=utcnow().replace(tzinfo=None); end_dt=_diag_dt(end, now_dt); start_dt=_diag_dt(start, end_dt-timedelta(days=1))
    if end_dt < start_dt or end_dt - start_dt > timedelta(days=7): raise HTTPException(422, "Diagnostic range must be at most 7 days")
    if level and level not in DiagnosticLevel.__members__: raise HTTPException(422, "Invalid diagnostic level")
    if component and component not in {c.value for c in DiagnosticComponent}: raise HTTPException(422, "Invalid diagnostic component")
    if event_code and event_code not in REGISTRY: raise HTTPException(422, "Invalid diagnostic event code")
    if project_id and not valid_uuid(project_id): raise HTTPException(422, "Invalid project id")
    if job_id and not valid_uuid(job_id): raise HTTPException(422, "Invalid job id")
    if project_id:
        p=db.get(Project, project_id)
        if not p or p.owner_user_id!=user.id: raise HTTPException(404, "Не найдено")
    if job_id:
        j=db.get(TranscriptionJob, job_id)
        if not j or j.owner_user_id!=user.id: raise HTTPException(404, "Не найдено")
        if project_id and j.project_id != project_id: raise HTTPException(404, "Не найдено")
    q=db.query(DiagnosticEvent).filter(DiagnosticEvent.owner_user_id==user.id, DiagnosticEvent.first_occurred_at>=start_dt, DiagnosticEvent.first_occurred_at<=end_dt, DiagnosticEvent.expires_at>now_dt)
    if level: q=q.filter(DiagnosticEvent.level==DiagnosticLevel[level])
    if component: q=q.filter(DiagnosticEvent.component==DiagnosticComponent(component))
    if event_code: q=q.filter(DiagnosticEvent.event_code==event_code)
    if project_id: q=q.filter(DiagnosticEvent.project_id==project_id)
    if job_id: q=q.filter(DiagnosticEvent.job_id==job_id)
    return q, start_dt, end_dt

def _diag_payload(e: DiagnosticEvent):
    return {"id": e.id, "occurred_at": e.first_occurred_at.isoformat(), "last_occurred_at": e.last_occurred_at.isoformat(), "level": e.level.value, "component": e.component.value, "event_code": e.event_code, "correlation_id": e.correlation_id, "request_id": e.request_id, "project_id": e.project_id, "job_id": e.job_id, "metadata": json.loads(e.metadata_json or "{}"), "occurrence_count": e.occurrence_count}

def _system_summary(db: Session, user: User):
    conn=current_google_connection(db, user)
    active_creds=db.query(func.count(ProviderCredential.id)).filter(ProviderCredential.user_id==user.id, ProviderCredential.status==CredentialStatus.active, ProviderCredential.deleted_at.is_(None)).scalar() or 0
    return {"environment": sanitize_build_id(settings.environment), "build": {"web": sanitize_build_id(settings.diagnostic_web_build_id), "api": sanitize_build_id(settings.diagnostic_api_build_id), "worker": sanitize_build_id(settings.diagnostic_worker_build_id)}, "google_drive": {"connected": bool(conn and conn.status==GoogleConnectionStatus.active), "scope_ready": bool(conn and conn.status==GoogleConnectionStatus.active and has_drive_file_scope(conn.scopes))}, "provider_credentials": {"active_count": int(active_creds), "ready": int(active_creds)>0}, "diagnostics": {"recording_enabled": True, "debug_recording": "inactive", "retention_days": settings.diagnostic_retention_days, "debug_retention_hours": settings.diagnostic_debug_retention_hours}, "report_limits": {"max_days": 7, "max_timeline_events": settings.diagnostic_report_max_events}}


DEBUG_SESSION_MAX_MINUTES = 30
PWA_EVENT_CODES = frozenset({"PWA_APP_ERROR", "PWA_UNHANDLED_REJECTION", "PWA_API_REQUEST_FAILED", "PWA_ROUTE_ERROR", "PWA_SERVICE_WORKER_ERROR"})
PWA_METADATA_KEYS = frozenset({"boundary", "duration_ms", "error_code", "retryable", "http_status_category", "endpoint_group"})

def _debug_now() -> datetime:
    return utcnow().replace(tzinfo=None)

def _active_debug_session(db: Session, user: User, now_dt: datetime | None = None) -> DiagnosticDebugSession | None:
    now_dt = now_dt or _debug_now()
    return db.query(DiagnosticDebugSession).filter(DiagnosticDebugSession.owner_user_id==user.id, DiagnosticDebugSession.ended_at.is_(None), DiagnosticDebugSession.expires_at>now_dt).order_by(DiagnosticDebugSession.expires_at.desc()).first()

def _debug_session_payload(row: DiagnosticDebugSession | None, now_dt: datetime | None = None):
    now_dt = now_dt or _debug_now()
    active = bool(row and row.ended_at is None and row.expires_at > now_dt)
    payload={"active": active, "max_duration_minutes": DEBUG_SESSION_MAX_MINUTES}
    if active:
        payload["started_at"] = row.started_at.isoformat()
        payload["expires_at"] = row.expires_at.isoformat()
    return payload

@app.get("/api/diagnostics/debug-session")
def diagnostics_debug_session(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:debug-session:"+user.id, 120, 3600); return _debug_session_payload(_active_debug_session(db,user))

@app.post("/api/diagnostics/debug-session")
def start_diagnostics_debug_session(data: DiagnosticDebugSessionIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:debug-session:start:"+user.id, 10, 3600); now_dt=_debug_now(); existing=_active_debug_session(db,user,now_dt)
    if existing: raise HTTPException(409, _debug_session_payload(existing, now_dt))
    row=DiagnosticDebugSession(owner_user_id=user.id, started_at=now_dt, expires_at=now_dt+timedelta(minutes=data.duration_minutes))
    db.add(row); db.commit(); db.refresh(row); return _debug_session_payload(row, now_dt)

@app.delete("/api/diagnostics/debug-session")
def stop_diagnostics_debug_session(pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:debug-session:stop:"+user.id, 30, 3600); now_dt=_debug_now(); row=_active_debug_session(db,user,now_dt)
    if row:
        row.ended_at=now_dt; db.commit()
    return _debug_session_payload(None, now_dt)

def _validate_pwa_scope(db: Session, user: User, event: PwaDiagnosticEventIn):
    if event.project_id and not valid_uuid(event.project_id): raise HTTPException(422, "Invalid project id")
    if event.job_id and not valid_uuid(event.job_id): raise HTTPException(422, "Invalid job id")
    if event.project_id:
        p=db.get(Project,event.project_id)
        if not p or p.owner_user_id != user.id: raise HTTPException(404, "Не найдено")
    if event.job_id:
        j=db.get(TranscriptionJob,event.job_id)
        if not j or j.owner_user_id != user.id: raise HTTPException(404, "Не найдено")
        if event.project_id and j.project_id != event.project_id: raise HTTPException(404, "Не найдено")

@app.post("/api/diagnostics/pwa-events")
def ingest_pwa_diagnostics(data: PwaDiagnosticsIn, request: Request, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:pwa-ingest:"+user.id, 120, 3600); now_dt=_debug_now(); persisted=[]
    active_debug = _active_debug_session(db,user,now_dt) is not None
    for event in data.events:
        if event.event_code not in PWA_EVENT_CODES: raise HTTPException(422, "Invalid diagnostic event code")
        if event.metadata and (set(event.metadata) - PWA_METADATA_KEYS): raise HTTPException(422, "Invalid diagnostic metadata")
        level = event.level or REGISTRY[event.event_code].level
        if level == "DEBUG" and not active_debug: raise HTTPException(403, "DEBUG diagnostics session is not active")
        if level != REGISTRY[event.event_code].level and level != "DEBUG": raise HTTPException(422, "Invalid diagnostic level")
        _validate_pwa_scope(db,user,event)
        corr = event.correlation_id if event.correlation_id and valid_correlation_id(event.correlation_id) else None
        result=write_diagnostic_event(owner_user_id=user.id, component="web", event_code=event.event_code, level=level, project_id=event.project_id, job_id=event.job_id, correlation_id=corr, request_id=getattr(request.state,"request_id",None), metadata=event.metadata or {}, now=now_dt)
        if not result.accepted: raise HTTPException(422, "Invalid diagnostic event")
        if result.event_id: persisted.append(result.event_id)
    return {"accepted": len(data.events), "persisted": len(persisted)}

@app.get("/api/diagnostics/events")
def diagnostics_events(start: datetime|None=Query(None), end: datetime|None=Query(None), level: str|None=Query(None, min_length=1, max_length=10), component: str|None=Query(None, min_length=1, max_length=20), event_code: str|None=Query(None, min_length=1, max_length=80), project_id: str|None=Query(None, min_length=36, max_length=36), job_id: str|None=Query(None, min_length=36, max_length=36), cursor: str|None=Query(None, max_length=1200), page_size: int=Query(50, ge=1, le=200), pair=Depends(current_session), db: Session=Depends(get_db)):
    sess,user=pair; limiter.check("diagnostics:events:"+user.id, 120, 3600); cleanup_expired_diagnostics()
    cursor_position = None
    if cursor:
        decoded=decode_cursor_payload(cursor, sess.csrf_hash)
        if not decoded: raise HTTPException(422, "Invalid diagnostic cursor")
        cdt,cid,signed_ctx=decoded
        if signed_ctx.get("owner") != user.id: raise HTTPException(422, "Invalid diagnostic cursor")
        for name, supplied in {"level": level, "component": component, "event_code": event_code, "project_id": project_id, "job_id": job_id}.items():
            if supplied is not None and supplied != signed_ctx.get(name):
                raise HTTPException(422, "Invalid diagnostic cursor")
        if start is not None and _diag_dt(start, start).isoformat() != signed_ctx.get("start"):
            raise HTTPException(422, "Invalid diagnostic cursor")
        if end is not None and _diag_dt(end, end).isoformat() != signed_ctx.get("end"):
            raise HTTPException(422, "Invalid diagnostic cursor")
        start = datetime.fromisoformat(signed_ctx["start"]) if start is None else start
        end = datetime.fromisoformat(signed_ctx["end"]) if end is None else end
        level = signed_ctx.get("level") if level is None else level
        component = signed_ctx.get("component") if component is None else component
        event_code = signed_ctx.get("event_code") if event_code is None else event_code
        project_id = signed_ctx.get("project_id") if project_id is None else project_id
        job_id = signed_ctx.get("job_id") if job_id is None else job_id
        cursor_position = (cdt, cid, signed_ctx)
    q,start_dt,end_dt=_diag_filters(db,user,start=start,end=end,level=level,component=component,event_code=event_code,project_id=project_id,job_id=job_id)
    if cursor_position:
        cdt,cid,signed_ctx=cursor_position
        ctx=cursor_context(owner_user_id=user.id, start=start_dt, end=end_dt, level=level, component=component, event_code=event_code, project_id=project_id, job_id=job_id)
        if ctx != signed_ctx: raise HTTPException(422, "Invalid diagnostic cursor")
        q=q.filter((DiagnosticEvent.first_occurred_at < cdt) | ((DiagnosticEvent.first_occurred_at == cdt) & (DiagnosticEvent.id < cid)))
    rows=q.order_by(DiagnosticEvent.first_occurred_at.desc(), DiagnosticEvent.id.desc()).limit(page_size+1).all()
    next_cursor=None
    if len(rows)>page_size:
        last=rows[page_size-1]; ctx=cursor_context(owner_user_id=user.id, start=start_dt, end=end_dt, level=level, component=component, event_code=event_code, project_id=project_id, job_id=job_id); next_cursor=encode_cursor(last.first_occurred_at,last.id,ctx,sess.csrf_hash); rows=rows[:page_size]
    return {"events": [_diag_payload(r) for r in rows], "next_cursor": next_cursor, "period": {"start": start_dt.isoformat(), "end": end_dt.isoformat()}}

@app.get("/api/diagnostics/system")
def diagnostics_system(pair=Depends(current_session), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:system:"+user.id, 120, 3600); return _system_summary(db,user)

@app.post("/api/diagnostics/report.md")
def diagnostics_report(data: DiagnosticReportIn, pair=Depends(require_csrf), db: Session=Depends(get_db)):
    _,user=pair; limiter.check("diagnostics:report:"+user.id, 10, 3600)
    q,start_dt,end_dt=_diag_filters(db,user,start=data.start,end=data.end,level=data.level,component=data.component,event_code=data.event_code,project_id=data.project_id,job_id=data.job_id)
    limit=settings.diagnostic_report_max_events
    rows=q.order_by(DiagnosticEvent.first_occurred_at.asc(), DiagnosticEvent.id.asc()).limit(limit+1).all(); truncated=len(rows)>limit; rows=rows[:limit]
    by_level={k:0 for k in DiagnosticLevel.__members__}; by_comp={c.value:0 for c in DiagnosticComponent}
    for r in rows: by_level[r.level.value]+=r.occurrence_count; by_comp[r.component.value]+=r.occurrence_count
    summary=_system_summary(db,user); generated=utcnow().replace(tzinfo=None).isoformat()
    lines=["# Studio diagnostics report", "", f"Generated: {markdown_escape(generated)}", f"Selected period: {markdown_escape(start_dt.isoformat())} to {markdown_escape(end_dt.isoformat())}", "Redaction: report excludes secrets, URLs, filenames, raw JSON, transcript text, request/response bodies, stack traces, and user email.", "", "## Build identities", f"- Web: {markdown_escape(summary['build']['web'])}", f"- API: {markdown_escape(summary['build']['api'])}", f"- Worker: {markdown_escape(summary['build']['worker'])}", "", "## Environment summary", f"- Environment: {markdown_escape(summary['environment'])}", f"- Google Drive connected: {summary['google_drive']['connected']}", f"- Google Drive scope ready: {summary['google_drive']['scope_ready']}", f"- Active provider credentials: {summary['provider_credentials']['active_count']}", f"- Diagnostics recording enabled: {summary['diagnostics']['recording_enabled']}", f"- DEBUG recording: {markdown_escape(summary['diagnostics']['debug_recording'])}", "", "## Scope", f"- Project ID: {markdown_escape(data.project_id or 'all')}", f"- Job ID: {markdown_escape(data.job_id or 'all')}", "", "## Event counts by level"]
    lines += [f"- {k}: {v}" for k,v in by_level.items()] + ["", "## Event counts by component"] + [f"- {k}: {v}" for k,v in by_comp.items()] + ["", "## Chronological diagnostic timeline"]
    for r in rows:
        meta=", ".join(f"{markdown_escape(k)}={markdown_escape(v)}" for k,v in json.loads(r.metadata_json or '{}').items())
        lines.append(f"- {markdown_escape(r.first_occurred_at.isoformat())} | {r.level.value} | {r.component.value} | {markdown_escape(r.event_code)} | project={markdown_escape(r.project_id or '')} job={markdown_escape(r.job_id or '')} corr={markdown_escape(r.correlation_id or '')} req={markdown_escape(r.request_id or '')} occurrences={r.occurrence_count} metadata={meta}")
    lines += ["", "## Occurrence and deduplication counts", f"- Timeline rows: {len(rows)}", f"- Total occurrences: {sum(r.occurrence_count for r in rows)}", "", "## Truncation", f"- Truncated: {truncated}", "", "## Fields intentionally excluded", "- Security audit events, emails, titles, filenames, URLs, source bytes, transcript text, provider payloads, request/response bodies, stack traces, secrets, internal expiry, and deduplication fingerprints."]
    body="\n".join(lines)+"\n"
    return FastAPIResponse(content=body, media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="studio-diagnostics-report.md"', "Cache-Control": "no-store"})

def google_connection_payload(c: GoogleConnection|None):
    picker_configured=settings.google_picker_configured()
    scope_ready=bool(c and c.status == GoogleConnectionStatus.active and has_drive_file_scope(c.scopes))
    base={"connected": bool(c and c.status == GoogleConnectionStatus.active), "status": c.status.value if c else None, "google_email": c.google_email if c else None, "scopes": c.scopes if c else None, "connected_at": c.connected_at.isoformat() if c and c.connected_at else None, "revoked_at": c.revoked_at.isoformat() if c and c.revoked_at else None, "picker_configured": picker_configured, "picker_scope_ready": scope_ready, "picker_ready": bool(picker_configured and scope_ready)}
    if base["connected"] and not scope_ready:
        base["reconnect_required"] = True
    else:
        base["reconnect_required"] = False
    return base

def current_google_connection(db: Session, user: User) -> GoogleConnection|None:
    return db.query(GoogleConnection).filter_by(user_id=user.id, provider=GoogleProvider.google).first()

def google_config_or_503():
    from .google_oauth import GoogleOAuthConfigError, config_unavailable, load_google_oauth_config
    try:
        return load_google_oauth_config(settings)
    except GoogleOAuthConfigError:
        raise config_unavailable()

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

GOOGLE_OAUTH_RESULTS = {
    "connected",
    "cancelled",
    "invalid_callback",
    "invalid_state",
    "exchange_failed",
    "offline_access_missing",
}

def google_oauth_redirect(result: str) -> RedirectResponse:
    if result not in GOOGLE_OAUTH_RESULTS:
        result = "invalid_callback"
    base = settings.app_origin.rstrip("/")
    response = RedirectResponse(f"{base}/?google_oauth={result}", status_code=status.HTTP_303_SEE_OTHER)
    response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/api/google/oauth/callback")
def google_oauth_callback(state: str|None=None, code: str|None=None, error: str|None=None, db: Session=Depends(get_db)):
    if error:
        audit(db,"google.oauth_failed"); db.commit(); return google_oauth_redirect("cancelled")
    if not state or not code:
        return google_oauth_redirect("invalid_callback")
    row=db.query(GoogleOAuthState).filter_by(state_hash=token_hash(state)).first()
    if not row or row.used_at is not None or row.expires_at <= utcnow():
        return google_oauth_redirect("invalid_state")
    cfg=google_config_or_503()
    from .google_oauth import exchange_code_for_tokens
    try:
        tokens=exchange_code_for_tokens(cfg, code)
    except Exception:
        audit(db,"google.oauth_failed",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit(); return google_oauth_redirect("exchange_failed")
    if not tokens.refresh_token:
        audit(db,"google.oauth_failed",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit(); return google_oauth_redirect("offline_access_missing")
    conn=db.query(GoogleConnection).filter_by(user_id=row.user_id, provider=GoogleProvider.google).first()
    now=utcnow()
    if not conn:
        conn=GoogleConnection(user_id=row.user_id, provider=GoogleProvider.google, created_at=now)
        db.add(conn); db.flush()
    ct,nonce=encrypt(tokens.refresh_token, key(), google_token_aad(row.user_id, conn.id))
    conn.status=GoogleConnectionStatus.active; conn.google_subject=tokens.google_subject; conn.google_email=tokens.google_email; conn.scopes=tokens.scope or cfg.scopes; conn.refresh_token_ciphertext=ct; conn.refresh_token_nonce=nonce; conn.key_id=settings.credential_key_id; conn.connected_at=now; conn.revoked_at=None; conn.updated_at=now
    row.used_at=now
    audit(db,"google.connected",actor_user_id=row.user_id,subject_user_id=row.user_id); db.commit()
    return google_oauth_redirect("connected")

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
    try:
        return refresh_user_google_drive_access_token(db, user_id=user.id, settings=settings)
    except GoogleConnectionAccessError as exc:
        if exc.reason == GoogleConnectionAccessReason.missing:
            raise HTTPException(404, "Google Drive connection is not connected")
        if exc.reason == GoogleConnectionAccessReason.inactive:
            raise HTTPException(409, "Google Drive connection is not active")
        if exc.reason == GoogleConnectionAccessReason.config_unavailable:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")
        raise HTTPException(502, "Google Drive metadata is unavailable")

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
