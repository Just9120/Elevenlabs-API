from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.session_activity import session_activity_write_due


@pytest.mark.parametrize(
    ("last_seen_at", "expected"),
    [
        (None, True),
        (datetime(2026, 7, 26, 11, 55), True),
        (datetime(2026, 7, 26, 11, 55, 1, tzinfo=timezone.utc), False),
        (datetime(2026, 7, 26, 12, 1, tzinfo=timezone.utc), False),
    ],
)
def test_session_activity_write_due_respects_bounded_interval(last_seen_at, expected):
    now=datetime(2026, 7, 26, 12, 0, tzinfo=timezone.utc)
    assert session_activity_write_due(
        last_seen_at,
        now=now,
        interval_seconds=300,
    ) is expected
