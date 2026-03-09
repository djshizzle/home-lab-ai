"""AV device model constants and categorisation used across the AVops platform."""

from enum import StrEnum


class DeviceCategory(StrEnum):
    CONTROL_SYSTEM = "control_system"
    DSP_AUDIO = "dsp_audio"
    VIDEO_SWITCHING = "video_switching"
    DISPLAY = "display"
    VIDEO_CONFERENCING = "video_conferencing"
    AVOIP = "avoip"
    AMPLIFIER = "amplifier"
    SIGNAL_DISTRIBUTION = "signal_distribution"
    ROOM_SCHEDULING = "room_scheduling"
    DIGITAL_SIGNAGE = "digital_signage"
    UNIFIED_COMMS = "unified_comms"
    STREAMING = "streaming"


class DeviceProtocol(StrEnum):
    RS232 = "rs232"
    RS485 = "rs485"
    TCP_IP = "tcp_ip"
    REST = "rest"
    SNMP = "snmp"
    DANTE = "dante"
    NDI = "ndi"
    HDMI_CEC = "hdmi_cec"
    GRAPHQL = "graphql"
    SSH = "ssh"
    TELNET = "telnet"


class RoomTemplate(StrEnum):
    HUDDLE_ROOM = "huddle_room"
    CONF_SMALL = "conf_small"
    CONF_MEDIUM = "conf_medium"
    CONF_LARGE = "conf_large"
    BOARDROOM = "boardroom"
    EVENT_SPACE = "event_space"
    BROADCAST_STUDIO = "broadcast_studio"


class DeviceStatus(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"


# ── Known device models by category ──────────────────────────────────────────

CONTROL_SYSTEMS: dict[str, dict] = {
    "crestron-cp4": {
        "vendor": "Crestron",
        "model": "CP4",
        "protocol": DeviceProtocol.TCP_IP,
        "rate_limit_rpm": 60,
        "default_port": 41794,
    },
    "amx-nx-3200": {
        "vendor": "AMX",
        "model": "NX-3200",
        "protocol": DeviceProtocol.TCP_IP,
        "rate_limit_rpm": 60,
        "default_port": 1319,
    },
    "qsc-core-110f": {
        "vendor": "QSC",
        "model": "Core 110f",
        "protocol": DeviceProtocol.GRAPHQL,
        "rate_limit_rpm": 30,
        "default_port": 443,
    },
}

WEBEX_DEVICES: dict[str, dict] = {
    "cisco-board-pro-55": {
        "vendor": "Cisco",
        "model": "Board Pro 55",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "cisco-board-pro-75": {
        "vendor": "Cisco",
        "model": "Board Pro 75",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "cisco-room-kit-pro": {
        "vendor": "Cisco",
        "model": "Room Kit Pro",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "cisco-desk-pro": {
        "vendor": "Cisco",
        "model": "Desk Pro",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "poly-studio-x50": {
        "vendor": "Poly",
        "model": "Studio X50",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "poly-studio-x70": {
        "vendor": "Poly",
        "model": "Studio X70",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "neat-bar": {
        "vendor": "Neat",
        "model": "Bar",
        "protocol": DeviceProtocol.REST,
        "webex_supported": True,
        "default_port": 443,
    },
    "logitech-rally-plus": {
        "vendor": "Logitech",
        "model": "Rally Plus",
        "protocol": DeviceProtocol.REST,
        "webex_supported": False,
        "default_port": 443,
    },
}

ALL_KNOWN_DEVICES: dict[str, dict] = {**CONTROL_SYSTEMS, **WEBEX_DEVICES}

# Webex support intent keywords for triage classification
WEBEX_SUPPORT_INTENTS: dict[str, list[str]] = {
    "camera": ["camera", "video", "picture", "image", "ptz", "zoom", "pan", "tilt"],
    "audio": ["audio", "sound", "microphone", "mic", "speaker", "echo", "noise", "mute"],
    "display": ["display", "screen", "monitor", "tv", "projector", "blank", "black"],
    "connectivity": ["connect", "join", "meeting", "call", "network", "wifi", "cable", "hdmi"],
    "room_booking": ["book", "schedule", "reserve", "calendar", "room", "space"],
    "device_offline": ["offline", "down", "not working", "broken", "won't", "can't", "fail"],
    "firmware": ["firmware", "update", "version", "software", "upgrade"],
    "general": [],
}
