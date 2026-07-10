import enum, uuid
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, LargeBinary, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

def now(): return datetime.now(timezone.utc)
class UserRole(str, enum.Enum): admin="admin"; user="user"
class UserStatus(str, enum.Enum): active="active"; disabled="disabled"; deleted="deleted"
class CredentialProvider(str, enum.Enum): elevenlabs="elevenlabs"; openai="openai"
class CredentialStatus(str, enum.Enum): active="active"; revoked="revoked"; deleted="deleted"
class GoogleConnectionStatus(str, enum.Enum): active="active"; revoked="revoked"; error="error"
class GoogleProvider(str, enum.Enum): google="google"
class SourceType(str, enum.Enum): local_upload="local_upload"; google_drive="google_drive"
class SourceUploadStatus(str, enum.Enum): pending="pending"; uploaded="uploaded"; deleted="deleted"; expired="expired"; failed="failed"
class JobStatus(str, enum.Enum): queued="queued"; processing="processing"; cancelled="cancelled"; failed="failed"; completed="completed"
class JobSourceStatus(str, enum.Enum): queued="queued"; skipped="skipped"

class User(Base):
    __tablename__="users"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str]=mapped_column(String(320), unique=True, index=True)
    role: Mapped[UserRole]=mapped_column(Enum(UserRole), default=UserRole.user)
    status: Mapped[UserStatus]=mapped_column(Enum(UserStatus), default=UserStatus.active)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    disabled_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class LocalIdentity(Base):
    __tablename__="local_identities"
    user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), primary_key=True)
    password_hash: Mapped[str]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)

class Session(Base):
    __tablename__="sessions"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str]=mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str]=mapped_column(String(64))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class LoginContext(Base):
    __tablename__="login_contexts"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    csrf_hash: Mapped[str]=mapped_column(String(64), unique=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class ProviderCredential(Base):
    __tablename__="provider_credentials"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[CredentialProvider]=mapped_column(Enum(CredentialProvider))
    label: Mapped[str]=mapped_column(String(120))
    status: Mapped[CredentialStatus]=mapped_column(Enum(CredentialStatus), default=CredentialStatus.active)
    active_version_id: Mapped[str|None]=mapped_column(String(36))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    __table_args__=(UniqueConstraint("user_id","provider","label", name="uq_credential_label"),)

class ProviderCredentialVersion(Base):
    __tablename__="provider_credential_versions"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    credential_id: Mapped[str]=mapped_column(ForeignKey("provider_credentials.id"), index=True)
    version: Mapped[int]=mapped_column(Integer)
    ciphertext: Mapped[bytes|None]=mapped_column(LargeBinary)
    nonce: Mapped[bytes|None]=mapped_column(LargeBinary)
    key_id: Mapped[str]=mapped_column(String(80))
    masked_value: Mapped[str]=mapped_column(String(80))
    fingerprint: Mapped[str]=mapped_column(String(64))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    __table_args__=(UniqueConstraint("credential_id","version", name="uq_credential_version"),)


class GoogleConnection(Base):
    __tablename__="google_connections"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[GoogleProvider]=mapped_column(Enum(GoogleProvider), default=GoogleProvider.google)
    status: Mapped[GoogleConnectionStatus]=mapped_column(Enum(GoogleConnectionStatus), default=GoogleConnectionStatus.active, index=True)
    google_subject: Mapped[str|None]=mapped_column(String(255))
    google_email: Mapped[str|None]=mapped_column(String(320))
    scopes: Mapped[str|None]=mapped_column(Text)
    refresh_token_ciphertext: Mapped[bytes|None]=mapped_column(LargeBinary)
    refresh_token_nonce: Mapped[bytes|None]=mapped_column(LargeBinary)
    key_id: Mapped[str|None]=mapped_column(String(80))
    connected_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    __table_args__=(UniqueConstraint("user_id","provider", name="uq_google_connection_user_provider"),)

class GoogleOAuthState(Base):
    __tablename__="google_oauth_states"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str|None]=mapped_column(String(36), index=True)
    state_hash: Mapped[str]=mapped_column(String(64), unique=True, index=True)
    redirect_after: Mapped[str|None]=mapped_column(Text)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)

class Project(Base):
    __tablename__="projects"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str]=mapped_column(String(160))
    description: Mapped[str|None]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, index=True)
    archived_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    output_drive_folder_id: Mapped[str|None]=mapped_column(String(256))
    output_drive_folder_url: Mapped[str|None]=mapped_column(Text)
    output_drive_folder_name: Mapped[str|None]=mapped_column(String(512))
    sources: Mapped[list["Source"]]=relationship("Source", back_populates="project")
    jobs: Mapped[list["TranscriptionJob"]]=relationship("TranscriptionJob", back_populates="project")
    __table_args__=(Index("ix_projects_owner_active_updated", "owner_user_id", "archived_at", "updated_at"),)

