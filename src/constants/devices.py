"""Device type constants and vendor rate limits for AVops."""

from enum import StrEnum


class DeviceType(StrEnum):
    CONTROL_SYSTEM = "ctrl"
    DSP = "dsp"
    VIDEO_SWITCHER = "sw"
    DISPLAY = "disp"
    PROJECTOR = "proj"
    UC_CODEC = "uc"
    AVOIP_ENCODER = "enc"
    AVOIP_DECODER = "dec"
    AMPLIFIER = "amp"
    SIGNAL_DISTRIBUTION = "dist"
    ROOM_SCHEDULING = "sched"
    DIGITAL_SIGNAGE = "sign"
    CAMERA = "cam"
    STREAMING = "stream"
    MICROPHONE = "mic"


# Vendor API rate limits (requests per minute).
# Source: vendor documentation and empirical testing.
# See docs/vendor-rate-limits.md for full details.
VENDOR_RATE_LIMITS: dict[str, int] = {
    "crestron": 60,
    "qsys": 30,
    "biamp": 60,
    "poly": 30,
    "extron": 60,
    "amx": 30,
    "shure": 30,
    "samsung": 30,
    "lg": 30,
    "sony": 20,
    "epson": 20,
    "cisco": 30,
    "logitech": 30,
    "brightsign": 60,
    "neat": 30,
    "blackmagic": 30,
}


class TimeoutTier:
    """Recommended timeouts by operation type (seconds)."""

    STATUS_POLL = 5
    CONFIG_READ = 10
    CONFIG_WRITE = 15
    REBOOT_POWER = 30
    FIRMWARE_UPLOAD = 300
    SERIAL_DEFAULT = 5
    DEFAULT = 10
