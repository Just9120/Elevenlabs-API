import enum, uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Float, ForeignKey, Index, Integer, LargeBinary, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
from .source_policy import DEFAULT_SOURCE_RETENTION_TTL_SECONDS

def now(): return datetime.now(timezone.utc)
class UserRole(str, enum.Enum): admin="admin"; user="user"
class UserStatus(str, enum.Enum): active="active"; disabled="disabled"; deleted="deleted"
class CredentialProvider(str, enum.Enum): elevenlabs="elevenlabs"; openai="openai"
class CredentialStatus(str, enum.Enum): active="active"; revoked="revoked"; deleted="deleted"
class GoogleConnectionStatus(str, enum.Enum): active="active"; revoked="revoked"; error="error"
class GoogleProvider(str, enum.Enum): google="google"
class SourceType(str, enum.Enum): local_upload="local_upload"; google_drive="google_drive"
class SourceUploadStatus(str, enum.Enum): pending="pending"; uploaded="uploaded"; deleted="deleted"; expired="expired"; failed="failed"
class SourceStorageCleanupStatus(str, enum.Enum): not_requested="not_requested"; not_applicable="not_applicable"; pending="pending"; completed="completed"; failed="failed"
class JobStatus(str, enum.Enum): queued="queued"; processing="processing"; cancelled="cancelled"; failed="failed"; completed="completed"
class AudioPreparationStatus(str, enum.Enum): preview_queued="preview_queued"; analyzing="analyzing"; preview_ready="preview_ready"; queued="queued"; processing="processing"; cancelled="cancelled"; failed="failed"; completed="completed"
class JobSourceStatus(str, enum.Enum): queued="queued"; skipped="skipped"
class OutputReconciliationStatus(str, enum.Enum): prepared="prepared"; creation_returned="creation_returned"; reconciliation_required="reconciliation_required"; resolved="resolved"; conflict="conflict"
class SourceAttemptStage(str, enum.Enum): prepared="prepared"; provider_request_started="provider_request_started"; provider_response_returned="provider_response_returned"; google_handoff="google_handoff"; output_persisted="output_persisted"; failed="failed"
class SourceAttemptRetryDisposition(str, enum.Enum): undetermined="undetermined"; retry_safe="retry_safe"; provider_outcome_uncertain="provider_outcome_uncertain"; provider_result_lost="provider_result_lost"; output_reconciliation_required="output_reconciliation_required"; non_retryable="non_retryable"; completed="completed"
class DiagnosticLevel(str, enum.Enum): ERROR="ERROR"; WARNING="WARNING"; INFO="INFO"; DEBUG="DEBUG"
class DiagnosticComponent(str, enum.Enum): web="web"; api="api"; worker="worker"
class TranscriptCatalogDocumentStandardStatus(str, enum.Enum): current="current"; outdated="outdated"; unstructured="unstructured"; unreadable="unreadable"
class TranscriptCatalogSettingsStatus(str, enum.Enum): exact="exact"; indeterminate="indeterminate"
class TranscriptCatalogSourceIdentityKind(str, enum.Enum): google_drive_file="google_drive_file"; studio_source="studio_source"

