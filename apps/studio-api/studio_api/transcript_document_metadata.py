"""Small, readable document metadata; operational provenance stays in Studio."""
from __future__ import annotations

from datetime import date
import json
import re


def title_has_recording_date(title: str) -> bool:
    """Recognize a real calendar date, without treating filenames as authority."""
    for pattern, year_first in (
        (r"(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)", True),
        (r"(?<!\d)(\d{2})[.](\d{2})[.](\d{4}|\d{2})(?!\d)", False),
    ):
        for match in re.finditer(pattern, title):
            a, b, c = map(int, match.groups())
            year, month, day = (a, b, c) if year_first else (c, b, a)
            if year < 100:
                year += 2000
            try:
                date(year, month, day)
            except ValueError:
                continue
            return True
    return False


def compact_provenance_lines(lines: tuple[str, ...] | list[str]) -> tuple[str, ...]:
    """Accept old provenance without leaking IDs/recipe JSON into new output.

    Preserve time ranges and information needed to interpret changed audio.
    The caller retains the full immutable provenance for lifecycle comparisons.
    """
    result: list[str] = []
    for line in lines:
        label, separator, raw = line.partition(":")
        value = raw.strip()
        if not separator or not value:
            continue
        if label in {"Clip", "Segment time range", "Timeline", "Audio processing"}:
            result.append(line.strip())
        elif label == "Transformations":
            result.append("Audio processing: " + _processing_summary(value))
        elif label == "Original source":
            try:
                originals = json.loads(value)
            except (ValueError, TypeError):
                # Legacy segment provenance was a plain filename.
                result.append(f"Original source: {value}")
                continue
            if isinstance(originals, list):
                names = [item.get("filename") for item in originals if isinstance(item, dict)]
                names = [name for name in names if isinstance(name, str) and name.strip()]
                if names:
                    result.append("Original source: " + " → ".join(_line(name) for name in names))
                    if len(names) > 1:
                        result.append("Audio processing: файлы объединены в указанном порядке")
    # One processing paragraph survives older catalog dictionaries that keep
    # the first value for each key. Stable order makes maintenance idempotent.
    processing = list(dict.fromkeys(
        line.partition(":")[2].strip()
        for line in result if line.startswith("Audio processing:")
    ))
    order = {key: index for index, key in enumerate(
        ("Segment time range", "Original source", "Timeline", "Clip")
    )}
    retained = sorted(
        dict.fromkeys(line for line in result if not line.startswith("Audio processing:")),
        key=lambda line: order[line.partition(":")[0]],
    )
    if processing:
        retained.append("Audio processing: " + "; ".join(processing))
    return tuple(retained)


def _processing_summary(raw: str) -> str:
    try:
        options = json.loads(raw)
    except (ValueError, TypeError):
        options = None
    if not isinstance(options, dict):
        return "подготовленное аудио; параметры неизвестны"
    details = []
    if options.get("silence_enabled") is True:
        details.append("длинные паузы сокращены; время отличается от исходной записи")
    mono = options.get("mono_mode")
    if isinstance(mono, str) and mono in {"mixdown", "left", "right"}:
        details.append({
            "mixdown": "каналы смешаны в моно", "left": "левый канал", "right": "правый канал",
        }[mono])
    output_format = options.get("output_format")
    if isinstance(output_format, str) and output_format in {"wav", "flac", "mp3"}:
        details.append(f"формат {output_format.upper()}")
    return "; ".join(details) or "подготовленное аудио"


def _line(value: str) -> str:
    return " ".join(value.replace("\x00", " ").split())[:4096]
