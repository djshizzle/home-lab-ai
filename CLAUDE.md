# CLAUDE.md — AVops Agent Team

> This file is automatically loaded by Claude Code every session.
> Customized for enterprise AV Builds & AVops support.

---

## Project Identity

```
PROJECT_NAME:    avops-agent-team
PURPOSE:         Enterprise AV device management, configuration, monitoring, and
                 support automation using a 7-Agent AI architecture. Covers all
                 AV devices across conference rooms, event spaces, digital signage,
                 broadcast, and AVoIP infrastructure.
TECH_STACK:      Python 3.12 / FastAPI / PostgreSQL / REST APIs / SNMP /
                 Crestron SIMPL+ / Q-SYS Designer / Extron GCP / Dante / NDI /
                 Microsoft Teams Rooms / Zoom Rooms / Cisco Webex
REPO_URL:        https://github.com/your-org/avops-agent-team
TEAM:            av-engineering
```

---

## AV Device Scope

This system manages and supports all enterprise AV categories:

| Category | Examples |
|----------|----------|
| Control Systems | Crestron CP4, AMX NX-3200, QSC Core 110f |
| DSP / Audio | Biamp Tesira, QSC Q-SYS, Shure IntelliMix |
| Video Switching | Crestron DM, Extron XTP, Kramer VS |
| Displays / Projectors | Samsung IFP, LG DVLED, Sony Laser, Epson |
| Video Conferencing | Poly Studio X, Cisco Board, Neat Bar, Logitech Rally |
| AVoIP | Crestron NVX, Extron NAV, ZeeVee, Lightware |
| Amplifiers | Crown XLS, QSC GX, Lab.gruppen |
| Signal Distribution | Extron DTP, HDBaseT, HDMI 2.0, SDI |
| Room Scheduling | Crestron TSS, Robin, Joan, Neat Pad |
| Digital Signage | BrightSign, Appspace, ScreenCloud, Scala |
| Unified Comms | MTR, Zoom Rooms, Teams Panels, Cisco Webex |
| Streaming | Epiphan, AJA, Blackmagic, vMix, OBS |

---

## Quick Commands

```bash
# Install Python dependencies
install:    pip install -e ".[dev]"

# Run tests
test:       pytest -x -v tests/

# Lint / format
lint:       ruff check . && ruff format --check .

# Build
build:      python -m build

# Run AVops API locally
dev:        uvicorn avops.main:app --reload --port 8080

# Device connectivity check
ping-devices:   python scripts/ping_all_devices.py

# Sync device inventory
sync-inventory: python scripts/sync_inventory.py --env production

# Run firmware audit
firmware-audit: python scripts/firmware_audit.py --report
```

---

## Agent Team

This project uses a **7-Agent Architecture** tuned for AV enterprise operations.
See the full guide: → [AGENT-TEAM-SETUP.md](./AGENT-TEAM-SETUP.md)

### Agent Roster

| # | Agent | File | Subagent Type | AV Role |
|---|-------|------|---------------|---------|
| 1 | Orchestrator | _(main session)_ | — | Task classifier & coordinator |
| 2 | Researcher | `agents/02-researcher.md` | `Explore` | Device & codebase discovery |
| 3 | Planner | `agents/03-planner.md` | `Plan` | AV solution architect |
| 4 | Implementer | `agents/04-implementer.md` | `general-purpose` | AV code & config writer |
| 5 | Tester | `agents/05-tester.md` | `general-purpose` | Device & integration validator |
| 6 | Reviewer | `agents/06-reviewer.md` | `general-purpose` | AV security & quality auditor |
| 7 | Documenter | `agents/07-documenter.md` | `general-purpose` | As-built & PR writer |

### Workflows

| Task Type | Workflow File |
|-----------|--------------|
| New AV feature / integration | `workflows/standard-feature.md` |
| Bug / device fault fix | `workflows/bug-fix.md` |
| New device onboarding | `workflows/device-onboarding.md` |
| Firmware rollout | `workflows/firmware-rollout.md` |
| Room AV integration | `workflows/room-integration.md` |
| Incident response | `workflows/incident-response.md` |
| Code review | `workflows/code-review.md` |

---

## Team Norms

- Use `TodoWrite` to track all multi-step tasks; mark complete immediately when done
- Only **one** task `in_progress` at a time
- Read files before editing them — never propose changes blindly
- Prefer editing existing files over creating new ones
- Do not over-engineer: minimum complexity for the current task
- Always reference device model + firmware version when reporting issues
- Never push untested control system code to a live room without a maintenance window

## Security Constraints

