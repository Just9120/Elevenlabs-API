from fastapi import HTTPException
from redis import Redis

from .config import get_settings


class RateLimiter:
    def __init__(self, redis: Redis | None = None):
        self.redis = redis or Redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
        )

    def check(self, key: str, limit: int, window: int) -> None:
        with self.redis.pipeline(transaction=True) as transaction:
            transaction.incr(key)
            transaction.expire(key, window, nx=True)
            count, _ = transaction.execute()

        if count > limit:
            ttl = max(self.redis.ttl(key), 1)
            raise HTTPException(
                429,
                "Слишком много попыток. Повторите позже.",
                headers={"Retry-After": str(ttl)},
            )
