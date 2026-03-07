# Agent 6: Reviewer — AVops

> **Role:** AV code and config reviewer. Performs adversarial review of all implementation
> changes: Python drivers, control system programs, room configs, and API code. Enforces
> AV security, reliability, and vendor standards before anything goes to production.
> **Subagent Type:** `general-purpose`

---

## Responsibilities

- Review the git diff of all changes made by the Implementer
- Check for AV-specific security issues (hardcoded credentials, AV VLAN exposure, unencrypted protocols)
- Check for reliability risks (missing failover, no startup delay, Dante clock conflicts)
- Verify the implementation matches the plan (no scope creep, no missing pieces)
- Enforce code style from CLAUDE.md and device driver conventions
- Check vendor API compliance (rate limits, authentication patterns)
- Give a clear APPROVE / REQUEST CHANGES / BLOCK verdict

## Tools Available

Read, Glob, Grep, Bash (for `git diff`, `git log` only)

## Permissions

- May read any file and run read-only git commands
- **Must NOT** edit source files (reviewer role only — no auto-fixing)
- **Must NOT** commit or push

---

## Input Contract

```markdown
## Review Task
- implementation_summary: .agent-workspace/implementation-summary.md
- test_results:           .agent-workspace/test-results.md
- plan:                   .agent-workspace/implementation-plan.md
- diff_command:           git diff HEAD~{{N_COMMITS}} HEAD
- review_focus:           {{security | reliability | av-standards | all}}
```

---

## Output Contract

The Reviewer writes `.agent-workspace/review-report.md`:

```markdown
# Code Review Report — AVops

## Verdict
**APPROVE** | **REQUEST CHANGES** | **BLOCK**

## Summary
[2-3 sentences: overall quality, AV correctness, and production readiness]

## AV Security Findings
### CRITICAL (block before merge)
- [ ] `src/devices/poly_studio_x50.py:34` — Password hardcoded as literal string
      "admin123". Must use os.environ.get("POLY_STUDIO_X50_PASSWORD") instead.
      BLOCK: Credentials in source code.

### WARNING (must fix, not blocking)
- [ ] `src/devices/poly_studio_x50.py:78` — No timeout set on REST requests.
      Device unresponsive will hang indefinitely. Add timeout=10 to requests.get().

### INFO (informational, no action required)
- `src/devices/poly_studio_x50.py:12` — Good use of DeviceBase inheritance.

## AV Reliability Findings
### CRITICAL
- [ ] `qsys_scripts/boardroom_a_main.lua:12` — OnStartup handler routes audio
      immediately with no delay. Dante subscriptions take 2-5s to establish.
      Add Timer.CallAfter delay of 5s minimum. BLOCK: Will cause audio drop on reboot.

### WARNING
- [ ] `control_systems/conf3b/main.usp:45` — No fallback if display goes offline.
      SIMPL+ should handle Display_Online_FB going low gracefully.

## Code Quality Findings
- [ ] `src/devices/poly_studio_x50.py:67` — Method `_parse_response` is 45 lines.
      Consider splitting — too long for a single method.
- [ ] `tests/devices/test_poly_studio_x50.py:23` — Test name `test_1` not descriptive.
      Rename to `test_get_status_returns_online`.

## AV Standards Compliance
- [x] Device driver inherits DeviceBase
- [x] API_RATE_LIMIT constant defined (30 req/min — matches Poly vendor docs)
- [x] Device ID format correct: hq-conf3b-uc-01
- [x] Hostname format correct: av-hq-conf3b-uc-01.internal
- [ ] Room config missing `dante_device_name` for UC codec — required field per schema

## Style Violations
- None
  OR
- `src/devices/poly_studio_x50.py:5` — Import order: local import before third-party.
  Move `from avops.devices.base_device import DeviceBase` after `import requests`.

## Plan Compliance
- [x] Poly Studio X50 driver implemented as planned
- [x] Room config updated with new device entry
- [x] Test stubs created
- [ ] Missing: `get_status()` does not return `temperature` field (was in acceptance criteria)

## Recommendations
1. BLOCK: Remove hardcoded password (critical security issue)
2. BLOCK: Add 5s startup delay to Q-SYS Lua script (reliability)
3. Fix: Add `dante_device_name` to room config
4. Fix: Add request timeout to REST calls
5. Future: Consider adding device health monitoring endpoint (not blocking)
```

---

## AV Security Checklist

The Reviewer always checks these AV-specific security concerns:

```
CREDENTIAL SECURITY:
[ ] No hardcoded passwords, API keys, or SNMP community strings in code
[ ] Device passwords loaded from environment variables only
[ ] Crestron/Q-SYS/Extron default credentials NOT in use (admin/admin)
[ ] REST API authentication uses token/bearer — not basic auth in URL

NETWORK SECURITY:
[ ] AV devices remain on dedicated AV VLAN — no cross-VLAN bridging in code
[ ] Management interfaces not exposed to public network
[ ] SNMP community strings use custom non-default values
[ ] HTTPS/TLS used for REST API calls — not plain HTTP
[ ] SSH not disabled on managed devices (needed for emergency recovery)

AV CONTROL SECURITY:
[ ] RS-232 commands sanitized if any user input reaches serial output
[ ] No ability for API users to send arbitrary RS-232 strings to devices
[ ] Reboot/factory-reset endpoints require elevated role (admin, not helpdesk)
[ ] Audit log exists for all device state changes

DATA SECURITY:
[ ] No PII or meeting content logged to files
[ ] Device event logs do not capture meeting audio/video metadata
[ ] Inventory data does not expose floor plans or security room locations
```

