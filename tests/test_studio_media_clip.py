import pytest


def test_full_source_scope_is_the_only_all_media_representation():
    from studio_api.media_clip import MediaClipRange, normalize_media_clip_range

    assert normalize_media_clip_range(None, None) == MediaClipRange()
    assert normalize_media_clip_range(None, None).is_full_source is True


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    [
        (0, 610, (0, 610)),
        (610, None, (610, None)),
        (None, 610, (None, 610)),
    ],
)
def test_manual_clip_range_accepts_two_part_boundary_shapes(start, end, expected):
    from studio_api.media_clip import normalize_media_clip_range

    clip = normalize_media_clip_range(start, end)
    assert (clip.start_seconds, clip.end_seconds) == expected
    assert clip.is_full_source is False


@pytest.mark.parametrize(
    ("start", "end"),
    [
        (0, None),
        (10, 10),
        (11, 10),
        (-1, 10),
        (False, 10),
        (1.5, 10),
        (604801, None),
    ],
)
def test_manual_clip_range_rejects_ambiguous_or_invalid_values(start, end):
    from studio_api.media_clip import MediaClipRangeError, normalize_media_clip_range

    with pytest.raises(MediaClipRangeError):
        normalize_media_clip_range(start, end)


def test_ordered_media_clip_plan_accepts_arbitrary_non_overlapping_fragments():
    from studio_api.media_clip import (
        MediaClipRange,
        validate_ordered_media_clip_plan,
    )

    validate_ordered_media_clip_plan(
        (
            MediaClipRange(start_seconds=0, end_seconds=610),
            MediaClipRange(start_seconds=610, end_seconds=915),
            MediaClipRange(start_seconds=920, end_seconds=None),
        )
    )
    validate_ordered_media_clip_plan(
        (MediaClipRange(start_seconds=30, end_seconds=45),)
    )
    validate_ordered_media_clip_plan((MediaClipRange(),))


@pytest.mark.parametrize(
    "clips",
    [
        ((None, None), (0, 10)),
        ((0, 10), (9, 20)),
        ((10, 20), (0, 9)),
        ((0, None), (10, 20)),
    ],
)
def test_ordered_media_clip_plan_rejects_mixed_overlapping_or_open_middle(clips):
    from studio_api.media_clip import (
        MediaClipPlanError,
        MediaClipRange,
        validate_ordered_media_clip_plan,
    )

    with pytest.raises(MediaClipPlanError):
        validate_ordered_media_clip_plan(
            tuple(MediaClipRange(start_seconds=start, end_seconds=end) for start, end in clips)
        )