class Source(Base):
    __tablename__="sources"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), index=True)
    source_type: Mapped[SourceType]=mapped_column(Enum(SourceType), index=True)
    original_filename: Mapped[str]=mapped_column(String(255))
    mime_type: Mapped[str|None]=mapped_column(String(255))
    size_bytes: Mapped[int|None]=mapped_column(Integer)
    drive_file_id: Mapped[str|None]=mapped_column(String(256))
    drive_file_url: Mapped[str|None]=mapped_column(Text)
    s3_bucket: Mapped[str|None]=mapped_column(String(255))
    s3_object_key: Mapped[str|None]=mapped_column(Text)
    upload_status: Mapped[SourceUploadStatus]=mapped_column(Enum(SourceUploadStatus), default=SourceUploadStatus.pending, index=True)
    uploaded_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    delete_reason: Mapped[str|None]=mapped_column(String(80))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    project: Mapped[Project]=relationship("Project", back_populates="sources")
    __table_args__=(Index("ix_sources_project_status", "project_id", "upload_status", "created_at"),)

class TranscriptionJob(Base):
    __tablename__="transcription_jobs"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), index=True)
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[JobStatus]=mapped_column(Enum(JobStatus), default=JobStatus.queued, index=True)
    provider: Mapped[str|None]=mapped_column(String(40))
    provider_credential_id: Mapped[str|None]=mapped_column(ForeignKey("provider_credentials.id"), index=True)
    title: Mapped[str|None]=mapped_column(String(160))
    language: Mapped[str|None]=mapped_column(String(40))
    options_json: Mapped[str|None]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    cancelled_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    cancel_requested_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    attempt_count: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"))
    started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    error_code: Mapped[str|None]=mapped_column(String(80))
    error_message: Mapped[str|None]=mapped_column(String(512))
    lease_owner_id: Mapped[str|None]=mapped_column(String(128))
    lease_generation: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"))
    claimed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    project: Mapped[Project]=relationship("Project", back_populates="jobs")
    sources: Mapped[list["TranscriptionJobSource"]]=relationship("TranscriptionJobSource", back_populates="job", order_by="TranscriptionJobSource.position")
    __table_args__=(Index("ix_transcription_jobs_project_status_created", "project_id", "status", "created_at"), Index("ix_transcription_jobs_status_lease_expires_created", "status", "lease_expires_at", "created_at"),)

class TranscriptionJobOutput(Base):
    __tablename__="transcription_job_outputs"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=False)
    job_source_id: Mapped[str]=mapped_column(ForeignKey("transcription_job_sources.id"), nullable=False)
    document_id: Mapped[str]=mapped_column(String(256), nullable=False)
    web_view_url: Mapped[str]=mapped_column(Text, nullable=False)
    output_drive_folder_id: Mapped[str]=mapped_column(String(256), nullable=False)
    output_kind: Mapped[str]=mapped_column(String(80), nullable=False)
    transcript_standard: Mapped[str]=mapped_column(String(80), nullable=False)
    document_character_count: Mapped[int]=mapped_column(Integer, nullable=False)
    document_created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    persisted_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    lease_generation: Mapped[int]=mapped_column(Integer, nullable=False)
    __table_args__=(CheckConstraint("document_character_count >= 0", name="ck_transcription_job_outputs_character_count_nonnegative"), UniqueConstraint("job_source_id", name="uq_transcription_job_outputs_job_source"), UniqueConstraint("document_id", name="uq_transcription_job_outputs_document_id"), Index("ix_transcription_job_outputs_job_id", "job_id"),)

class TranscriptionJobSource(Base):
    __tablename__="transcription_job_sources"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), index=True)
    source_id: Mapped[str]=mapped_column(ForeignKey("sources.id"), index=True)
    position: Mapped[int]=mapped_column(Integer)
    status: Mapped[JobSourceStatus]=mapped_column(Enum(JobSourceStatus), default=JobSourceStatus.queued)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    job: Mapped[TranscriptionJob]=relationship("TranscriptionJob", back_populates="sources")
    source: Mapped[Source]=relationship("Source")
    __table_args__=(UniqueConstraint("job_id", "source_id", name="uq_transcription_job_source"), Index("ix_transcription_job_sources_job_position", "job_id", "position"),)

class AuditEvent(Base):
    __tablename__="audit_events"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    subject_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    event_type: Mapped[str]=mapped_column(String(80), index=True)
    metadata_json: Mapped[str]=mapped_column(Text, default="{}")
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