class User(Base):
    __tablename__="users"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str]=mapped_column(String(320), unique=True, index=True)
    role: Mapped[UserRole]=mapped_column(Enum(UserRole), default=UserRole.user)
    status: Mapped[UserStatus]=mapped_column(Enum(UserStatus), default=UserStatus.active)
    source_retention_ttl_seconds: Mapped[int]=mapped_column(Integer, default=DEFAULT_SOURCE_RETENTION_TTL_SECONDS, server_default=text(str(DEFAULT_SOURCE_RETENTION_TTL_SECONDS)), nullable=False)
    accent_color: Mapped[str]=mapped_column(String(20), default="blue", server_default=text("'blue'"), nullable=False)
    manifest_reset_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    disabled_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    __table_args__=(CheckConstraint("source_retention_ttl_seconds IN (3600, 86400, 259200, 604800, 2592000)", name="ck_users_source_retention_ttl_allowed"), CheckConstraint("accent_color IN ('blue', 'violet', 'teal', 'rose')", name="ck_users_accent_color_allowed"),)

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
    maintenance_google_subject: Mapped[str|None]=mapped_column(String(255))
    maintenance_google_email: Mapped[str|None]=mapped_column(String(320))
    maintenance_scopes: Mapped[str|None]=mapped_column(Text)
    maintenance_refresh_token_ciphertext: Mapped[bytes|None]=mapped_column(LargeBinary)
    maintenance_refresh_token_nonce: Mapped[bytes|None]=mapped_column(LargeBinary)
    maintenance_key_id: Mapped[str|None]=mapped_column(String(80))
    maintenance_connected_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    maintenance_revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
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
    purpose: Mapped[str]=mapped_column(String(32), default="primary")
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
    history_reset_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    analytics_reset_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    sources: Mapped[list["Source"]]=relationship("Source", back_populates="project")
    jobs: Mapped[list["TranscriptionJob"]]=relationship("TranscriptionJob", back_populates="project")
    __table_args__=(Index("ix_projects_owner_active_updated", "owner_user_id", "archived_at", "updated_at"),)

class OutputFolderFavorite(Base):
    __tablename__="output_folder_favorites"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    drive_folder_id: Mapped[str]=mapped_column(String(256), nullable=False)
    name: Mapped[str]=mapped_column(String(512), nullable=False)
    web_view_url: Mapped[str]=mapped_column(Text, nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now, onupdate=now)
    __table_args__=(UniqueConstraint("owner_user_id", "drive_folder_id", name="uq_output_folder_favorites_owner_folder"), Index("ix_output_folder_favorites_owner_updated", "owner_user_id", "updated_at"),)

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
    source_created_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    source_created_at_provenance: Mapped[str|None]=mapped_column(String(40))
    expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    delete_reason: Mapped[str|None]=mapped_column(String(80))
    storage_cleanup_status: Mapped[SourceStorageCleanupStatus]=mapped_column(Enum(SourceStorageCleanupStatus), default=SourceStorageCleanupStatus.not_requested, server_default=text("'not_requested'"), nullable=False)
    storage_cleanup_requested_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    storage_cleanup_not_before_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    storage_cleanup_completed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    storage_cleanup_attempt_count: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    storage_cleanup_error_code: Mapped[str|None]=mapped_column(String(80))
    storage_cleanup_owner_id: Mapped[str|None]=mapped_column(String(128))
    storage_cleanup_generation: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    storage_cleanup_claimed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    storage_cleanup_lease_expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    project: Mapped[Project]=relationship("Project", back_populates="sources")
    __table_args__=(Index("ix_sources_project_status", "project_id", "upload_status", "created_at"), Index("ix_sources_storage_cleanup_selection", "storage_cleanup_status", "storage_cleanup_not_before_at", "storage_cleanup_lease_expires_at"), CheckConstraint("storage_cleanup_attempt_count >= 0", name="ck_sources_storage_cleanup_attempt_count_nonnegative"), CheckConstraint("storage_cleanup_generation >= 0", name="ck_sources_storage_cleanup_generation_nonnegative"), CheckConstraint("((source_created_at IS NULL AND source_created_at_provenance IS NULL) OR (source_created_at IS NOT NULL AND source_created_at_provenance IN ('google_drive_created_time', 'embedded_media_metadata')))", name="ck_sources_creation_authority"),)

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
    output_drive_folder_id: Mapped[str|None]=mapped_column(String(256))
    output_drive_folder_url: Mapped[str|None]=mapped_column(Text)
    output_drive_folder_name: Mapped[str|None]=mapped_column(String(512))
    batch_idempotency_key: Mapped[str|None]=mapped_column(String(128))
    batch_request_hash: Mapped[str|None]=mapped_column(String(64))
    batch_position: Mapped[int|None]=mapped_column(Integer)
    media_clip_start_seconds: Mapped[int|None]=mapped_column(Integer)
    media_clip_end_seconds: Mapped[int|None]=mapped_column(Integer)
    terminal_dismissed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
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
    speakers: Mapped[list["TranscriptionJobSpeaker"]]=relationship("TranscriptionJobSpeaker", order_by="TranscriptionJobSpeaker.display_ordinal")
    __table_args__=(Index("ix_transcription_jobs_project_status_created", "project_id", "status", "created_at"), Index("ix_transcription_jobs_status_lease_expires_created", "status", "lease_expires_at", "created_at"), CheckConstraint("((batch_idempotency_key IS NULL AND batch_request_hash IS NULL AND batch_position IS NULL) OR (batch_idempotency_key IS NOT NULL AND batch_request_hash IS NOT NULL AND batch_position IS NOT NULL AND batch_position >= 0))", name="ck_transcription_jobs_batch_fields_all_or_none"), CheckConstraint("((media_clip_start_seconds IS NULL AND media_clip_end_seconds IS NULL) OR (COALESCE(media_clip_start_seconds, 0) >= 0 AND COALESCE(media_clip_start_seconds, 0) <= 604800 AND (media_clip_end_seconds IS NULL OR (media_clip_end_seconds > COALESCE(media_clip_start_seconds, 0) AND media_clip_end_seconds <= 604800)) AND NOT (media_clip_start_seconds = 0 AND media_clip_end_seconds IS NULL)))", name="ck_transcription_jobs_media_clip_range"), UniqueConstraint("owner_user_id", "project_id", "batch_idempotency_key", "batch_position", name="uq_transcription_jobs_batch_position"),)

    def apply_output_folder_snapshot(self, *, folder_id=None, folder_url=None, folder_name=None):
        from .job_output_folder_selection import normalize_drive_id, normalize_drive_url, normalize_optional_name
        self.output_drive_folder_id = normalize_drive_id(folder_id, "ID папки Google Drive")
        self.output_drive_folder_url = normalize_drive_url(folder_url)
        self.output_drive_folder_name = normalize_optional_name(folder_name)
        if not self.output_drive_folder_id:
            self.output_drive_folder_url = None
            self.output_drive_folder_name = None
        return self

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

