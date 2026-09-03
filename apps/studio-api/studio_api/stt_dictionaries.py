from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum
from typing import Iterable

from sqlalchemy.orm import selectinload

from .models import SttDictionary, SttDictionaryEntry


MAX_DICTIONARIES_PER_JOB = 10
MAX_DICTIONARY_ENTRIES = 500
MAX_KEYTERMS_PER_JOB = 100


class DictionaryEntryKind(str, Enum):
    term = "term"
    surname = "surname"
    name = "name"
    abbreviation = "abbreviation"


@dataclass(frozen=True)
class DictionaryEntryValue:
    kind: DictionaryEntryKind
    value: str


def normalize_dictionary_name(value: str) -> tuple[str, str]:
    cleaned = " ".join(str(value or "").split())
    if not cleaned or len(cleaned) > 120:
        raise ValueError("invalid_dictionary_name")
    return cleaned, cleaned.casefold()


def normalize_dictionary_entries(entries: Iterable[object]) -> tuple[DictionaryEntryValue, ...]:
    result: list[DictionaryEntryValue] = []
    seen: set[tuple[str, str]] = set()
    for item in entries:
        raw_kind = getattr(item, "kind", None) if not isinstance(item, dict) else item.get("kind")
        raw_value = getattr(item, "value", None) if not isinstance(item, dict) else item.get("value")
        try:
            kind = DictionaryEntryKind(str(getattr(raw_kind, "value", raw_kind)))
        except ValueError as exc:
            raise ValueError("invalid_dictionary_entry_kind") from exc
        value = " ".join(str(raw_value or "").split())
        if not value or len(value) > 160 or any(ord(character) < 32 for character in value):
            raise ValueError("invalid_dictionary_entry_value")
        normalized = value.casefold()
        key = (kind.value, normalized)
        if key in seen:
            raise ValueError("duplicate_dictionary_entry")
        seen.add(key)
        result.append(DictionaryEntryValue(kind, value))
    if not result or len(result) > MAX_DICTIONARY_ENTRIES:
        raise ValueError("invalid_dictionary_entry_count")
    return tuple(result)


def replace_dictionary_entries(db, *, dictionary: SttDictionary, entries: tuple[DictionaryEntryValue, ...]) -> None:
    dictionary.entries.clear()
    db.flush()
    for position, entry in enumerate(entries):
        dictionary.entries.append(SttDictionaryEntry(
            owner_user_id=dictionary.owner_user_id,
            kind=entry.kind.value,
            value=entry.value,
            normalized_value=entry.value.casefold(),
            position=position,
        ))


def dictionary_payload(row: SttDictionary) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "active": bool(row.active),
        "entries": [{"kind": entry.kind, "value": entry.value} for entry in row.entries],
        "updated_at": row.updated_at.isoformat(),
    }


def load_owned_dictionaries(db, *, owner_user_id: str, dictionary_ids: Iterable[str] | None = None) -> list[SttDictionary]:
    query = db.query(SttDictionary).options(selectinload(SttDictionary.entries)).filter(
        SttDictionary.owner_user_id == owner_user_id,
        SttDictionary.active.is_(True),
    )
    ids = tuple(dict.fromkeys(dictionary_ids or ()))
    if len(ids) > MAX_DICTIONARIES_PER_JOB:
        raise ValueError("too_many_dictionaries")
    if ids:
        query = query.filter(SttDictionary.id.in_(ids))
    rows = query.order_by(SttDictionary.updated_at.desc(), SttDictionary.id.asc()).all()
    if ids and {row.id for row in rows} != set(ids):
        raise ValueError("dictionary_unavailable")
    return rows


def snapshot_dictionary_terms(rows: Iterable[SttDictionary]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for entry in row.entries:
            normalized = entry.normalized_value
            if normalized in seen:
                continue
            seen.add(normalized)
            result.append(entry.value)
            if len(result) >= MAX_KEYTERMS_PER_JOB:
                return result
    return result


def dictionary_terms_from_options(options_json: str | None) -> tuple[str, ...]:
    try:
        payload = json.loads(options_json or "{}")
    except (TypeError, ValueError):
        return ()
    terms = payload.get("dictionary_terms") if isinstance(payload, dict) else None
    if not isinstance(terms, list) or len(terms) > MAX_KEYTERMS_PER_JOB:
        return ()
    safe: list[str] = []
    for term in terms:
        if not isinstance(term, str) or not term or len(term) > 160 or not re.search(r"\S", term):
            return ()
        safe.append(term)
    return tuple(safe)
