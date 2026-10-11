"""Transactional access mail. Synthetic transports can replace SMTP in tests.

SMTP is at-least-once: the stable Message-ID and fenced outbox prevent concurrent
duplicate sends, but a process crash after SMTP acceptance can cause a retry.
Reset tokens remain single-use; plaintext is never persisted or logged.
"""
import json
import secrets
import smtplib
import socket
import ssl
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from sqlalchemy import or_, select
from cryptography.exceptions import InvalidTag

from .models import LocalIdentity, PasswordResetChallenge, SecurityEmailDelivery, User, UserStatus
from .security import encrypt, decrypt, master_key_from_b64, token_hash

SECURITY_EVENTS = {
    "auth.password_reset_completed": "Пароль VoiceOps Studio изменён",
    "auth.totp_enabled": "Двухфакторная защита VoiceOps Studio включена",
    "auth.totp_disabled": "Двухфакторная защита VoiceOps Studio отключена",
    "auth.totp_recovery_rotated": "Коды восстановления VoiceOps Studio заменены",
    "auth.trusted_device_created": "Браузер добавлен в доверенные устройства VoiceOps Studio",
}


def _now(value=None):
    value = value or datetime.now(timezone.utc)
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def _aad(owner, delivery_id):
    return f"studio:security-email:{owner}:{delivery_id}".encode()


def enqueue_security_email(db, *, settings, user, kind, dedup_key, subject, body, expires_at, now=None):
    if not settings.security_email_configured() or user.status != UserStatus.active:
        return None
    existing = db.scalar(select(SecurityEmailDelivery.id).where(SecurityEmailDelivery.dedup_key == dedup_key))
    if existing:
        return existing
    delivery_id = str(uuid.uuid4())
    payload = json.dumps({"recipient": user.email, "subject": subject, "body": body}, ensure_ascii=False)
    ciphertext, nonce = encrypt(payload, master_key_from_b64(settings.master_key_b64()), _aad(user.id, delivery_id))
    db.add(SecurityEmailDelivery(id=delivery_id, owner_user_id=user.id, kind=kind, dedup_key=dedup_key,
        payload_ciphertext=ciphertext, payload_nonce=nonce, expires_at=_now(expires_at), created_at=_now(now)))
    return delivery_id


def request_reset_delivery(db, *, settings, user, fingerprint, now=None):
    current = _now(now)
    if not user or not db.get(LocalIdentity, user.id) or not settings.security_email_configured():
        return False
    # Serialize requests for this owner, revoke earlier unused challenges in the
    # same transaction. The HTTP response is identical for unknown accounts.
    db.execute(select(User.id).where(User.id == user.id).with_for_update(key_share=True)).all()
    db.query(PasswordResetChallenge).filter_by(user_id=user.id, used_at=None).update(
        {PasswordResetChallenge.used_at: current}, synchronize_session=False)
    db.query(SecurityEmailDelivery).filter(SecurityEmailDelivery.owner_user_id == user.id,
        SecurityEmailDelivery.kind == "password_reset", SecurityEmailDelivery.state.in_(["pending", "failed", "claimed"])).update(
        {SecurityEmailDelivery.state: "cancelled", SecurityEmailDelivery.payload_ciphertext: None,
         SecurityEmailDelivery.payload_nonce: None, SecurityEmailDelivery.finished_at: current}, synchronize_session=False)
    token = secrets.token_urlsafe(32)
    challenge_id = str(uuid.uuid4())
    expires_at = current + timedelta(minutes=15)
    db.add(PasswordResetChallenge(id=challenge_id, user_id=user.id, token_hash=token_hash(token),
        request_fingerprint=fingerprint, created_at=current, expires_at=expires_at))
    enqueue_security_email(db, settings=settings, user=user, kind="password_reset",
        dedup_key=f"reset:{challenge_id}", subject="Восстановление доступа к VoiceOps Studio",
        body=f"Для изменения пароля откройте ссылку. Она действует 15 минут и используется один раз.\n"
             f"{settings.app_origin}/#password-reset={token}\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.",
        expires_at=expires_at, now=current)
    return True