class TranscriptCatalogEntry(Base):
    __tablename__="transcript_catalog_entries"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    document_id: Mapped[str]=mapped_column(String(256), nullable=False)
    document_name: Mapped[str]=mapped_column(String(240), nullable=False)
    transcript_standard: Mapped[str]=mapped_column(String(80), nullable=False)
    standard_status: Mapped[TranscriptCatalogDocumentStandardStatus]=mapped_column(Enum(TranscriptCatalogDocumentStandardStatus), nullable=False)
    settings_status: Mapped[TranscriptCatalogSettingsStatus]=mapped_column(Enum(TranscriptCatalogSettingsStatus), nullable=False)
    provider: Mapped[str|None]=mapped_column(String(40))
    model: Mapped[str|None]=mapped_column(String(80))
    language_mode: Mapped[str|None]=mapped_column(String(40))
    diarization_enabled: Mapped[bool|None]=mapped_column(Boolean)
    source_identity_kind: Mapped[TranscriptCatalogSourceIdentityKind|None]=mapped_column(Enum(TranscriptCatalogSourceIdentityKind))
    source_identity_value: Mapped[str|None]=mapped_column(String(256))
    imported_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    __table_args__=(
        CheckConstraint("length(trim(document_id)) > 0", name="ck_transcript_catalog_document_id_nonempty"),
        CheckConstraint("length(trim(document_name)) > 0", name="ck_transcript_catalog_document_name_nonempty"),
        CheckConstraint("length(trim(transcript_standard)) > 0", name="ck_transcript_catalog_standard_nonempty"),
        CheckConstraint("((source_identity_kind IS NULL AND source_identity_value IS NULL) OR (source_identity_kind IS NOT NULL AND source_identity_value IS NOT NULL AND length(trim(source_identity_value)) > 0))", name="ck_transcript_catalog_source_authority"),
        CheckConstraint("((settings_status = 'indeterminate' AND provider IS NULL AND model IS NULL AND language_mode IS NULL AND diarization_enabled IS NULL) OR (settings_status = 'exact' AND provider IS NOT NULL AND length(trim(provider)) > 0 AND model IS NOT NULL AND length(trim(model)) > 0 AND language_mode IS NOT NULL AND length(trim(language_mode)) > 0 AND diarization_enabled IS NOT NULL))", name="ck_transcript_catalog_settings_authority"),
        UniqueConstraint("owner_user_id", "document_id", name="uq_transcript_catalog_owner_document"),
        Index("ix_transcript_catalog_owner_updated", "owner_user_id", "updated_at"),
        Index("ix_transcript_catalog_owner_source_settings", "owner_user_id", "source_identity_kind", "source_identity_value", "provider", "model", "language_mode", "diarization_enabled"),
    )

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


