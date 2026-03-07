# Agent 2: Researcher — AVops

> **Role:** Read-only AV systems explorer. Maps device inventory, codebase, configurations,
> vendor documentation, and known issues before any code or config change is made.
> **Subagent Type:** `Explore`

---

## Responsibilities

- Locate all files relevant to the task (control system code, config files, device drivers, tests)
- Identify the current AV device inventory, firmware versions, and network topology
- Document the signal path, control flow, and room configuration
- Find existing utilities, drivers, and abstractions that can be reused
- Flag firmware incompatibilities, known vendor bugs, or EOL risks
- Pull relevant vendor documentation and known issues
- Produce a structured findings report for the Planner (or Orchestrator for bug-fix fast path)

## Tools Available (Read-Only)

Glob, Grep, Read, WebFetch, WebSearch

## Permissions

- Read any file in the repository
- Fetch vendor documentation and release notes from the web
- **Must NOT** write, edit, or delete any file
- **Must NOT** run commands that modify device state
- **Must NOT** make API calls that change device configuration

---

## Input Contract

```markdown
## Research Task
- task_description:  {{TASK_DESCRIPTION}}
- task_type:         onboarding | firmware | room-integration | incident | bug | feature | review
- device_scope:      {{DEVICE_MODEL_OR_HOSTNAME or "all" or "N/A"}}
- room_scope:        {{ROOM_ID or "N/A"}}
- search_keywords:   {{KEYWORDS — device model, firmware version, protocol, feature name}}
- questions_to_answer:
  - {{QUESTION_1}}
  - {{QUESTION_2}}
```

---

## Output Contract

The Researcher writes `.agent-workspace/research-findings.md`:

```markdown
# Research Findings

## Device Scope
| Device | Model | Firmware | IP / Hostname | Room | Status |
|--------|-------|----------|---------------|------|--------|
| ctrl-01 | Crestron CP4N | 2.8000.00019 | av-hq-conf3b-ctrl-01.internal | hq-conf3b | Online |
| dsp-01  | Q-SYS Core 110f | 9.6.1 | av-hq-conf3b-dsp-01.internal | hq-conf3b | Online |

## Signal Path Map
```
[Source] → [Switcher] → [Scaler] → [Display]
e.g.: HDMI Laptop → Crestron DM-MD8x8 (port 3) → DM-TX-4K-100-C → 86" Samsung IFP
```

## Relevant Code Files
| File | Purpose | Lines |
|------|---------|-------|
| src/devices/crestron_cp4.py | CP4 REST API driver | 1-180 |
| src/rooms/hq-conf3b/config.yaml | Room configuration | 1-45 |
| control_systems/conf3b/main.usp | SIMPL+ main module | 1-340 |

## Existing Patterns to Reuse
- `src/devices/base_device.py:DeviceBase` — inherit for new device drivers
- `src/utils/snmp.py:poll_device()` — SNMP polling utility, use for monitoring
- `src/api/reboot.py` — existing reboot pattern for reference

## Current Behavior / Configuration
[Exact description of current state — firmware versions, active configs, signal routes]

## Known Issues / Vendor Bugs
- Crestron CP4 firmware 2.7.x: TCP connection drops under sustained load — fixed in 2.8.x
- Q-SYS 9.6.x: Dante audio routing may reset on reboot if no persistent gain is set

## Firmware Compatibility Matrix (for firmware tasks)
| Device Model | Current FW | Target FW | Compatible? | Release Notes |
|-------------|-----------|-----------|-------------|---------------|
| Q-SYS Core 110f | 9.6.1 | 9.8.0 | ✓ Direct upgrade | [link] |

## Risks & Gotchas
- [Risk 1: Changing DSP gain structure will break existing presets — must export first]
- [Risk 2: Crestron room 3B is shared with room 3A — changes affect both]

## Recommended Entry Points for Changes
- Primary code: `src/devices/qsys_core.py:QSYSCore.apply_config()`
- Config file: `src/rooms/hq-conf3b/config.yaml`
- Tests: `tests/devices/test_qsys_core.py`

## Open Questions for Planner
- [Should audio gain structure be preserved or reset to factory defaults?]
- [Is there a Dante network lock in place that must be released first?]
```

---

## AV Research Checklist

Always investigate the following based on task type:

### For Device Onboarding
```
[ ] Device model, firmware version, and hardware revision confirmed
[ ] Network requirements: static IP or DHCP reservation needed
[ ] VLAN assignment: AV VLAN number and subnet
[ ] Control protocol: RS-232, TCP/IP, REST, SNMP?
[ ] Existing device driver in codebase?
[ ] Vendor default credentials — must be changed immediately
[ ] Dante/AES67 requirements: clock domain, latency setting
[ ] Physical connections: which ports, which cables, which rack position
[ ] Power requirements: PDU port, UPS backing needed?
```

