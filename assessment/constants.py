"""Constants for the AV Operations Assessment Tool."""

from __future__ import annotations

# Domain IDs and their weights (must sum to 1.0)
DOMAIN_WEIGHTS: dict[str, float] = {
    "device_health": 0.35,
    "operations_maturity": 0.35,
    "av_infrastructure": 0.20,
    "security_compliance": 0.10,
}

# (min_score_inclusive, maturity_level, label)
MATURITY_THRESHOLDS: list[tuple[float, int, str]] = [
    (90.0, 5, "Optimizing"),
    (75.0, 4, "Managed"),
    (60.0, 3, "Defined"),
    (40.0, 2, "Developing"),
    (0.0, 1, "Initial"),
]

# AV device categories from CLAUDE.md
AV_DEVICE_CATEGORIES: list[str] = [
    "Control Systems",
    "DSP / Audio",
    "Video Switching",
    "Displays / Projectors",
    "Video Conferencing",
    "AVoIP",
    "Amplifiers",
    "Signal Distribution",
    "Room Scheduling",
    "Digital Signage",
    "Unified Comms",
    "Streaming",
]

# Room templates from CLAUDE.md
ROOM_TEMPLATES: dict[str, dict[str, str]] = {
    "HUDDLE_ROOM": {"description": "1 display, USB camera, USB audio"},
    "CONF_SMALL": {"description": "1-2 displays, PTZ camera, ceiling mic array, DSP"},
    "CONF_MEDIUM": {"description": "2 displays, PTZ camera, ceiling array, DSP, control system"},
    "CONF_LARGE": {"description": "3+ displays, PTZ + wide camera, DSP, control system, room scheduling"},
    "BOARDROOM": {"description": "Video wall, broadcast-grade camera, Q-SYS/Tesira DSP, Crestron control"},
    "EVENT_SPACE": {"description": "Multiple zones, distributed audio, digital signage, IMAG"},
    "BROADCAST_STUDIO": {"description": "SDI/NDI production, streaming encoder, intercom"},
}

# SNMP OIDs used during device probing
SNMP_OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0"
SNMP_OID_SYS_UPTIME = "1.3.6.1.2.1.1.3.0"
SNMP_OID_SYS_NAME = "1.3.6.1.2.1.1.5.0"

# Score option values
SCORE_NOT_PRESENT = 0
SCORE_PARTIAL = 1
SCORE_FULLY_MET = 2
SCORE_MAX_PER_QUESTION = 2

# Probe scoring thresholds
ONLINE_RATIO_GOOD = 0.90    # >= 90% online → score 2
ONLINE_RATIO_PARTIAL = 0.70  # 70–89% online → score 1
SNMP_COVERAGE_GOOD = 0.70   # >= 70% SNMP responding → score 2
SNMP_COVERAGE_PARTIAL = 0.40  # 40–69% → score 1