- **Never** commit secrets, API keys, credentials, or device passwords
- Always confirm before: `git push --force`, `git reset --hard`, destructive DB ops
- AV device credentials must use environment variables — never hardcode
- Validate at system boundaries (user input, device APIs, SNMP); trust internal code
- Network: AV devices must stay on the AV VLAN — never bridge to corporate LAN
- Skip `--no-verify` only if the user explicitly requests it

## AV-Specific Constraints

- **Maintenance windows**: Never push control system changes to live rooms during business hours (8am–6pm local) without explicit user approval
- **Device compatibility**: Always verify firmware version compatibility before deploying config changes
- **Signal path**: Validate end-to-end signal path (source → switch → display) in test plans
- **Failover**: All critical systems must have documented manual override procedures
- **Dante/AES67**: Audio network changes require a Dante Controller lock check before applying
- **Vendor APIs**: Respect rate limits on device REST APIs (Crestron: 60 req/min, Q-SYS: 30 req/min)

## Git Conventions

```
Branch naming:   feature/<ticket>-short-description
                 fix/<ticket>-short-description
                 device/<ticket>-device-model-action
                 chore/<ticket>-short-description

Commit format:   <type>(<scope>): <summary>
                 Types: feat | fix | chore | docs | test | refactor | device | firmware

                 Examples:
                 feat(avop-123): add Crestron NVX encoder auto-discovery
                 fix(avop-456): resolve Q-SYS gain ramp on startup
                 device(avop-789): onboard Poly Studio X50 in conf-room-3b
                 firmware(avop-101): roll out Extron DMP 128 v3.07 to fleet

PR title:        [<type>] <short summary> (under 70 chars)
```

## Code Style

```
Language:        Python 3.12 (PEP 8, ruff enforced)
Max line length: 100
Import order:    stdlib → third-party → local (isort enforced)
Naming:          snake_case for Python, UPPER_SNAKE for constants
                 Device IDs: {building}-{room}-{device_type}-{index}
                 e.g., hq-conf3b-ctrl-01, hq-conf3b-dsp-01

AV-specific:
  - Device hostnames follow DNS pattern: av-{building}-{room}-{type}-{n}.internal
  - Room IDs follow pattern: {building_code}-{floor}{room_number}
  - Always use device model constants from avops/constants/devices.py
  - Log all device state changes with device_id, old_state, new_state, timestamp
```

---

## AV Domain Reference

### Control System Languages

| Platform | Language | File Ext | Notes |
|----------|----------|----------|-------|
| Crestron | SIMPL+ | `.usp` / `.usl` | Compiled, event-driven |
| Crestron | C# (SIMPL#) | `.cs` | .NET-based, OOP |
| Q-SYS | Lua | `.qsys` | Embedded in Designer |
| Extron | GCP (Python subset) | `.py` | Limited stdlib |
| AMX | NetLinx | `.axs` | Event-driven |
| Biamp | CLI / REST | JSON | REST API preferred |

### Key Protocols

```
RS-232 / RS-485  →  Serial control (displays, projectors, switchers)
TCP/IP (raw)     →  Crestron CIP, Extron SIS, AMX ICSP
REST/JSON        →  Modern devices (Q-SYS, Biamp, Cisco, Poly)
SNMP             →  Monitoring (uptime, temperature, alerts)
Dante/AES67      →  Audio-over-IP routing and control
NDI              →  Video-over-IP (NewTek/Vizrt ecosystem)
HDMI / CEC       →  Display control and power management
CrestronHome SDK →  UI and scheduling integration
GraphQL          →  Q-SYS external control API
```

### Standard Room Templates

```
HUDDLE_ROOM      →  1 display, USB camera, USB audio
CONF_SMALL       →  1-2 displays, PTZ camera, ceiling mic array, DSP
CONF_MEDIUM      →  2 displays, PTZ camera, ceiling array, DSP, control system
CONF_LARGE       →  3+ displays, PTZ + wide camera, DSP, control system, room scheduling
BOARDROOM        →  Video wall, broadcast-grade camera, Q-SYS/Tesira DSP, Crestron control
EVENT_SPACE      →  Multiple zones, distributed audio, digital signage, IMAG
BROADCAST_STUDIO →  SDI/NDI production, streaming encoder, intercom
```

---

## Agent Workspace

Hand-off files between agents are stored in `.agent-workspace/` (gitignored).
Run `./scripts/init-agent-team.sh` to scaffold this directory on first use.

AV-specific workspace files:
- `.agent-workspace/device-inventory-snapshot.json` — device state at task start
- `.agent-workspace/signal-path-map.md` — documented signal flow for current task
- `.agent-workspace/maintenance-window.md` — approved change window details
