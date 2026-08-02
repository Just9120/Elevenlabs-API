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