class AudioPreparationJob(Base):
    __tablename__="audio_preparation_jobs"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[AudioPreparationStatus]=mapped_column(Enum(AudioPreparationStatus, native_enum=False, length=32), default=AudioPreparationStatus.preview_queued, nullable=False, index=True)
    title: Mapped[str]=mapped_column(String(160), nullable=False)
    options_json: Mapped[str]=mapped_column(Text, nullable=False)
    output_destination: Mapped[str]=mapped_column(String(24), nullable=False, default="download", server_default=text("'download'"))
    output_drive_folder_id: Mapped[str|None]=mapped_column(String(256))
    output_drive_folder_url: Mapped[str|None]=mapped_column(Text)
    output_drive_folder_name: Mapped[str|None]=mapped_column(String(512))
    output_source_id: Mapped[str|None]=mapped_column(ForeignKey("sources.id"), unique=True)
    output_drive_file_id: Mapped[str|None]=mapped_column(String(256), unique=True)
    output_drive_web_view_url: Mapped[str|None]=mapped_column(Text)
    total_input_duration_ms: Mapped[int|None]=mapped_column(Integer)
    estimated_output_duration_ms: Mapped[int|None]=mapped_column(Integer)
    output_duration_ms: Mapped[int|None]=mapped_column(Integer)
    copy_compatible: Mapped[bool|None]=mapped_column(Boolean)
    current_stage: Mapped[str]=mapped_column(String(40), nullable=False, default="queued", server_default=text("'queued'"))
    progress_percent: Mapped[int]=mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    cancel_requested_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    error_code: Mapped[str|None]=mapped_column(String(80))
    lease_owner_id: Mapped[str|None]=mapped_column(String(128))
    lease_generation: Mapped[int]=mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    claimed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    inputs: Mapped[list["AudioPreparationJobInput"]]=relationship("AudioPreparationJobInput", back_populates="job", order_by="AudioPreparationJobInput.position")
    __table_args__=(
        CheckConstraint("output_destination IN ('download','google_drive')", name="ck_audio_preparation_jobs_destination"),
        CheckConstraint("progress_percent >= 0 AND progress_percent <= 100", name="ck_audio_preparation_jobs_progress"),
        CheckConstraint("total_input_duration_ms IS NULL OR total_input_duration_ms > 0", name="ck_audio_preparation_jobs_input_duration"),
        CheckConstraint("estimated_output_duration_ms IS NULL OR estimated_output_duration_ms >= 0", name="ck_audio_preparation_jobs_estimated_duration"),
        CheckConstraint("output_duration_ms IS NULL OR output_duration_ms > 0", name="ck_audio_preparation_jobs_output_duration"),
        CheckConstraint("lease_generation >= 0", name="ck_audio_preparation_jobs_lease_generation"),
        CheckConstraint("((output_destination = 'download' AND output_drive_folder_id IS NULL AND output_drive_folder_url IS NULL AND output_drive_folder_name IS NULL) OR (output_destination = 'google_drive' AND output_drive_folder_id IS NOT NULL AND output_drive_folder_url IS NOT NULL AND output_drive_folder_name IS NOT NULL))", name="ck_audio_preparation_jobs_destination_snapshot"),
        CheckConstraint("((output_drive_file_id IS NULL AND output_drive_web_view_url IS NULL) OR (output_drive_file_id IS NOT NULL AND output_drive_web_view_url IS NOT NULL))", name="ck_audio_preparation_jobs_drive_output_complete"),
        Index("ix_audio_preparation_jobs_owner_created", "owner_user_id", "created_at"),
        Index("ix_audio_preparation_jobs_claim", "status", "lease_expires_at", "created_at"),
    )


