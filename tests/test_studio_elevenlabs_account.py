from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def _subscription_payload():
    return {
        "tier": "creator",
        "character_count": 2500,
        "character_limit": 10000,
        "max_credit_limit_extension": 5000,
        "can_extend_character_limit": True,
        "allowed_to_extend_character_limit": True,
        "voice_slots_used": 0,
        "professional_voice_slots_used": 0,
        "professional_voice_slots_used_in_workspace": 0,
        "voice_limit": 0,
        "voice_add_edit_counter": 0,
        "professional_voice_limit": 0,
        "can_extend_voice_limit": False,
        "can_use_instant_voice_cloning": False,
        "can_use_professional_voice_cloning": False,
        "current_overage": {"amount": "1.25", "currency": "usd"},
        "status": "active",
        "open_invoices": [
            {
                "amount_due_cents": 125,
                "subtotal_cents": 100,
                "tax_cents": 25,
            }
        ],
        "has_open_invoices": True,
        "next_character_count_reset_unix": 1798761600,
        "currency": "usd",
        "billing_period": "monthly_period",
        "character_refresh_period": "monthly_period",
        "next_invoice": {
            "amount_due_cents": 2299,
            "subtotal_cents": 2000,
            "tax_cents": 299,
            "next_payment_attempt_unix": 1798761600,
        },
        "pending_change": None,
    }


def _usage_payload():
    return {
        "columns": ["timestamp", "product_type", "credits_used"],
        "column_types": ["DateTime", "String", "Float"],
        "rows": [
            ["2026-08-29T00:00:00Z", "speech-to-text", "125.5"],
            ["2026-08-30T00:00:00Z", "speech-to-text", "4.5"],
            ["2026-08-30T00:00:00Z", "text-to-speech", "10"],
        ],
        "column_units": ["s", "", "credits"],
    }


def test_transport_normalizes_subscription_and_product_credit_usage():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request):
        requests.append(request)
        assert request.headers["xi-api-key"] == "private-account-key"
        if request.method == "GET":
            return httpx.Response(200, json=_subscription_payload())
        assert json.loads(request.content)["group_by"] == ["product_type"]
        return httpx.Response(200, json=_usage_payload())

    from studio_api.elevenlabs_account import ElevenLabsAccountTransport

    client = httpx.Client(transport=httpx.MockTransport(handler))
    transport = ElevenLabsAccountTransport(client=client)
    subscription = transport.fetch_subscription("private-account-key")
    assert subscription.tier == "creator"
    assert subscription.period_remaining == 7500
    assert subscription.current_overage_amount == Decimal("1.25000000")
    assert subscription.next_invoice_amount_due_cents == 2299
    usage = transport.fetch_workspace_usage(
        "private-account-key",
        subscription=subscription,
        now=datetime(2026, 8, 30, 12, tzinfo=timezone.utc),
    )
    assert usage.unit == "credits"
    assert usage.total_credits == Decimal("140.00000000")
    assert [(item.product_type, item.credits) for item in usage.products] == [
        ("speech-to-text", Decimal("130.00000000")),
        ("text-to-speech", Decimal("10.00000000")),
    ]
    assert len(requests) == 2


@pytest.mark.parametrize("status,reason", [(401, "provider_authentication_rejected"), (403, "provider_scope_rejected"), (429, "provider_rate_limited"), (503, "provider_unavailable")])
def test_transport_classifies_safe_provider_failures(status, reason):
    from studio_api.elevenlabs_account import (
        ElevenLabsAccountError,
        ElevenLabsAccountTransport,
    )

    client = httpx.Client(
        transport=httpx.MockTransport(lambda _request: httpx.Response(status))
    )
    with pytest.raises(ElevenLabsAccountError, match=reason):
        ElevenLabsAccountTransport(client=client).fetch_subscription("never-echo")


def test_transport_rejects_malformed_or_unbounded_usage_without_partial_totals():
    from studio_api.elevenlabs_account import (
        ElevenLabsAccountError,
        normalize_workspace_usage,
    )

    with pytest.raises(ElevenLabsAccountError, match="malformed_provider_response"):
        normalize_workspace_usage(
            {
                "columns": ["timestamp", "product_type", "credits_used"],
                "column_units": ["s", "", "seconds"],
                "rows": [["2026-08-30T00:00:00Z", "speech-to-text", "60"]],
            },
            window_start=datetime(2026, 8, 1, tzinfo=timezone.utc),
            window_end=datetime(2026, 8, 30, tzinfo=timezone.utc),
            window_basis="rolling_30_days",
        )


