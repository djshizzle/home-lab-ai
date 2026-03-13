"""Tests for token-bucket rate limiter."""

import asyncio
import time

import pytest

from src.middleware.rate_limit import FleetRateLimiter, RateLimiter


class TestRateLimiter:
    def test_init_rejects_zero(self):
        with pytest.raises(ValueError, match="positive"):
            RateLimiter(0)

    def test_acquire_within_limit(self):
        limiter = RateLimiter(60)
        assert limiter.acquire("dev-1") is True

    def test_acquire_exhausts_tokens(self):
        limiter = RateLimiter(2)  # 2 req/min
        assert limiter.acquire("dev-1") is True
        assert limiter.acquire("dev-1") is True
        assert limiter.acquire("dev-1") is False

    def test_separate_keys_have_separate_buckets(self):
        limiter = RateLimiter(1)
        assert limiter.acquire("dev-1") is True
        assert limiter.acquire("dev-2") is True
        assert limiter.acquire("dev-1") is False

    def test_wait_time_zero_when_tokens_available(self):
        limiter = RateLimiter(60)
        assert limiter.wait_time("dev-1") == 0.0

    def test_wait_time_positive_when_exhausted(self):
        limiter = RateLimiter(1)
        limiter.acquire("dev-1")
        assert limiter.wait_time("dev-1") > 0

    def test_tokens_refill_over_time(self):
        limiter = RateLimiter(60)  # 1 per second
        limiter.acquire("dev-1")
        # Force time forward by manipulating last_refill
        limiter._last_refill["dev-1"] -= 2.0
        assert limiter.acquire("dev-1") is True

    def test_requests_per_minute_property(self):
        limiter = RateLimiter(42)
        assert limiter.requests_per_minute == 42

    @pytest.mark.asyncio
    async def test_acquire_async_waits(self):
        limiter = RateLimiter(120)  # fast enough for test
        await limiter.acquire_async("dev-1")
        # Should not hang


class TestFleetRateLimiter:
    def test_per_device_only(self):
        fleet = FleetRateLimiter(per_device_rpm=2)
        assert fleet.acquire("dev-1") is True
        assert fleet.acquire("dev-1") is True
        assert fleet.acquire("dev-1") is False

    def test_global_cap(self):
        fleet = FleetRateLimiter(per_device_rpm=10, global_rpm=2)
        assert fleet.acquire("dev-1") is True
        assert fleet.acquire("dev-2") is True
        # Global cap of 2 hit
        assert fleet.acquire("dev-3") is False