class AudioPreparationJobInput(Base):
    __tablename__="audio_preparation_job_inputs"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str]=mapped_column(ForeignKey("audio_preparation_jobs.id"), nullable=False, index=True)
    source_id: Mapped[str]=mapped_column(ForeignKey("sources.id"), nullable=False, index=True)
    position: Mapped[int]=mapped_column(Integer, nullable=False)
    ephemeral_reference: Mapped[bool]=mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, nullable=False)
    job: Mapped[AudioPreparationJob]=relationship("AudioPreparationJob", back_populates="inputs")
    source: Mapped[Source]=relationship("Source")
    __table_args__=(
        UniqueConstraint("job_id", "source_id", name="uq_audio_preparation_job_inputs_source"),
        UniqueConstraint("job_id", "position", name="uq_audio_preparation_job_inputs_position"),
        CheckConstraint("position >= 0 AND position < 50", name="ck_audio_preparation_job_inputs_position"),
        Index("ix_audio_preparation_job_inputs_job_position", "job_id", "position"),
    )


class SpeakerProfile(Base):
    __tablename__="speaker_profiles"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    display_name: Mapped[str]=mapped_column(String(160), nullable=False)
    normalized_name: Mapped[str]=mapped_column(String(160), nullable=False)
    role: Mapped[str]=mapped_column(String(120), nullable=False)
    active: Mapped[bool]=mapped_column(Boolean, default=True, server_default=text("true"), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    __table_args__=(
        UniqueConstraint("owner_user_id", "normalized_name", name="uq_speaker_profiles_owner_normalized_name"),
        CheckConstraint("length(trim(display_name)) > 0", name="ck_speaker_profiles_display_name_nonempty"),
        CheckConstraint("length(trim(normalized_name)) > 0", name="ck_speaker_profiles_normalized_name_nonempty"),
        CheckConstraint("length(trim(role)) > 0", name="ck_speaker_profiles_role_nonempty"),
        Index("ix_speaker_profiles_owner_active_updated", "owner_user_id", "active", "updated_at"),
    )


class TranscriptionJobSpeaker(Base):
    __tablename__="transcription_job_speakers"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=False)
    job_source_id: Mapped[str]=mapped_column(ForeignKey("transcription_job_sources.id"), nullable=False)
    provider_speaker_label: Mapped[str]=mapped_column(String(160), nullable=False)
    display_ordinal: Mapped[int]=mapped_column(Integer, nullable=False)
    sample_start_ms: Mapped[int]=mapped_column(Integer, nullable=False)
    sample_end_ms: Mapped[int]=mapped_column(Integer, nullable=False)
    speaker_profile_id: Mapped[str|None]=mapped_column(ForeignKey("speaker_profiles.id"))
    applied_display_name: Mapped[str|None]=mapped_column(String(160))
    applied_role: Mapped[str|None]=mapped_column(String(120))
    applied_document_label: Mapped[str|None]=mapped_column(String(320))
    assigned_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    __table_args__=(
        UniqueConstraint("job_source_id", "provider_speaker_label", name="uq_transcription_job_speakers_source_provider_label"),
        UniqueConstraint("job_source_id", "display_ordinal", name="uq_transcription_job_speakers_source_ordinal"),
        CheckConstraint("display_ordinal >= 1", name="ck_transcription_job_speakers_ordinal_positive"),
        CheckConstraint("sample_start_ms >= 0 AND sample_end_ms > sample_start_ms AND sample_end_ms - sample_start_ms <= 8000", name="ck_transcription_job_speakers_sample_bounded"),
        CheckConstraint("((speaker_profile_id IS NULL AND applied_display_name IS NULL AND applied_role IS NULL AND applied_document_label IS NULL AND assigned_at IS NULL) OR (speaker_profile_id IS NOT NULL AND applied_display_name IS NOT NULL AND applied_role IS NOT NULL AND applied_document_label IS NOT NULL AND assigned_at IS NOT NULL))", name="ck_transcription_job_speakers_assignment_complete"),
        Index("ix_transcription_job_speakers_owner_job", "owner_user_id", "job_id", "display_ordinal"),
        Index("ix_transcription_job_speakers_profile", "speaker_profile_id"),
    )