def enqueue_security_event(db, *, settings, user_id, event_type, event_id, now=None):
    if event_type not in SECURITY_EVENTS or not settings.security_email_configured():
        return
    user = db.get(User, user_id) if user_id else None
    if user is None:
        return
    enqueue_security_email(db, settings=settings, user=user, kind=event_type,
        dedup_key=f"audit:{event_id}", subject=SECURITY_EVENTS[event_type],
        body=f"В вашем аккаунте выполнено действие: {SECURITY_EVENTS[event_type]}.\n"
             f"Если это сделали не вы, проверьте активные сессии в настройках безопасности.\n{settings.app_origin}/settings/account",
        expires_at=_now(now) + timedelta(hours=24), now=now)


def _send(payload, *, delivery_id, settings, smtp_factory=None):
    message = EmailMessage()
    message["Subject"] = payload["subject"]
    message["From"] = str(settings.job_smtp_from_email)
    message["To"] = payload["recipient"]
    message["Message-ID"] = f"<{delivery_id}@{settings.security_email_sender_domain}>"
    message.set_content(payload["body"])
    factory = smtp_factory or (smtplib.SMTP_SSL if settings.job_smtp_use_ssl else smtplib.SMTP)
    try:
        with factory(settings.job_smtp_host, settings.job_smtp_port, timeout=settings.job_smtp_timeout_seconds) as smtp:
            if settings.job_smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.job_smtp_username:
                smtp.login(settings.job_smtp_username, settings.job_smtp_password())
            smtp.send_message(message)
        return None
    except (TimeoutError, socket.timeout):
        return "transport_timeout"
    except (OSError, smtplib.SMTPException):
        return "transport_unavailable"


def process_one_security_email(*, session_factory, settings, now=None, smtp_factory=None):
    current = _now(now)
    if not getattr(settings, "security_email_configured", lambda: False)():
        return False
    with session_factory() as db:
        row = db.scalar(select(SecurityEmailDelivery).where(
            or_(SecurityEmailDelivery.state.in_(["pending", "failed"]),
                (SecurityEmailDelivery.state == "claimed") & (SecurityEmailDelivery.claim_expires_at <= current)),
            or_(SecurityEmailDelivery.next_attempt_at.is_(None), SecurityEmailDelivery.next_attempt_at <= current),
        ).order_by(SecurityEmailDelivery.created_at, SecurityEmailDelivery.id).with_for_update(skip_locked=True).limit(1))
        if row is None:
            return False
        user = db.get(User, row.owner_user_id)
        if _now(row.expires_at) <= current or row.attempt_count >= 3 or not user or user.status != UserStatus.active:
            row.state = "expired"
            row.payload_ciphertext = row.payload_nonce = None
            row.finished_at = current
            db.commit()
            return True
        row.state = "claimed"
        row.attempt_count += 1
        claim = secrets.token_hex(24)
        row.claim_token = claim
        row.claim_expires_at = current + timedelta(seconds=60)
        delivery_id, owner = row.id, row.owner_user_id
        ciphertext, nonce = row.payload_ciphertext, row.payload_nonce
        db.commit()
    # No database transaction is held during network I/O.
    try:
        payload = json.loads(decrypt(ciphertext, nonce, master_key_from_b64(settings.master_key_b64()), _aad(owner, delivery_id)))
        error = _send(payload, delivery_id=delivery_id, settings=settings, smtp_factory=smtp_factory)
    except (ValueError, TypeError, KeyError, InvalidTag):
        error = "payload_unavailable"
    with session_factory() as db:
        row = db.scalar(select(SecurityEmailDelivery).where(SecurityEmailDelivery.id == delivery_id).with_for_update())
        if row is None or row.state != "claimed" or row.claim_token != claim:
            return True
        row.error_code = error
        row.claim_token = None
        row.claim_expires_at = None
        row.state = "sent" if error is None else "failed" if row.attempt_count < 3 else "exhausted"
        row.next_attempt_at = current + timedelta(seconds=60 * row.attempt_count) if row.state == "failed" else None
        if row.state != "failed":
            row.payload_ciphertext = row.payload_nonce = None
            row.finished_at = current
        db.commit()
    return True
