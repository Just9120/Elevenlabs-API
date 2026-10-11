"""Bounded, content-free media timeline projections for owner-facing recovery."""
import json
import math


def parse_part_plan(value: str | None) -> tuple[dict, ...]:
    if not value or len(value) > 65536:
        return ()
    try:
        document = json.loads(value)
        parts = document["parts"]
        if type(document["version"]) is not int or document["version"] != 1 or not isinstance(parts, list) or not 1 <= len(parts) <= 256:
            return ()
        result = []
        for index, part in enumerate(parts):
            start, end = part["start_seconds"], part["end_seconds"]
            if type(part["part_index"]) is not int or part["part_index"] != index or isinstance(start, bool) or isinstance(end, bool):
                return ()
            if not all(isinstance(number, (int, float)) and math.isfinite(number) for number in (start, end)) or not 0 <= start < end:
                return ()
            if result and start <= result[-1]["start_seconds"]:
                return ()
            result.append({"part_index": index, "start_seconds": start, "end_seconds": end})
        return tuple(result)
    except (ValueError, TypeError, KeyError, RecursionError):
        return ()


def serialize_part_plan(parts) -> str:
    value = json.dumps({"version": 1, "parts": [
        {"part_index": index, "start_seconds": part.timeline_offset_seconds,
         "end_seconds": part.timeline_offset_seconds + part.duration_seconds}
        for index, part in enumerate(parts)
    ]}, separators=(",", ":"), allow_nan=False)
    if not parse_part_plan(value):
        raise ValueError("media_part_plan_invalid")
    return value


def prepared_audio_context_payload(value: str | None):
    if not value or len(value) > 2048:
        return None
    try:
        item = json.loads(value)
        if not isinstance(item, dict) or len(item.get("job_id", "")) != 36:
            return None
        for key in ("input_duration_ms", "output_duration_ms"):
            if type(item.get(key)) is not int or item[key] <= 0:
                return None
        if type(item.get("pauses_removed")) is not bool:
            return None
        return {key: item[key] for key in ("job_id", "input_duration_ms", "output_duration_ms", "pauses_removed")}
    except (ValueError, TypeError, KeyError):
        return None
