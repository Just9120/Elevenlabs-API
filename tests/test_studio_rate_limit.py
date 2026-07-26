from pathlib import Path
import sys
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.rate_limit import RateLimiter


def limiter_with_count(count: int, *, ttl: int = 60):
    redis = MagicMock()
    transaction = redis.pipeline.return_value.__enter__.return_value
    transaction.incr.return_value = transaction
    transaction.expire.return_value = transaction
    transaction.execute.return_value = [count, True]
    redis.ttl.return_value = ttl
    return RateLimiter(redis=redis), redis, transaction


def test_rate_limit_increment_and_first_expiry_are_one_transaction() -> None:
    limiter, redis, transaction = limiter_with_count(1)

    limiter.check("login:safe", 5, 300)

    redis.pipeline.assert_called_once_with(transaction=True)
    transaction.incr.assert_called_once_with("login:safe")
    transaction.expire.assert_called_once_with("login:safe", 300, nx=True)
    transaction.execute.assert_called_once_with()
    redis.ttl.assert_not_called()


def test_rate_limit_preserves_429_and_retry_after_contract() -> None:
    limiter, redis, _ = limiter_with_count(6, ttl=42)

    with pytest.raises(HTTPException) as exc:
        limiter.check("login:safe", 5, 300)

    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "42"}
    assert exc.value.detail == "Слишком много попыток. Повторите позже."
    redis.ttl.assert_called_once_with("login:safe")
