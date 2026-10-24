from __future__ import annotations

import base64
import hashlib
import hmac
from io import BytesIO
import secrets
import struct
import time
from urllib.parse import quote

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from qrcode.image.svg import SvgPathImage

from .security import token_hash


TOTP_DIGITS = 6
TOTP_PERIOD_SECONDS = 30
TOTP_WINDOW_STEPS = 1
RECOVERY_CODE_COUNT = 10


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_uri(*, secret: str, email: str, issuer: str = "VoiceOps Studio") -> str:
    label = quote(f"{issuer}:{email}")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
        f"&algorithm=SHA1&digits={TOTP_DIGITS}&period={TOTP_PERIOD_SECONDS}"
    )


def totp_qr_data_uri(uri: str) -> str:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=6,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    image = qr.make_image(image_factory=SvgPathImage)
    output = BytesIO()
    image.save(output)
    return "data:image/svg+xml;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def _decoded_secret(secret: str) -> bytes:
    normalized = "".join(str(secret).split()).upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    return base64.b32decode(normalized + padding, casefold=True)


def _totp(secret: str, counter: int) -> str:
    digest = hmac.new(
        _decoded_secret(secret),
        struct.pack(">Q", counter),
        hashlib.sha1,
    ).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10**TOTP_DIGITS)).zfill(TOTP_DIGITS)


def matched_totp_counter(secret: str, code: str, *, timestamp: int | None = None) -> int | None:
    normalized = "".join(ch for ch in str(code) if ch.isdigit())
    if len(normalized) != TOTP_DIGITS:
        return None
    counter = int(time.time() if timestamp is None else timestamp) // TOTP_PERIOD_SECONDS
    try:
        for offset in range(TOTP_WINDOW_STEPS, -TOTP_WINDOW_STEPS - 1, -1):
            candidate = counter + offset
            if candidate >= 0 and hmac.compare_digest(_totp(secret, candidate), normalized):
                return candidate
    except Exception:
        return None
    return None


def verify_totp(secret: str, code: str, *, timestamp: int | None = None) -> bool:
    return matched_totp_counter(secret, code, timestamp=timestamp) is not None


def consume_totp_code(db, *, factor, secret: str, code: str, timestamp: int | None = None) -> bool:
    """Consume the matched counter in the same transaction as the auth action."""
    from sqlalchemy import or_, update
    from .models import UserTotpFactor

    counter = matched_totp_counter(secret, code, timestamp=timestamp)
    if counter is None:
        return False
    # Conditional SQL rechecks replay and secret identity under the database
    # write lock, even if a concurrent request loaded the same ORM snapshot.
    result = db.execute(update(UserTotpFactor).where(
        UserTotpFactor.user_id == factor.user_id,
        UserTotpFactor.secret_nonce == factor.secret_nonce,
        UserTotpFactor.disabled_at.is_(None),
        or_(UserTotpFactor.last_used_counter.is_(None), UserTotpFactor.last_used_counter < counter),
    ).values(last_used_counter=counter).execution_options(synchronize_session=False))
    return result.rowcount == 1


def generate_recovery_codes() -> list[str]:
    return [
        f"{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
        for _ in range(RECOVERY_CODE_COUNT)
    ]


def recovery_code_hash(code: str) -> str:
    return token_hash("".join(str(code).split()).upper())


def totp_factor_aad(user_id: str) -> bytes:
    return f"user={user_id};purpose=totp-factor;version=1".encode("utf-8")
