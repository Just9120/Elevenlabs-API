"""Nominal measured-media quotes: immutable tariff, unknown and fencing."""
import sys
from pathlib import Path
from decimal import Decimal
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
from studio_api.long_media_preflight import record_long_media_preflight, long_media_preflight_payload
from test_studio_provider_usage_accounting import db, _context, _settings


def record(session, *, rate=Decimal("0.22")):
    _, now, job, relation, attempt = _context(session)
    settings = _settings(rate)
    settings.media_max_duration_seconds = 43200
    record_long_media_preflight(session, job_id=job.id, relation_id=relation.id, duration=18000,
        settings=settings, owner="worker", generation=7, now=now)
    return job, relation, now, settings


def test_quote_uses_measured_duration_and_locks_tariff_for_actual_usage(db):
    job, relation, now, settings = record(db)
    quote = long_media_preflight_payload(job)
    assert quote["source_duration_seconds"] == quote["selected_duration_seconds"] == 18000
    assert quote["nominal_cost"] == "1.10000000" and quote["currency"] == "USD"
    assert quote["invoice_debit"] is False and len(quote["confirmation_token"]) == 64
    assert job.provider_rate_per_hour == Decimal("0.220000")
    settings.elevenlabs_scribe_v2_rate_per_hour_usd = Decimal("9")
    record_long_media_preflight(db, job_id=job.id, relation_id=relation.id, duration=18000,
        settings=settings, owner="worker", generation=7, now=now)
    assert long_media_preflight_payload(job) == quote
    from studio_api.provider_usage_accounting import resolve_pricing_snapshot
    assert resolve_pricing_snapshot(job, _settings(None)).rate_per_hour == Decimal("0.220000")
    job.media_clip_start_seconds, job.media_clip_end_seconds = 3600, 7200
    record_long_media_preflight(db, job_id=job.id, relation_id=relation.id, duration=18000,
        settings=settings, owner="worker", generation=7, now=now)
    clipped = long_media_preflight_payload(job)
    assert clipped["selected_duration_seconds"] == 3600 and clipped["nominal_cost"] == "0.22000000"
    assert clipped["confirmation_token"] != quote["confirmation_token"]


def test_unknown_pricing_is_not_a_zero_cost_and_legacy_has_no_fake_estimate(db):
    job, _, _, _ = record(db, rate=None)
    quote = long_media_preflight_payload(job)
    assert quote["nominal_cost"] is None and quote["rate_per_hour"] is None and quote["currency"] is None
    assert long_media_preflight_payload(SimpleNamespace(long_duration_preflight_json=None)) is None


def test_stale_worker_cannot_replace_quote(db):
    job, relation, now, settings = record(db)
    previous = long_media_preflight_payload(job)
    with pytest.raises(RuntimeError, match="context_invalid"):
        record_long_media_preflight(db, job_id=job.id, relation_id=relation.id, duration=20000,
            settings=settings, owner="old-worker", generation=6, now=now)
    assert long_media_preflight_payload(job) == previous


def test_consent_is_bound_to_source_and_clip_and_new_quote_revokes_it(db):
    from studio_api.long_media_preflight import confirmed_source_duration
    job, relation, now, settings = record(db)
    assert confirmed_source_duration(job, relation.id) is None
    job.long_duration_cost_confirmed = True
    assert confirmed_source_duration(job, relation.id) == 18000
    assert confirmed_source_duration(job, "other-source") is None
    job.media_clip_end_seconds = 60
    assert confirmed_source_duration(job, relation.id) is None
    job.media_clip_end_seconds = None
    record_long_media_preflight(db, job_id=job.id, relation_id=relation.id, duration=20000,
        settings=settings, owner="worker", generation=7, now=now)
    assert confirmed_source_duration(job, relation.id) is None
    assert job.long_duration_cost_confirmed is False
