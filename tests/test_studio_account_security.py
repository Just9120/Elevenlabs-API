from __future__ import annotations

import base64
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_rfc6238_sha1_totp_vector_and_bounded_window():
    from studio_api.account_security import verify_totp

    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert verify_totp(secret, "287082", timestamp=59)
    assert verify_totp(secret, "287082", timestamp=60)
    assert not verify_totp(secret, "287082", timestamp=120)
    assert not verify_totp(secret, "wrong", timestamp=59)


def test_totp_enrollment_material_is_standard_and_qr_is_local_data():
    from studio_api.account_security import totp_qr_data_uri, totp_uri

    uri = totp_uri(
        secret="JBSWY3DPEHPK3PXP",
        email="owner+studio@example.com",
    )
    assert uri.startswith("otpauth://totp/VoiceOps%20Studio%3Aowner%2Bstudio%40example.com?")
    assert "secret=JBSWY3DPEHPK3PXP" in uri
    assert "issuer=VoiceOps%20Studio" in uri
    assert "algorithm=SHA1&digits=6&period=30" in uri

    data_uri = totp_qr_data_uri(uri)
    assert data_uri.startswith("data:image/svg+xml;base64,")
    svg = base64.b64decode(data_uri.split(",", 1)[1])
    assert svg.startswith(b"<?xml")
    assert b"<svg" in svg
    assert uri.encode() not in svg


def test_recovery_codes_are_one_time_shapes_and_hash_normalized():
    from studio_api.account_security import (
        RECOVERY_CODE_COUNT,
        generate_recovery_codes,
        recovery_code_hash,
    )

    codes = generate_recovery_codes()
    assert len(codes) == RECOVERY_CODE_COUNT
    assert len(set(codes)) == RECOVERY_CODE_COUNT
    assert all(re.fullmatch(r"[0-9A-F]{8}-[0-9A-F]{8}", code) for code in codes)
    first = codes[0]
    assert recovery_code_hash(first) == recovery_code_hash(first.lower().replace("-", " - "))
    assert first not in recovery_code_hash(first)


def test_personal_security_migration_is_one_additive_successor():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(Config(str(ROOT / "apps/studio-api/alembic.ini")))
    revision = script.get_revision("0034_personal_security")
    assert script.get_heads() == ["0034_personal_security"]
    assert revision.down_revision == "0033_observability_alerts_audit"
    assert revision.module.release_safety == "additive"