class TranscriptionJobSourceAttempt(Base):
    __tablename__="transcription_job_source_attempts"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), nullable=False)
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=False)
    job_source_id: Mapped[str]=mapped_column(ForeignKey("transcription_job_sources.id"), nullable=False)
    attempt_number: Mapped[int]=mapped_column(Integer, nullable=False)
    stage: Mapped[SourceAttemptStage]=mapped_column(Enum(SourceAttemptStage), nullable=False, default=SourceAttemptStage.prepared)
    retry_disposition: Mapped[SourceAttemptRetryDisposition]=mapped_column(Enum(SourceAttemptRetryDisposition), nullable=False, default=SourceAttemptRetryDisposition.undetermined)
    failure_code: Mapped[str|None]=mapped_column(String(80))
    provider_failure_code: Mapped[str|None]=mapped_column(String(80))
    provider_request_started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    provider_response_returned_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    provider_total_parts: Mapped[int|None]=mapped_column(Integer)
    provider_completed_parts: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"))
    failed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now, onupdate=now)
    __table_args__=(
        UniqueConstraint("job_source_id", "attempt_number", name="uq_source_attempt_job_source_attempt"),
        CheckConstraint("attempt_number >= 1", name="ck_source_attempt_attempt_number_positive"),
        CheckConstraint("provider_total_parts IS NULL OR provider_total_parts > 0", name="ck_source_attempt_provider_total_parts_positive"),
        CheckConstraint("provider_completed_parts >= 0", name="ck_source_attempt_provider_completed_parts_nonnegative"),
        CheckConstraint("provider_total_parts IS NULL OR provider_completed_parts <= provider_total_parts", name="ck_source_attempt_provider_parts_bounded"),
        Index("ix_source_attempts_job_id", "job_id"),
        Index("ix_source_attempts_job_source_id", "job_source_id"),
        Index("ix_source_attempts_retry_disposition", "retry_disposition"),
        Index("ix_source_attempts_job_retry_disposition", "job_id", "retry_disposition"),
    )

class TranscriptionProviderPartCheckpoint(Base):
    __tablename__="transcription_provider_part_checkpoints"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), nullable=False)
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=False)
    job_source_id: Mapped[str]=mapped_column(ForeignKey("transcription_job_sources.id"), nullable=False)
    part_index: Mapped[int]=mapped_column(Integer, nullable=False)
    total_parts: Mapped[int]=mapped_column(Integer, nullable=False)
    timeline_offset_seconds: Mapped[float]=mapped_column(Float, nullable=False)
    duration_seconds: Mapped[float]=mapped_column(Float, nullable=False)
    provider: Mapped[str]=mapped_column(String(40), nullable=False)
    model: Mapped[str]=mapped_column(String(80), nullable=False)
    ciphertext: Mapped[bytes]=mapped_column(LargeBinary, nullable=False)
    nonce: Mapped[bytes]=mapped_column(LargeBinary, nullable=False)
    key_id: Mapped[str]=mapped_column(String(80), nullable=False)
    payload_hmac: Mapped[str]=mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__=(
        UniqueConstraint("job_source_id", "part_index", name="uq_provider_part_checkpoint_source_part"),
        CheckConstraint("part_index >= 0", name="ck_provider_part_checkpoint_index_nonnegative"),
        CheckConstraint("total_parts > 1", name="ck_provider_part_checkpoint_total_parts_multiple"),
        CheckConstraint("part_index < total_parts", name="ck_provider_part_checkpoint_index_bounded"),
        CheckConstraint("timeline_offset_seconds >= 0", name="ck_provider_part_checkpoint_offset_nonnegative"),
        CheckConstraint("duration_seconds > 0", name="ck_provider_part_checkpoint_duration_positive"),
        CheckConstraint("length(payload_hmac) = 64", name="ck_provider_part_checkpoint_hmac_length"),
        Index("ix_provider_part_checkpoints_job_source", "job_source_id", "part_index"),
        Index("ix_provider_part_checkpoints_expiry", "expires_at"),
        Index("ix_provider_part_checkpoints_job", "job_id"),
    )

