"""Concurrency-limited bulk device operations (R16).

Prevents fleet-wide operations from overwhelming vendor APIs by
limiting the number of parallel device commands.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_MAX_CONCURRENT = 5


async def bulk_device_operation(
    device_ids: list[str],
    operation: Callable[[str], Awaitable[Any]],
    max_concurrent: int = DEFAULT_MAX_CONCURRENT,
) -> dict[str, Any]:
    """Run an async operation against multiple devices with concurrency control.

    Args:
        device_ids: List of device identifiers to operate on.
        operation: Async callable that takes a device_id and returns a result.
        max_concurrent: Maximum number of parallel operations.

    Returns:
        Dict mapping device_id to result (or exception string on failure).
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    results: dict[str, Any] = {}

    async def _run(device_id: str) -> None:
        async with semaphore:
            try:
                logger.info(
                    "bulk_op_start",
                    extra={"device_id": device_id, "max_concurrent": max_concurrent},
                )
                results[device_id] = await operation(device_id)
            except Exception as exc:
                logger.error(
                    "bulk_op_failed",
                    extra={"device_id": device_id, "error": str(exc)},
                )
                results[device_id] = {"error": str(exc)}

    await asyncio.gather(*[_run(did) for did in device_ids])

    succeeded = sum(1 for v in results.values() if not isinstance(v, dict) or "error" not in v)
    logger.info(
        "bulk_op_complete",
        extra={
            "total": len(device_ids),
            "succeeded": succeeded,
            "failed": len(device_ids) - succeeded,
        },
    )
    return results
