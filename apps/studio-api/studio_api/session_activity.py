from datetime import datetime, timedelta, timezone


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def session_activity_write_due(
    last_seen_at: datetime | None,
    *,
    now: datetime,
    interval_seconds: int,
) -> bool:
    if last_seen_at is None:
        return True
    return _utc(now) - _utc(last_seen_at) >= timedelta(seconds=interval_seconds)
