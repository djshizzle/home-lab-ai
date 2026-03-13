"""SNMP polling with interval and concurrency limits (R17, R18).

Prevents overloading devices (especially older ones) with too-frequent
or too-many concurrent SNMP polls.
"""

import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class SnmpPollingConfig:
    """Standard polling intervals (R17)."""

    STATUS_INTERVAL_S = 60
    TEMPERATURE_INTERVAL_S = 300
    UPTIME_INTERVAL_S = 60
    ALERT_INTERVAL_S = 30

    MAX_CONCURRENT_POLLS = 10


class SnmpPoller:
    """Concurrency-limited SNMP poller for AV devices.

    Args:
        max_concurrent: Maximum simultaneous SNMP polls on the AV VLAN.
        default_interval: Default seconds between polls for a device.
    """

    def __init__(
        self,
        max_concurrent: int = SnmpPollingConfig.MAX_CONCURRENT_POLLS,
        default_interval: float = SnmpPollingConfig.STATUS_INTERVAL_S,
    ) -> None:
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._default_interval = default_interval
        self._last_poll: dict[str, float] = {}

    def _should_poll(self, device_id: str, interval: float | None = None) -> bool:
        """Check if enough time has passed since the last poll."""
        interval = interval or self._default_interval
        last = self._last_poll.get(device_id, 0.0)
        return (time.monotonic() - last) >= interval

    async def poll_device(
        self,
        device_id: str,
        hostname: str,
        oids: list[str],
        community: str = "",
        interval: float | None = None,
    ) -> dict | None:
        """Poll a device via SNMP with concurrency and interval limits.

        Args:
            device_id: Unique device identifier.
            hostname: Device hostname or IP.
            oids: SNMP OIDs to query.
            community: SNMP community string (from env, never hardcoded).
            interval: Override polling interval for this device.

        Returns:
            Dict of OID->value results, or None if skipped (too soon).
        """
        if not self._should_poll(device_id, interval):
            logger.debug("snmp_poll_skipped", extra={"device_id": device_id, "reason": "interval"})
            return None

        async with self._semaphore:
            logger.info("snmp_poll_start", extra={"device_id": device_id, "hostname": hostname})
            self._last_poll[device_id] = time.monotonic()

            # Actual SNMP query would go here using pysnmp.
            # Placeholder returns empty dict — implement with pysnmp when devices are available.
            results: dict[str, str] = {}
            for oid in oids:
                results[oid] = ""  # pysnmp integration point

            logger.info(
                "snmp_poll_complete",
                extra={"device_id": device_id, "oid_count": len(oids)},
            )
            return results

    async def poll_fleet(
        self,
        devices: list[dict],
        oids: list[str],
        community: str = "",
    ) -> dict[str, dict | None]:
        """Poll multiple devices with concurrency control (R18).

        Args:
            devices: List of dicts with 'device_id' and 'hostname' keys.
            oids: OIDs to query on each device.
            community: SNMP community string.

        Returns:
            Dict mapping device_id to poll results (or None if skipped).
        """
        tasks = [
            self.poll_device(d["device_id"], d["hostname"], oids, community)
            for d in devices
        ]
        results_list = await asyncio.gather(*tasks, return_exceptions=True)

        results: dict[str, dict | None] = {}
        for device, result in zip(devices, results_list, strict=True):
            if isinstance(result, Exception):
                logger.error(
                    "snmp_poll_error",
                    extra={"device_id": device["device_id"], "error": str(result)},
                )
                results[device["device_id"]] = None
            else:
                results[device["device_id"]] = result
        return results
