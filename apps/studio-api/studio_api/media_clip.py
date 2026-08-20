from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


MAX_MANUAL_CLIP_SECONDS = 7 * 24 * 60 * 60


class MediaClipRangeError(ValueError):
    pass


class MediaClipPlanError(ValueError):
    pass


@dataclass(frozen=True)
class MediaClipRange:
    start_seconds: int | None = None
    end_seconds: int | None = None

    @property
    def is_full_source(self) -> bool:
        return self.start_seconds is None and self.end_seconds is None


def normalize_media_clip_range(
    start_seconds: object,
    end_seconds: object,
) -> MediaClipRange:
    start = _optional_second(start_seconds, "clip start")
    end = _optional_second(end_seconds, "clip end")
    if start is None and end is None:
        return MediaClipRange()
    effective_start = start or 0
    if end is not None and end <= effective_start:
        raise MediaClipRangeError("clip end must be after clip start")
    if start == 0 and end is None:
        raise MediaClipRangeError("zero-to-end clip must use full-source scope")
    return MediaClipRange(start_seconds=start, end_seconds=end)


def validate_ordered_media_clip_plan(clips: Sequence[MediaClipRange]) -> None:
    """Validate one source's explicit fragment plan without media-duration access."""
    clipped = [clip for clip in clips if not clip.is_full_source]
    if not clipped:
        return
    if len(clipped) != len(clips):
        raise MediaClipPlanError(
            "full-source scope cannot be mixed with explicit fragments"
        )

    previous_end: int | None = None
    for position, clip in enumerate(clipped):
        start = clip.start_seconds or 0
        if position and (previous_end is None or start < previous_end):
            raise MediaClipPlanError(
                "fragments must be ordered and must not overlap"
            )
        if clip.end_seconds is None and position != len(clipped) - 1:
            raise MediaClipPlanError(
                "only the final fragment may continue to source end"
            )
        previous_end = clip.end_seconds


def _optional_second(value: object, label: str) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise MediaClipRangeError(f"{label} must be an integer")
    if value < 0 or value > MAX_MANUAL_CLIP_SECONDS:
        raise MediaClipRangeError(f"{label} is outside the supported range")
    return value
