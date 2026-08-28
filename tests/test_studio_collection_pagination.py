import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.collection_pagination import (  # noqa: E402
    CollectionCursorError,
    decode_collection_cursor,
    encode_collection_cursor,
    page_envelope,
)


class Row:
    def __init__(self, row_id, created_at):
        self.id = row_id
        self.created_at = created_at


def test_collection_cursor_is_owner_surface_scope_and_secret_bound():
    timestamp = datetime(2026, 8, 28, 10, 0, tzinfo=timezone.utc)
    row_id = str(uuid4())
    cursor = encode_collection_cursor(
        timestamp,
        row_id,
        secret="session-a",
        owner_user_id="owner-a",
        surface="sources",
        scope={"project_id": "project-a"},
    )

    assert decode_collection_cursor(
        cursor,
        secret="session-a",
        owner_user_id="owner-a",
        surface="sources",
        scope={"project_id": "project-a"},
    ) == (timestamp.replace(tzinfo=None), row_id)
    for changed in (
        {"secret": "session-b"},
        {"owner_user_id": "owner-b"},
        {"surface": "jobs"},
        {"scope": {"project_id": "project-b"}},
    ):
        kwargs = {
            "secret": "session-a",
            "owner_user_id": "owner-a",
            "surface": "sources",
            "scope": {"project_id": "project-a"},
            **changed,
        }
        with pytest.raises(CollectionCursorError):
            decode_collection_cursor(cursor, **kwargs)


def test_page_envelope_has_a_hard_limit_and_uses_last_visible_row():
    timestamp = datetime(2026, 8, 28, 10, 0)
    rows = [Row(str(uuid4()), timestamp) for _ in range(3)]
    visible, cursor = page_envelope(
        rows,
        page_size=2,
        timestamp_attribute="created_at",
        secret="session-a",
        owner_user_id="owner-a",
        surface="jobs",
        scope={"project_id": "project-a"},
    )

    assert visible == rows[:2]
    assert decode_collection_cursor(
        cursor,
        secret="session-a",
        owner_user_id="owner-a",
        surface="jobs",
        scope={"project_id": "project-a"},
    ) == (timestamp, rows[1].id)
