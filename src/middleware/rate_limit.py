"""Token-bucket rate limiter for vendor device API calls (R1).

Each device driver declares an API_RATE_LIMIT (requests per minute).
The RateLimiter enforces that limit per-device so polling loops, retries,
and fleet operations never exceed vendor thresholds.
"""

import asyncio
import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token-bucket rate limiter keyed by device identifier.

    Args:
        requests_per_minute: Maximum requests allowed per minute per key.
    """

    def __init__(self, requests_per_minute: int) -> None:
        if requests_per_minute <= 0:
            raise ValueError("requests_per_minute must be positive")
        self._rate = requests_per_minute
        self._interval = 60.0 / requests_per_minute
        self._tokens: dict[str, float] = {}
        self._last_refill: dict[str, float] = {}

    @property
    def requests_per_minute(self) -> int:
        return self._rate

    def _ensure_key(self, key: str) -> None:
        if key not in self._tokens:
            self._tokens[key] = float(self._rate)
            self._last_refill[key] = time.monotonic()

    def _refill(self, key: str) -> None:
        self._ensure_key(key)
        now = time.monotonic()
        elapsed = now - self._last_refill[key]
        self._tokens[key] = min(
            float(self._rate),
            self._tokens[key] + elapsed / self._interval,
        )
        self._last_refill[key] = now

    def acquire(self, key: str = "default") -> bool:
        """Try to consume one token. Returns True if allowed, False if rate-limited."""
        self._refill(key)
        if self._tokens[key] >= 1.0:
            self._tokens[key] -= 1.0
            return True
        logger.warning("rate_limit_exceeded", extra={"key": key, "rate": self._rate})
        return False

    def wait_time(self, key: str = "default") -> float:
        """Seconds to wait before the next token is available."""
        self._refill(key)
        if self._tokens[key] >= 1.0:
            return 0.0
        deficit = 1.0 - self._tokens[key]
        return deficit * self._interval

    async def acquire_async(self, key: str = "default") -> None:
        """Wait until a token is available, then consume it."""
        while not self.acquire(key):
            wait = self.wait_time(key)
            logger.debug("rate_limit_wait", extra={"key": key, "wait_s": round(wait, 2)})
            await asyncio.sleep(wait)


class FleetRateLimiter:
    """Aggregate rate limiter across a fleet of same-vendor devices (R2).

    Ensures that the total request rate from this host to all devices of one
    vendor stays within an optional global cap, on top of per-device limits.

    Args:
        per_device_rpm: Per-device requests per minute.
        global_rpm: Optional global cap across all devices of this vendor.
                    If None, only per-device limits are enforced.
    """

    def __init__(self, per_device_rpm: int, global_rpm: int | None = None) -> None:
        self._per_device = RateLimiter(per_device_rpm)
        self._global = RateLimiter(global_rpm) if global_rpm else None

    def acquire(self, device_id: str) -> bool:
        """Acquire tokens from both per-device and global buckets."""
        if not self._per_device.acquire(device_id):
            return False
        if self._global and not self._global.acquire("global"):
            return False
        return True

    async def acquire_async(self, device_id: str) -> None:
        """Async wait for both per-device and global tokens."""
        await self._per_device.acquire_async(device_id)
        if self._global:
            await self._global.acquire_async("global")
