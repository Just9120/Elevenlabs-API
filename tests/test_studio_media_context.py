import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
from studio_api.media_context import parse_part_plan, prepared_audio_context_payload, serialize_part_plan


def test_part_plan_preserves_overlap_and_rejects_ambiguous_timeline():
    parts = [SimpleNamespace(timeline_offset_seconds=0, duration_seconds=10),
             SimpleNamespace(timeline_offset_seconds=8, duration_seconds=12)]
    value = serialize_part_plan(parts)
    assert parse_part_plan(value)[1] == {"part_index": 1, "start_seconds": 8, "end_seconds": 20}
    data = json.loads(value)
    data["parts"][1]["part_index"] = 0
    assert not parse_part_plan(json.dumps(data))
    data["parts"][1]["part_index"] = 1
    data["parts"][1]["start_seconds"] = 0
    assert not parse_part_plan(json.dumps(data))


@pytest.mark.parametrize("value", [None, "null", "[]", "{", "x" * 65537,
    '{"version":true,"parts":[]}', '{"version":1,"parts":[{"part_index":0,"start_seconds":0,"end_seconds":NaN}]}'],
    ids=["none", "null", "array", "syntax", "oversized", "boolean-version", "nonfinite"])
def test_invalid_persisted_part_plan_has_no_owner_projection(value):
    assert parse_part_plan(value) == ()


def test_prepared_audio_context_is_bounded_and_content_free():
    value = {"job_id": "a" * 36, "input_duration_ms": 10000, "output_duration_ms": 8000,
             "pauses_removed": True, "secret": "not projected"}
    assert "secret" not in prepared_audio_context_payload(json.dumps(value))
    for key in ("input_duration_ms", "output_duration_ms"):
        changed = {**value, key: True}
        assert prepared_audio_context_payload(json.dumps(changed)) is None
    assert prepared_audio_context_payload("null") is None
