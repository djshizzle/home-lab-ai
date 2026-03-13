"""Shared retry decorator with exponential backoff and jitter (R8).

Usage:
    @retry_with_backoff()
    def get_device_status(device_id: str) -> dict: ...

    @retry_with_backoff(max_retries=5, base_delay=2.0)
    async def poll_device(device_id: str) -> dict: ...
"""

import asyncio
import functools
import logging
import random
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# Exceptions that indicate a transient failure worth retrying.
RETRYABLE_EXCEPTIONS: tuple[type[Exception], ...] = (
    ConnectionError,
    TimeoutError,
    OSError,
)


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: bool = True,
    retryable_exceptions: tuple[type[Exception], ...] = RETRYABLE_EXCEPTIONS,
) -> Callable:
    """Decorator that retries a function with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts (not counting the first call).
        base_delay: Initial delay in seconds between retries.
        max_delay: Maximum delay cap in seconds.
        jitter: Add random jitter to prevent thundering herd.
        retryable_exceptions: Exception types that trigger a retry.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as exc:
                    last_exception = exc
                    if attempt == max_retries:
                        break
                    delay = _compute_delay(attempt, base_delay, max_delay, jitter)
                    logger.warning(
                        "retry_attempt",
                        extra={
                            "function": func.__name__,
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "delay_s": round(delay, 2),
                            "error": str(exc),
                        },
                    )
                    await asyncio.sleep(delay)
            raise last_exception  # type: ignore[misc]

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            import time

            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as exc:
                    last_exception = exc
                    if attempt == max_retries:
                        break
                    delay = _compute_delay(attempt, base_delay, max_delay, jitter)
                    logger.warning(
                        "retry_attempt",
                        extra={
                            "function": func.__name__,
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "delay_s": round(delay, 2),
                            "error": str(exc),
                        },
                    )
                    time.sleep(delay)
            raise last_exception  # type: ignore[misc]

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def _compute_delay(attempt: int, base: float, maximum: float, jitter: bool) -> float:
    delay = min(base * (2**attempt), maximum)
    if jitter:
        delay *= 0.5 + random.random()  # noqa: S311
    return delay
