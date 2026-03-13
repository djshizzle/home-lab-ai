"""Tests for circuit breaker."""

import time

import pytest

from src.utils.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerRegistry,
    CircuitOpenError,
    CircuitState,
)


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED

    def test_stays_closed_on_success(self):
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_open_rejects_requests(self):
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=60)
        cb.record_failure()
        cb.record_failure()
        with pytest.raises(CircuitOpenError):
            cb.check("dev-1")

    def test_half_open_after_cooldown(self):
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        time.sleep(0.02)
        assert cb.state == CircuitState.HALF_OPEN

    def test_closes_after_success_in_half_open(self):
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01, success_threshold=1)
        cb.record_failure()
        cb.record_failure()
        time.sleep(0.02)
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_reset(self):
        cb = CircuitBreaker(failure_threshold=2)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        cb.reset()
        assert cb.state == CircuitState.CLOSED

    def test_circuit_open_error_has_retry_after(self):
        cb = CircuitBreaker(failure_threshold=1, cooldown_seconds=30)
        cb.record_failure()
        with pytest.raises(CircuitOpenError) as exc_info:
            cb.check("dev-1")
        assert exc_info.value.retry_after > 0
        assert exc_info.value.device_id == "dev-1"


class TestCircuitBreakerRegistry:
    def test_creates_breaker_on_first_access(self):
        registry = CircuitBreakerRegistry()
        cb = registry.get("dev-1")
        assert isinstance(cb, CircuitBreaker)

    def test_returns_same_breaker(self):
        registry = CircuitBreakerRegistry()
        cb1 = registry.get("dev-1")
        cb2 = registry.get("dev-1")
        assert cb1 is cb2

    def test_different_devices_different_breakers(self):
        registry = CircuitBreakerRegistry()
        cb1 = registry.get("dev-1")
        cb2 = registry.get("dev-2")
        assert cb1 is not cb2

    def test_status(self):
        registry = CircuitBreakerRegistry(failure_threshold=1)
        registry.get("dev-1")
        registry.get("dev-2").record_failure()
        status = registry.status()
        assert status["dev-1"] == "closed"
        assert status["dev-2"] == "open"
