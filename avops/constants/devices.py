"""AV device model constants for AVops.

Device IDs follow the pattern: {building}-{room}-{device_type}-{index}
e.g., hq-conf3b-ctrl-01, hq-conf3b-dsp-01
"""

# ─── Control Systems ──────────────────────────────────────────────────────────

CTRL_CRESTRON_CP4 = "crestron-cp4"
CTRL_AMX_NX3200 = "amx-nx-3200"
CTRL_QSC_CORE110F = "qsc-core-110f"

# ─── DSP / Audio ─────────────────────────────────────────────────────────────

DSP_BIAMP_TESIRA = "biamp-tesira"
DSP_QSC_QSYS = "qsc-q-sys"
DSP_SHURE_INTELLIMIX = "shure-intellimix"

# ─── Video Switching ─────────────────────────────────────────────────────────

SW_CRESTRON_DM = "crestron-dm"
SW_EXTRON_XTP = "extron-xtp"
SW_KRAMER_VS = "kramer-vs"

# ─── Displays / Projectors ───────────────────────────────────────────────────

DISP_SAMSUNG_IFP = "samsung-ifp"
DISP_LG_DVLED = "lg-dvled"
DISP_SONY_LASER = "sony-laser"
DISP_EPSON = "epson"

# ─── Video Conferencing ──────────────────────────────────────────────────────

VC_POLY_STUDIO_X = "poly-studio-x"
VC_CISCO_BOARD = "cisco-board"
VC_NEAT_BAR = "neat-bar"
VC_LOGITECH_RALLY = "logitech-rally"

# ─── AVoIP ───────────────────────────────────────────────────────────────────

AVOIP_CRESTRON_NVX = "crestron-nvx"
AVOIP_EXTRON_NAV = "extron-nav"
AVOIP_ZEEVEE = "zeevee"
AVOIP_LIGHTWARE = "lightware"

# ─── Amplifiers ──────────────────────────────────────────────────────────────

AMP_CROWN_XLS = "crown-xls"
AMP_QSC_GX = "qsc-gx"
AMP_LABGRUPPEN = "labgruppen"

# ─── Room Templates ──────────────────────────────────────────────────────────

ROOM_HUDDLE = "huddle_room"
ROOM_CONF_SMALL = "conf_small"
ROOM_CONF_MEDIUM = "conf_medium"
ROOM_CONF_LARGE = "conf_large"
ROOM_BOARDROOM = "boardroom"
ROOM_EVENT_SPACE = "event_space"
ROOM_BROADCAST_STUDIO = "broadcast_studio"

# ─── Device Categories ───────────────────────────────────────────────────────

DEVICE_CATEGORIES = {
    "ctrl": "Control System",
    "dsp": "DSP / Audio",
    "sw": "Video Switcher",
    "disp": "Display / Projector",
    "vc": "Video Conferencing",
    "avoip": "AV over IP",
    "amp": "Amplifier",
    "sched": "Room Scheduling",
    "sig": "Digital Signage",
    "uc": "Unified Communications",
    "stream": "Streaming Encoder",
}

# ─── Vendor API Rate Limits (requests/minute) ────────────────────────────────

RATE_LIMIT_CRESTRON = 60
RATE_LIMIT_QSC = 30
RATE_LIMIT_DEFAULT = 20
