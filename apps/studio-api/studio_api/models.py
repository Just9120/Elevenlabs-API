import enum, uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

def now(): return datetime.now(timezone.utc)
class UserRole(str, enum.Enum): admin="admin"; user="user"
class UserStatus(str, enum.Enum): active="active"; disabled="disabled"; deleted="deleted"
class CredentialProvider(str, enum.Enum): elevenlabs="elevenlabs"; openai="openai"
class CredentialStatus(str, enum.Enum): active="active"; revoked="revoked"; deleted="deleted"

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

class Project(Base):
    __tablename__="projects"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str]=mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str]=mapped_column(String(160))
    description: Mapped[str|None]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now, onupdate=now, index=True)
    archived_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), index=True)
    __table_args__=(Index("ix_projects_owner_active_updated", "owner_user_id", "archived_at", "updated_at"),)

class AuditEvent(Base):
    __tablename__="audit_events"
    id: Mapped[str]=mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    subject_user_id: Mapped[str|None]=mapped_column(String(36), index=True)
    event_type: Mapped[str]=mapped_column(String(80), index=True)
    metadata_json: Mapped[str]=mapped_column(Text, default="{}")
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=now)