class RealtimeTranscriptDraft(Base):
    __tablename__="realtime_transcript_drafts"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), nullable=False)
    client_session_id: Mapped[str]=mapped_column(String(64), nullable=False)
    revision: Mapped[int]=mapped_column(Integer, nullable=False)
    ciphertext: Mapped[bytes]=mapped_column(LargeBinary, nullable=False)
    nonce: Mapped[bytes]=mapped_column(LargeBinary, nullable=False)
    key_id: Mapped[str]=mapped_column(String(80), nullable=False)
    payload_hmac: Mapped[str]=mapped_column(String(64), nullable=False)
    committed_segment_count: Mapped[int]=mapped_column(Integer, nullable=False)
    committed_character_count: Mapped[int]=mapped_column(Integer, nullable=False)
    partial_character_count: Mapped[int]=mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now, onupdate=now)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__=(
        UniqueConstraint("owner_user_id", "client_session_id", name="uq_realtime_drafts_owner_client_session"),
        CheckConstraint("revision >= 1", name="ck_realtime_drafts_revision_positive"),
        CheckConstraint("committed_segment_count >= 0", name="ck_realtime_drafts_segment_count_nonnegative"),
        CheckConstraint("committed_character_count >= 0", name="ck_realtime_drafts_committed_chars_nonnegative"),
        CheckConstraint("partial_character_count >= 0", name="ck_realtime_drafts_partial_chars_nonnegative"),
        CheckConstraint("length(payload_hmac) = 64", name="ck_realtime_drafts_hmac_length"),
        Index("ix_realtime_drafts_owner_project_updated", "owner_user_id", "project_id", "updated_at"),
        Index("ix_realtime_drafts_expiry", "expires_at"),
    )

class TranscriptionOutputReconciliation(Base):
    __tablename__="transcription_output_reconciliations"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), nullable=False)
    job_id: Mapped[str]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=False)
    job_source_id: Mapped[str]=mapped_column(ForeignKey("transcription_job_sources.id"), nullable=False)
    reconciliation_token: Mapped[str]=mapped_column(String(128), nullable=False, unique=True)
    lease_generation: Mapped[int]=mapped_column(Integer, nullable=False)
    attempt_number: Mapped[int]=mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    status: Mapped[OutputReconciliationStatus]=mapped_column(Enum(OutputReconciliationStatus), nullable=False, default=OutputReconciliationStatus.prepared)
    uncertainty_reason: Mapped[str|None]=mapped_column(String(80))
    expected_output_drive_folder_id: Mapped[str]=mapped_column(String(256), nullable=False)
    expected_document_title: Mapped[str|None]=mapped_column(String(160))
    expected_document_title_hash: Mapped[str|None]=mapped_column(String(64))
    expected_document_character_count: Mapped[int]=mapped_column(Integer, nullable=False)
    prepared_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    creation_started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    returned_document_id: Mapped[str|None]=mapped_column(String(256), unique=True)
    returned_web_view_url: Mapped[str|None]=mapped_column(Text)
    returned_document_created_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    last_checked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    resolved_output_id: Mapped[str|None]=mapped_column(ForeignKey("transcription_job_outputs.id"), unique=True)
    resolved_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now, onupdate=now)
    __table_args__=(
        UniqueConstraint("job_source_id", name="uq_output_reconciliations_job_source"),
        UniqueConstraint("owner_user_id","project_id","job_id","job_source_id", name="uq_output_reconciliations_scope"),
        CheckConstraint("expected_document_character_count >= 0", name="ck_output_reconciliations_character_count_nonnegative"),
        Index("ix_output_reconciliations_owner_user_id", "owner_user_id"),
        Index("ix_output_reconciliations_project_id", "project_id"),
        Index("ix_output_reconciliations_job_id", "job_id"),
        Index("ix_output_reconciliations_status", "status"),
        Index("ix_output_reconciliations_job_status", "job_id", "status"),
    )

