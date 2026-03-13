"""Base device driver with built-in rate limiting, timeouts, retries, and circuit breaker.

Implements recommendations R4, R5, R6, R7, R20 from the usage limits review.
All vendor device drivers inherit from this class.
"""

import logging
import os
from typing import Any

import httpx

from src.constants.devices import TimeoutTier
from src.middleware.rate_limit import RateLimiter
from src.utils.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)


class DeviceBase:
    """Abstract base for all AV device drivers.

    Subclasses must set:
        DEVICE_TYPE: DeviceType enum value
        DEFAULT_PORT: int
        API_RATE_LIMIT: int (requests per minute, from vendor docs)
    """

    DEVICE_TYPE: str = ""
    DEFAULT_PORT: int = 443
    API_RATE_LIMIT: int = 30  # conservative default

    def __init__(self, hostname: str, credentials: dict | None = None) -> None:
        self.hostname = hostname
        self.credentials = credentials or {}
        self.device_id: str = ""

        # R5: Default timeout (seconds). Drivers can override per-command.
        self.default_timeout = TimeoutTier.DEFAULT

        # R1: Per-device rate limiter fed by the driver's API_RATE_LIMIT constant.
        self._rate_limiter = RateLimiter(self.API_RATE_LIMIT)

        # R9: Circuit breaker — opens after 5 consecutive failures, 60s cooldown.
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            cooldown_seconds=60.0,
        )

        # R20: Dry-run mode — validate without sending to device.
        self.dry_run = os.environ.get("AVOPS_DRY_RUN", "").lower() in ("1", "true", "yes")

        # HTTP client with default timeout (R5).
        self._client: httpx.Client | None = None

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=f"https://{self.hostname}:{self.DEFAULT_PORT}",
                timeout=httpx.Timeout(self.default_timeout),
                verify=True,
            )
        return self._client

    def _request(
        self,
        method: str,
        path: str,
        *,
        timeout: float | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Make an HTTP request with rate limiting, circuit breaker, and 429 handling (R4).

        Args:
            method: HTTP method (GET, POST, PUT, DELETE).
            path: URL path relative to the device base URL.
            timeout: Override timeout for this request (seconds).
            **kwargs: Passed to httpx.Client.request().

        Returns:
            httpx.Response on success.

        Raises:
            CircuitOpenError: If the device circuit breaker is open.
            httpx.HTTPStatusError: On non-retryable HTTP errors.
        """
        # R9: Check circuit breaker before wasting a request.
        self._circuit_breaker.check(self.device_id or self.hostname)

        # R1: Enforce rate limit (blocks if budget exhausted).
        device_key = self.device_id or self.hostname
        if not self._rate_limiter.acquire(device_key):
            wait = self._rate_limiter.wait_time(device_key)
            logger.warning(
                "device_rate_limited",
                extra={"device_id": device_key, "wait_s": round(wait, 2)},
            )
            import time

            time.sleep(wait)
            self._rate_limiter.acquire(device_key)

        # R20: Dry-run mode — log but don't send.
        if self.dry_run:
            logger.info(
                "dry_run_request",
                extra={"method": method, "path": path, "device_id": device_key},
            )
            return httpx.Response(status_code=200, json={"dry_run": True})

        # R6: Apply timeout tier override.
        req_timeout = timeout or self.default_timeout
        client = self._get_client()

        try:
            response = client.request(
                method, path, timeout=req_timeout, **kwargs
            )

            # R4: Handle 429 Too Many Requests.
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "5"))
                logger.warning(
                    "device_429_received",
                    extra={
                        "device_id": device_key,
                        "retry_after_s": retry_after,
                        "path": path,
                    },
                )
                import time

                time.sleep(retry_after)
                # Retry once after waiting.
                response = client.request(
                    method, path, timeout=req_timeout, **kwargs
                )

            response.raise_for_status()
            self._circuit_breaker.record_success()
            return response

        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            self._circuit_breaker.record_failure()
            logger.error(
                "device_request_failed",
                extra={"device_id": device_key, "path": path, "error": str(exc)},
            )
            raise

    def get(self, path: str, *, timeout: float | None = None, **kwargs: Any) -> httpx.Response:
        """HTTP GET with all safeguards."""
        return self._request("GET", path, timeout=timeout, **kwargs)

    def post(self, path: str, *, timeout: float | None = None, **kwargs: Any) -> httpx.Response:
        """HTTP POST with all safeguards."""
        return self._request("POST", path, timeout=timeout, **kwargs)

    def put(self, path: str, *, timeout: float | None = None, **kwargs: Any) -> httpx.Response:
        """HTTP PUT with all safeguards."""
        return self._request("PUT", path, timeout=timeout, **kwargs)

    # --- Abstract interface (override in subclasses) ---

    def get_status(self) -> dict:
        """Return device status: {online, model, firmware, temperature}."""
        raise NotImplementedError

    def reboot(self) -> bool:
        """Reboot device. Returns True when reboot command accepted."""
        raise NotImplementedError

    def apply_config(self, config: dict) -> bool:
        """Apply configuration dict. Returns True on success."""
        raise NotImplementedError

    def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            self._client.close()
            self._client = None

    def __del__(self) -> None:
        self.close()