@pytest.fixture
def db(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.config import get_settings

    get_settings.cache_clear()
    from studio_api.db import Base
    import studio_api.models  # noqa: F401

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()
    get_settings.cache_clear()


class _SuccessfulTransport:
    def fetch_subscription(self, _api_key):
        from studio_api.elevenlabs_account import normalize_subscription

        return normalize_subscription(_subscription_payload())

    def fetch_workspace_usage(self, _api_key, *, subscription, now):
        from studio_api.elevenlabs_account import normalize_workspace_usage

        return normalize_workspace_usage(
            _usage_payload(),
            window_start=datetime(2026, 8, 1, tzinfo=timezone.utc),
            window_end=now,
            window_basis="provider_reset_period",
        )


class _FailedTransport:
    def fetch_subscription(self, _api_key):
        from studio_api.elevenlabs_account import (
            ElevenLabsAccountError,
            ElevenLabsAccountReason,
        )

        raise ElevenLabsAccountError(ElevenLabsAccountReason.provider_rate_limited)


class _UnexpectedTransport:
    def fetch_subscription(self, _api_key):
        raise AssertionError("fresh or recently failed snapshot must not call provider")


def _credential(db: Session):
    from studio_api import models as m

    user = m.User(email="account-sync@example.test")
    db.add(user)
    db.flush()
    credential = m.ProviderCredential(
        user_id=user.id,
        provider=m.CredentialProvider.elevenlabs,
        label="Основной",
        status=m.CredentialStatus.active,
    )
    db.add(credential)
    db.flush()
    version = m.ProviderCredentialVersion(
        credential_id=credential.id,
        version=1,
        ciphertext=b"not-used",
        nonce=b"not-used",
        key_id="test",
        masked_value="••••1234",
        fingerprint="f" * 64,
    )
    db.add(version)
    db.flush()
    credential.active_version_id = version.id
    db.commit()
    return user, credential, version


def test_snapshot_is_version_scoped_fresh_and_failed_refresh_becomes_stale(db):
    from studio_api.provider_account_sync import (
        provider_account_payload,
        sync_elevenlabs_account,
    )

    user, credential, version = _credential(db)
    now = datetime(2026, 8, 30, 12, tzinfo=timezone.utc)
    row = sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id=version.id,
        api_key="not-returned",
        now=now,
        transport=_SuccessfulTransport(),
    )
    db.commit()
    payload = provider_account_payload(
        row, credential=credential, active_version=1, now=now
    )
    assert payload["state"] == "current"
    assert payload["subscription"]["period_remaining"] == 7500
    assert payload["subscription"]["current_overage"] == {
        "amount": "1.25000000",
        "currency": "USD",
    }
    assert payload["workspace_usage"]["total"] == "140.00000000"
    assert "not-returned" not in json.dumps(payload)

    cached = sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id=version.id,
        api_key="not-returned",
        now=now,
        transport=_UnexpectedTransport(),
    )
    assert cached.id == row.id

    row = sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id=version.id,
        api_key="still-not-returned",
        now=now,
        force=True,
        transport=_FailedTransport(),
    )
    db.commit()
    stale = provider_account_payload(
        row, credential=credential, active_version=1, now=now
    )
    assert stale["state"] == "stale"
    assert stale["error_code"] == "provider_rate_limited"
    assert stale["subscription"]["tier"] == "creator"

    backed_off = sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id=version.id,
        api_key="not-returned",
        now=now,
        transport=_UnexpectedTransport(),
    )
    assert backed_off.last_error_code == "provider_rate_limited"


def test_credential_version_change_never_serves_previous_snapshot_as_stale(db):
    from studio_api.provider_account_sync import (
        provider_account_payload,
        sync_elevenlabs_account,
    )

    user, credential, version = _credential(db)
    now = datetime(2026, 8, 30, 12, tzinfo=timezone.utc)
    sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id=version.id,
        api_key="old",
        now=now,
        transport=_SuccessfulTransport(),
    )
    row = sync_elevenlabs_account(
        db,
        owner_user_id=user.id,
        credential=credential,
        credential_version_id="new-version-id",
        api_key="new",
        now=now,
        force=True,
        transport=_FailedTransport(),
    )
    db.commit()
    payload = provider_account_payload(
        row, credential=credential, active_version=2, now=now
    )
    assert payload["state"] == "unavailable"
    assert payload["subscription"] is None
    assert payload["workspace_usage"]["products"] == []


def test_provider_account_snapshot_migration_is_additive_direct_successor():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    scripts = ScriptDirectory.from_config(Config("apps/studio-api/alembic.ini"))
    assert scripts.get_heads() == ["0031_provider_account_snapshots"]
    revision = scripts.get_revision("0031_provider_account_snapshots")
    assert revision is not None
    assert revision.down_revision == "0030_provider_usage_accounting"
    source = (
        ROOT
        / "apps/studio-api/alembic/versions/0031_provider_account_snapshots.py"
    ).read_text(encoding="utf-8")
    assert 'release_safety = "additive"' in source
    assert "provider_account_snapshots" in source
    assert "partial provider account snapshot schema" in source