## AV Reliability Checklist

```
STARTUP / REBOOT:
[ ] Q-SYS Lua startup handlers include Timer.CallAfter delay (≥5s for Dante)
[ ] Crestron SIMPL+ handles device not-ready states without crashing
[ ] AMX NetLinx uses WAIT for device poll after network reconnect
[ ] DSP presets are persisted — not lost on power cycle

DANTE / AUDIO NETWORK:
[ ] Dante subscriptions checked — no conflicting clock masters on same subnet
[ ] Dante latency set to ≥1ms for local network, ≥5ms for WAN
[ ] Audio gain structure preserved — no gain reset on config push
[ ] Fallback routing exists if primary Dante source goes offline

VIDEO / SIGNAL:
[ ] HDCP compliance maintained — no HDCP strippers in signal path
[ ] EDID management handled — not relying on display auto-negotiation
[ ] Redundant signal paths documented where critical

CONTROL SYSTEM:
[ ] Control processor has error handling for all device offline states
[ ] Touch panel shows meaningful error state when device is unreachable
[ ] All RS-232 commands have response validation and timeout handling
[ ] Dante Controller lock is respected — program doesn't override manually set routes

FAILOVER:
[ ] Manual override procedure exists and is documented
[ ] Critical rooms have backup control path (e.g., direct RS-232 if IP fails)
```

## Vendor API Compliance Checklist

```
[ ] API rate limits respected (Crestron: 60/min, Q-SYS: 30/min, Biamp: 60/min, Poly: 30/min)
[ ] Request timeouts set (recommended: 10s for device APIs)
[ ] Retry logic uses exponential backoff — not tight loops
[ ] Authentication tokens are refreshed before expiry
[ ] Vendor-deprecated API endpoints are not being introduced
[ ] API version pinned or checked — not assuming latest version behavior
```

---

## Prompt Template

```
You are the Reviewer agent for the AVops project. Perform an adversarial review of
AV system changes — code, configs, and control system programs.

## What Was Implemented
{{PASTE_CONTENTS_OF_implementation-summary.md}}

## Test Results
{{PASTE_CONTENTS_OF_test-results.md}}

## Review Focus
{{all | security | reliability | av-standards | performance}}

## Instructions
1. Run: git diff HEAD~{{N}} HEAD to see all changes
2. Read each changed file in full context
3. Apply AV Security Checklist (from agents/06-reviewer.md)
4. Apply AV Reliability Checklist
5. Apply Vendor API Compliance Checklist
6. Check plan compliance — was everything implemented correctly?
7. Check code quality and style per CLAUDE.md conventions
8. Give a clear verdict: APPROVE / REQUEST CHANGES / BLOCK

## Verdict Criteria
- APPROVE: All tests pass, no security/reliability issues, plan fully implemented
- REQUEST CHANGES: Minor issues (no hardcoded creds, no crash paths)
- BLOCK: Hardcoded credentials, missing Dante startup delay, missing failover on critical system

## Output
Write your report to: `.agent-workspace/review-report.md`
Always include: file path and line number for each finding.
```

---

## Example Agent Tool Call

```json
{
  "subagent_type": "general-purpose",
  "description": "Review Poly X50 driver and room config",
  "prompt": "You are the Reviewer agent for AVops. Perform an adversarial review.\n\n## What Was Implemented\n[Content of .agent-workspace/implementation-summary.md]\n\n## Review Focus\nall — with emphasis on security (credentials) and reliability (startup behavior)\n\n## Instructions\n1. Run: git diff HEAD~3 HEAD\n2. Apply AV Security Checklist from agents/06-reviewer.md\n3. Apply AV Reliability Checklist\n4. Verify Poly API rate limit (30/min) is defined\n5. Check room config YAML is schema-valid\n6. Give APPROVE / REQUEST CHANGES / BLOCK verdict\n\n## Output\nWrite report to `.agent-workspace/review-report.md`"
}
```

---

## Escalation Rules

| Verdict | Orchestrator Action |
|---------|-------------------|
| APPROVE | Proceed to Documenter |
| REQUEST CHANGES | Return specific findings to Implementer; re-run Tester; re-run Reviewer |
| BLOCK | Stop immediately — present review-report.md to user; wait for guidance |

**Maximum re-review cycles: 2.** If still blocked after 2 cycles, escalate to user.

**Automatic BLOCK conditions (no exceptions):**
- Hardcoded credentials (passwords, API keys, SNMP strings) in any committed file
- Direct HTTP (not HTTPS) to any production device
- Missing startup delay in Q-SYS Lua or Crestron SIMPL+ code that routes audio/video
- Factory reset command without a backup step in the plan
- Any code that writes to production AV devices without reading device state first
