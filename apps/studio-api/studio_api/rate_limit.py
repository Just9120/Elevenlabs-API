from fastapi import HTTPException
from redis import Redis
from .config import get_settings
class RateLimiter:
    def __init__(self):
        self.redis=Redis.from_url(get_settings().redis_url, decode_responses=True)
    def check(self, key: str, limit: int, window: int):
        count=self.redis.incr(key)
        if count == 1: self.redis.expire(key, window)
        if count > limit:
            ttl=max(self.redis.ttl(key), 1)
            raise HTTPException(429, "Слишком много попыток. Повторите позже.", headers={"Retry-After": str(ttl)})
