import os
from pathlib import Path
from types import SimpleNamespace
import sys

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("STUDIO_APP_ORIGIN", "https://studio.test")
os.environ.setdefault("STUDIO_COOKIE_SECURE", "false")

from studio_api.deps import CSRF_REJECTION_REASON, require_csrf
from studio_api.security import token_hash


def test_csrf_rejection_has_stable_retry_reason():
    pair=(SimpleNamespace(csrf_hash=token_hash("current-token")), SimpleNamespace())
    request=SimpleNamespace()

    assert require_csrf(request, x_csrf_token="current-token", pair=pair, _=None) == pair
    with pytest.raises(HTTPException) as exc:
        require_csrf(request, x_csrf_token="stale-token", pair=pair, _=None)
    assert exc.value.status_code == 403
    assert exc.value.detail == {"reason": CSRF_REJECTION_REASON}
