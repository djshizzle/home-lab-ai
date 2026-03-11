"""Automated device health probing via ICMP ping and SNMP."""

from __future__ import annotations

import ipaddress
import socket
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from assessment.constants import (
    ONLINE_RATIO_GOOD,
    ONLINE_RATIO_PARTIAL,
    SCORE_FULLY_MET,
    SCORE_NOT_PRESENT,
    SCORE_PARTIAL,
    SNMP_COVERAGE_GOOD,
    SNMP_COVERAGE_PARTIAL,
    SNMP_OID_SYS_DESCR,
    SNMP_OID_SYS_NAME,
    SNMP_OID_SYS_UPTIME,
)
from assessment.models import QuestionScore

console = Console()

# Maximum concurrent probe threads
MAX_WORKERS = 50
PING_TIMEOUT_S = 1
SNMP_TIMEOUT_S = 2
SNMP_RETRIES = 1


def ping_host(host: str) -> bool:
    """Return True if the host responds to ICMP ping."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(PING_TIMEOUT_S), host],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=PING_TIMEOUT_S + 2,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def snmp_get(host: str, oid: str, community: str = "public") -> str | None:
    """
    Perform a single SNMP GET for the given OID.

    Returns the string value or None on failure.
    Uses pysnmp under the hood with a synchronous wrapper.
    """
    try:
        # Import here to avoid hard failure if pysnmp is not installed
        from pysnmp.hlapi import (  # type: ignore[import]
            CommunityData,
            ContextData,
            ObjectIdentity,
            ObjectType,
            SnmpEngine,
            UdpTransportTarget,
            getCmd,
        )

        error_indication, error_status, _, var_binds = next(
            getCmd(
                SnmpEngine(),
                CommunityData(community),
                UdpTransportTarget((host, 161), timeout=SNMP_TIMEOUT_S, retries=SNMP_RETRIES),
                ContextData(),
                ObjectType(ObjectIdentity(oid)),
            )
        )

        if error_indication or error_status:
            return None

        for _, val in var_binds:
            return str(val)

    except Exception:  # noqa: BLE001
        return None

    return None


def probe_host(host: str, community: str = "public") -> dict[str, Any]:
    """
    Probe a single host via ping and SNMP.

    Returns a dict with: host, online, sys_descr, sys_name, uptime_ticks.
    """
    online = ping_host(host)
    result: dict[str, Any] = {
        "host": host,
        "online": online,
        "sys_descr": None,
        "sys_name": None,
        "uptime_ticks": None,
        "snmp_ok": False,
    }

    if online:
        sys_descr = snmp_get(host, SNMP_OID_SYS_DESCR, community)
        sys_name = snmp_get(host, SNMP_OID_SYS_NAME, community)
        uptime = snmp_get(host, SNMP_OID_SYS_UPTIME, community)

        result["sys_descr"] = sys_descr
        result["sys_name"] = sys_name
        result["uptime_ticks"] = uptime
        result["snmp_ok"] = sys_descr is not None

    return result


def expand_target(target: str) -> list[str]:
    """
    Expand a target string into a list of IP address strings.

    Accepts: single IP, CIDR range, or comma-separated list of either.
    """
    hosts: list[str] = []
    for part in target.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            # Try as a network (CIDR)
            network = ipaddress.ip_network(part, strict=False)
            hosts.extend(str(ip) for ip in network.hosts())
        except ValueError:
            # Treat as hostname or single IP
            try:
                resolved = socket.gethostbyname(part)
                hosts.append(resolved)
            except socket.gaierror:
                console.print(f"[yellow]Warning: cannot resolve '{part}' — skipping[/yellow]")

    return hosts


def probe_range(
    target: str,
    community: str = "public",
    timeout: int = 5,
) -> list[dict[str, Any]]:
    """
    Probe all hosts in a target specification concurrently.

    target: single IP, CIDR range, or comma-separated list.
    Returns a list of probe result dicts.
    """
    hosts = expand_target(target)
    if not hosts:
        console.print("[yellow]No hosts to probe.[/yellow]")
        return []

    console.print(f"\n[cyan]Probing {len(hosts)} host(s) in {target}...[/cyan]")

    results: list[dict[str, Any]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Probing devices...", total=len(hosts))

        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(hosts))) as executor:
            futures = {executor.submit(probe_host, h, community): h for h in hosts}
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
                progress.advance(task)

    online_count = sum(1 for r in results if r["online"])
    snmp_count = sum(1 for r in results if r["snmp_ok"])
    console.print(
        f"[green]Probe complete:[/green] {online_count}/{len(results)} online, "
        f"{snmp_count}/{len(results)} SNMP responding"
    )
    return results


def score_probe_results(probe_results: list[dict[str, Any]]) -> list[QuestionScore]:
    """
    Map raw probe data to QuestionScore objects for the device_health domain.

    Produces two scores:
      - dh_probe_online: online ratio assessment
      - dh_probe_snmp:   SNMP monitoring coverage
    """
    if not probe_results:
        return []

    total = len(probe_results)
    online_count = sum(1 for r in probe_results if r["online"])
    snmp_count = sum(1 for r in probe_results if r["snmp_ok"])

    online_ratio = online_count / total
    snmp_ratio = snmp_count / total

    # Online ratio → maps to dh_02 (monitoring coverage question)
    if online_ratio >= ONLINE_RATIO_GOOD:
        online_score = SCORE_FULLY_MET
        online_note = f"{online_count}/{total} devices online ({online_ratio:.0%}) — automated"
    elif online_ratio >= ONLINE_RATIO_PARTIAL:
        online_score = SCORE_PARTIAL
        online_note = f"{online_count}/{total} devices online ({online_ratio:.0%}) — automated"
    else:
        online_score = SCORE_NOT_PRESENT
        online_note = f"Only {online_count}/{total} devices online ({online_ratio:.0%}) — automated"

    # SNMP coverage → maps to dh_02 monitoring depth
    if snmp_ratio >= SNMP_COVERAGE_GOOD:
        snmp_score = SCORE_FULLY_MET
        snmp_note = f"{snmp_count}/{total} devices SNMP-reachable ({snmp_ratio:.0%}) — automated"
    elif snmp_ratio >= SNMP_COVERAGE_PARTIAL:
        snmp_score = SCORE_PARTIAL
        snmp_note = f"{snmp_count}/{total} devices SNMP-reachable ({snmp_ratio:.0%}) — automated"
    else:
        snmp_score = SCORE_NOT_PRESENT
        snmp_note = f"Only {snmp_count}/{total} SNMP-reachable ({snmp_ratio:.0%}) — automated"

    return [
        QuestionScore(
            question_id="dh_probe_online",
            score=online_score,
            notes=online_note,
            source="probe",
            weight=2,
        ),
        QuestionScore(
            question_id="dh_probe_snmp",
            score=snmp_score,
            notes=snmp_note,
            source="probe",
            weight=1,
        ),
    ]


def build_probe_summary(probe_results: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a summary dict from raw probe results for inclusion in the report."""
    if not probe_results:
        return {}

    total = len(probe_results)
    online = [r for r in probe_results if r["online"]]
    offline = [r for r in probe_results if not r["online"]]
    snmp_ok = [r for r in probe_results if r["snmp_ok"]]

    return {
        "total_hosts": total,
        "online_count": len(online),
        "offline_count": len(offline),
        "snmp_count": len(snmp_ok),
        "online_ratio": round(len(online) / total, 3) if total else 0,
        "snmp_ratio": round(len(snmp_ok) / total, 3) if total else 0,
        "devices": probe_results,
    }
