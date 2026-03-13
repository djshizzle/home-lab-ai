"""Circuit breaker for device connections (R9).

Prevents wasting API budget and log space on devices that are down by
short-circuiting requests after consecutive failures.

States:
    CLOSED   — Normal operation, requests pass through.
    OPEN     — Device is unreachable, requests fail immediately.
    HALF_OPEN — Cooldown expired, one probe request is allowed through.
"""

import logging
import time
from enum import StrEnum

logger = logging.getLogger(__name__)


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Raised when a request is rejected because the circuit is open."""

    def __init__(self, device_id: str, retry_after: float) -> None:
        self.device_id = device_id
        self.retry_after = retry_after
        super().__init__(
            f"Circuit open for {device_id}. Retry after {retry_after:.0f}s."
        )


class CircuitBreaker:
    """Per-device circuit breaker.

    Args:
        failure_threshold: Consecutive failures before opening the circuit.
        cooldown_seconds: How long the circuit stays open before allowing a probe.
        success_threshold: Consecutive successes in half-open state to close the circuit.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
        success_threshold: int = 2,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._cooldown = cooldown_seconds
        self._success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float = 0.0
        self._device_id: str = ""

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self._cooldown:
                self._state = CircuitState.HALF_OPEN
                self._success_count = 0
                logger.info(
                    "circuit_half_open",
                    extra={"device_id": self._device_id},
                )
        return self._state

    def check(self, device_id: str) -> None:
        """Check if a request is allowed. Raises CircuitOpenError if not."""
        self._device_id = device_id
        state = self.state
        if state == CircuitState.OPEN:
            remaining = self._cooldown - (time.monotonic() - self._last_failure_time)
            raise CircuitOpenError(device_id, max(0.0, remaining))

    def record_success(self) -> None:
        """Record a successful request."""
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self._success_threshold:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                logger.info(
                    "circuit_closed",
                    extra={"device_id": self._device_id},
                )
        else:
            self._failure_count = 0

    def record_failure(self) -> None:
        """Record a failed request."""
        self._failure_count += 1
        self._success_count = 0
        if self._failure_count >= self._failure_threshold:
            self._state = CircuitState.OPEN
            self._last_failure_time = time.monotonic()
            logger.warning(
                "circuit_opened",
                extra={
                    "device_id": self._device_id,
                    "failure_count": self._failure_count,
                    "cooldown_s": self._cooldown,
                },
            )

    def reset(self) -> None:
        """Manually reset the circuit to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0


class CircuitBreakerRegistry:
    """Manages circuit breakers for all devices.

    Usage:
        registry = CircuitBreakerRegistry()
        breaker = registry.get("hq-conf3b-uc-01")
        breaker.check("hq-conf3b-uc-01")
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._cooldown = cooldown_seconds
        self._breakers: dict[str, CircuitBreaker] = {}

    def get(self, device_id: str) -> CircuitBreaker:
        if device_id not in self._breakers:
            self._breakers[device_id] = CircuitBreaker(
                failure_threshold=self._failure_threshold,
                cooldown_seconds=self._cooldown,
            )
        return self._breakers[device_id]

    def status(self) -> dict[str, str]:
        """Return current state of all tracked devices."""
        return {did: cb.state.value for did, cb in self._breakers.items()}