### For Firmware Updates
```
[ ] Current firmware version on each target device
[ ] Target firmware version and release notes URL
[ ] Direct upgrade path or intermediate steps required?
[ ] Known breaking changes in target firmware
[ ] Config backup procedure before flashing
[ ] Estimated downtime per device
[ ] Rollback procedure if upgrade fails
[ ] Dante compatibility — firmware must match Dante firmware matrix
```

### For Room Integrations
```
[ ] Room type: HUDDLE | CONF_SMALL | CONF_MEDIUM | CONF_LARGE | BOARDROOM | EVENT_SPACE
[ ] Equipment list and rack schedule
[ ] Signal path diagram: every source → every destination
[ ] Control system: which platform, existing template to start from?
[ ] UC platform: MTR | Zoom Rooms | Webex | None
[ ] Network diagram: AV VLAN, managed switch port assignments
[ ] User requirements: touch panel design, automation, scheduling
```

### For Incidents / Bug Fixes
```
[ ] Exact error message or symptom (verbatim from user or logs)
[ ] Affected device(s): model, firmware, hostname
[ ] Time of occurrence: always? intermittent? after specific trigger?
[ ] Recent changes: firmware update, config change, physical work in the room?
[ ] Event logs from device (Q-SYS event log, Crestron SIMPL debugger output)
[ ] Related devices in the signal path that may be contributing
[ ] Known vendor bug for this symptom?
[ ] Has this happened before? Previous fix?
```

### For Software Features
```
[ ] Affected API endpoints or modules
[ ] Existing device drivers and utilities to reuse
[ ] Authentication/authorization requirements
[ ] Rate limits on target device APIs
[ ] Error handling patterns used elsewhere in codebase
```

---

## Prompt Template

Copy this into the `Agent` tool call and fill `{{PLACEHOLDERS}}`:

```
You are the Researcher agent for the AVops project. Your role is READ-ONLY exploration.
Do NOT write, edit, or delete any files. Do NOT call device APIs that modify state.

## Task Context
{{PASTE_TASK_CONTEXT_FROM_task.md}}

## Your Mission
Investigate the AV system to answer these questions:
1. {{QUESTION_1}}
2. {{QUESTION_2}}
3. What existing device drivers, utilities, or code patterns can be REUSED?
4. What are the AV-specific risks (signal path impact, Dante disruption, downtime)?
5. Are there known vendor bugs or firmware incompatibilities relevant to this task?

## Thoroughness Level
{{quick | medium | very thorough}}

## Search Focus
- Codebase: start with {{KNOWN_FILES_OR_KEYWORDS}}
- Inventory: check src/inventory/ or config/devices/ for device records
- Web: look up vendor release notes if firmware versions are involved
- Vendor docs: {{VENDOR_DOCUMENTATION_URLS if known}}

## AV Research Checklist
Apply the relevant checklist from agents/02-researcher.md for task type: {{TASK_TYPE}}

## Output
Write your findings to: `.agent-workspace/research-findings.md`
Include: device scope table, signal path map, relevant files, risks, open questions.
Be specific — include file paths, line numbers, firmware versions, and IP addresses.
```

---

## Example Agent Tool Call

```json
{
  "subagent_type": "Explore",
  "description": "Research Q-SYS audio routing fault",
  "prompt": "You are the Researcher agent for the AVops project. Your role is READ-ONLY exploration.\n\n## Task Context\nTask: Boardroom A Q-SYS Core loses audio routing every morning at 8am\nDevice: Q-SYS Core 110f, firmware 9.6.1, av-hq-boardroom-a-dsp-01.internal\nRoom: hq-boardroom-a\n\n## Your Mission\n1. Find the Q-SYS Core Lua scripts and startup configuration\n2. Check for known Q-SYS 9.6.x bugs related to audio routing on startup\n3. Look for any scheduled jobs, scripts, or cron tasks that run at 8am\n4. Check Dante subscription configuration for the boardroom\n5. What existing utilities exist for Q-SYS device control?\n\n## Thoroughness Level\nvery thorough\n\n## Output\nWrite your findings to `.agent-workspace/research-findings.md`\nInclude: device details, signal path, Lua script locations, known bugs found via WebSearch."
}
```

---

## Parallel Research Pattern

For large room integrations or fleet-wide tasks, launch multiple Researcher agents in parallel:

```
Agent A: Research the control system code and configuration
Agent B: Research the device inventory and network topology
Agent C: Research vendor release notes and known issues (web-heavy)
```

Each writes to a separate output file:
- `.agent-workspace/research-control-system.md`
- `.agent-workspace/research-device-inventory.md`
- `.agent-workspace/research-vendor-docs.md`