class AuditEvent(Base):
    __tablename__="audit_events"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    subject_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    event_type: Mapped[str]=mapped_column(String(80), index=True)
    metadata_json: Mapped[str]=mapped_column(Text, default="{}")
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)


class DiagnosticDebugSession(Base):
    __tablename__="diagnostic_debug_sessions"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False, unique=True, index=True)
    started_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__=(
        CheckConstraint("expires_at > started_at", name="ck_diagnostic_debug_sessions_expires_after_start"),
        Index("ix_diagnostic_debug_sessions_owner_active", "owner_user_id", "ended_at", "expires_at"),
    )


class DiagnosticEvent(Base):
    __tablename__="diagnostic_events"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[str|None]=mapped_column(ForeignKey("projects.id"), nullable=True)
    job_id: Mapped[str|None]=mapped_column(ForeignKey("transcription_jobs.id"), nullable=True)
    level: Mapped[DiagnosticLevel]=mapped_column(Enum(DiagnosticLevel), nullable=False)
    component: Mapped[DiagnosticComponent]=mapped_column(Enum(DiagnosticComponent), nullable=False)
    event_code: Mapped[str]=mapped_column(String(80), nullable=False)
    correlation_id: Mapped[str|None]=mapped_column(String(128))
    request_id: Mapped[str|None]=mapped_column(String(128))
    metadata_json: Mapped[str]=mapped_column(Text, nullable=False, default="{}")
    first_occurred_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    last_occurred_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False, default=now)
    occurrence_count: Mapped[int]=mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    dedup_fingerprint: Mapped[str]=mapped_column(String(64), nullable=False, unique=True)
    dedup_bucket: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__=(
        CheckConstraint("level IN ('ERROR','WARNING','INFO','DEBUG')", name="ck_diagnostic_events_level"),
        CheckConstraint("component IN ('web','api','worker')", name="ck_diagnostic_events_component"),
        CheckConstraint("occurrence_count >= 1", name="ck_diagnostic_events_occurrence_count"),
        Index("ix_diagnostic_events_owner_time", "owner_user_id", "first_occurred_at"),
        Index("ix_diagnostic_events_owner_project_time", "owner_user_id", "project_id", "first_occurred_at"),
        Index("ix_diagnostic_events_owner_job_time", "owner_user_id", "job_id", "first_occurred_at"),
        Index("ix_diagnostic_events_owner_component_level_time", "owner_user_id", "component", "level", "first_occurred_at"),
        Index("ix_diagnostic_events_expires_at", "expires_at"),
    )


class RuntimeComponentStatus(Base):
    __tablename__="runtime_component_status"
    component: Mapped[str]=mapped_column(String(20), primary_key=True)
    instance_id: Mapped[str]=mapped_column(String(128), nullable=False)
    release_version: Mapped[str]=mapped_column(String(120), nullable=False)
    build_id: Mapped[str]=mapped_column(String(120), nullable=False)
    commit_sha: Mapped[str]=mapped_column(String(40), nullable=False)
    started_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__=(
        CheckConstraint("component IN ('worker')", name="ck_runtime_component_status_component"),
    )
