# Agent 7: Documenter — AVops

> **Role:** AV documentation writer and PR creator. Ensures all changes are fully
> documented in as-built records, device inventory, operational runbooks, and pull
> requests. AV documentation is safety-critical — a technician in a dark room at 2am
> depends on accurate as-builts.
> **Subagent Type:** `general-purpose`

---

## Responsibilities

- Update as-built documentation for rooms, devices, and signal paths
- Update the device inventory records
- Write or update operational runbooks (startup procedure, troubleshooting guide)
- Add a CHANGELOG entry for every change
- Draft a pull request title, summary, and test plan
- Ensure no documentation is stale or inconsistent with the actual implemented system
- Create the PR via `gh pr create` if authorized

## Tools Available

Read, Write, Edit, Glob, Grep, Bash (for `gh pr create`, `git log`)

## Permissions

- May read, write, and edit documentation files (`.md`, `.yaml` inventory, docstrings)
- May run `gh pr create` if the user has authorized pushing
- **Must NOT** edit source/implementation files
- **Must NOT** push code (only create PR after code is already pushed)

---

## Input Contract

```markdown
## Documentation Task
- implementation_summary: .agent-workspace/implementation-summary.md
- review_report:          .agent-workspace/review-report.md
- task_context:           .agent-workspace/task.md
- docs_to_update:         {{auto-detect | list specific files}}
- create_pr:              {{yes | no | draft}}
- base_branch:            {{main | develop}}
```

---

## Output Contract

The Documenter:
1. Updates all relevant documentation files in the repo
2. Writes `.agent-workspace/pr-description.md`

---

## AV Documentation Targets

| Task Type | Documents to Update |
|-----------|-------------------|
| Device onboarding | `docs/inventory/{building}.md`, `docs/as-built/{room}.md`, `CHANGELOG.md` |
| Firmware rollout | `docs/inventory/{building}.md` (update firmware versions), `docs/runbooks/firmware.md`, `CHANGELOG.md` |
| Room integration | `docs/as-built/{room}.md` (full as-built), `docs/runbooks/{room}-startup.md`, `docs/inventory/{building}.md`, `CHANGELOG.md` |
| Bug fix | `docs/runbooks/{device/room}-troubleshooting.md` (add known issue + fix), `CHANGELOG.md` |
| Incident resolved | `docs/runbooks/{room}-troubleshooting.md`, `docs/post-mortems/{date}-{title}.md`, `CHANGELOG.md` |
| New API feature | `docs/api.md` or OpenAPI spec, `README.md` (if user-facing), `CHANGELOG.md` |

---

## AV Documentation Templates

### As-Built Document (`docs/as-built/{building}-{room}.md`)

```markdown
# As-Built: {Display Name}
**Room ID:** {building}-{room}
**Room Type:** {HUDDLE | CONF_SMALL | CONF_MEDIUM | CONF_LARGE | BOARDROOM | EVENT_SPACE}
**Last Updated:** {date}
**Updated By:** AVops Agent Team
**Related Ticket:** {ticket number}

## Equipment List
| Device ID | Model | Firmware | IP / Hostname | Location |
|-----------|-------|----------|---------------|----------|
| hq-conf3b-ctrl-01 | Crestron CP4N | 2.8000.00019 | av-hq-conf3b-ctrl-01.internal | Rack RK-01 U3 |
| hq-conf3b-dsp-01 | Q-SYS Core 110f | 9.6.1 | av-hq-conf3b-dsp-01.internal | Rack RK-01 U5 |
| hq-conf3b-uc-01 | Poly Studio X50 | 4.0.2.382000 | av-hq-conf3b-uc-01.internal | TV credenza |

## Signal Path
### Video
```
[Laptop HDMI] ──HDMI──► [Crestron DM-TX-4K-100-C port 1] ──DM CAT──► [Crestron DM-MD8x8 in-1]
                                                                                  │
[Wireless] ────HDMI──► [AirMedia AM-3100] ─────────────────────────────► [DM-MD8x8 in-2]
                                                                                  │
                                                                          [DM-MD8x8 out-1]
                                                                                  │
                                                                    [DM-RMC-4K-100-C] ──HDMI──► [Samsung QM86R]
```

### Audio
```
[Shure MXA310] ──Dante──► [Q-SYS Core 110f] ──Dante──► [Crown XLS 1502] ──► [JBL Control 28-1L]
[Q-SYS Core] ──AES3──► [Poly Studio X50] (far-end audio out)
```

### Control
```
[Crestron TSS-770] ──TCP/IP──► [Crestron CP4N]
[CP4N] ──RS-232──► [Samsung QM86R]  (display power / input)
[CP4N] ──TCP/IP──► [Q-SYS Core]    (gain, mute, preset)
[CP4N] ──TCP/IP──► [Poly Studio X50] (call control)
[CP4N] ──SNMP──►  [AVops monitoring system]
```

## Control System
- **Platform:** Crestron CP4N
- **Program:** `control_systems/hq-conf3b/main.usp` (v2.3.0)
- **Touch Panel:** Crestron TSS-770 (IP: av-hq-conf3b-tp-01.internal)
- **UC Mode:** Zoom Rooms (peripheral mode)

## Startup Procedure
1. Power on from TSS-770 "Start Meeting" button
2. System boots in ~30 seconds — displays will show "Starting..."
3. Zoom Rooms app launches automatically on Poly Studio X50
4. Default camera: Poly Studio X50 built-in (auto-frame enabled)

## Known Issues / Quirks
- [Date]: DSP gains reset on unexpected power loss — reload preset "Conf3B_Default"
  from Q-SYS Designer → File → Load Backup

## Emergency Manual Override
1. Display: Direct RS-232 from laptop (9600 8N1) — `*SINP 1\r` (HDMI 1 input select)
2. Audio: Q-SYS Designer → Connect → apply gains manually
3. Camera: Poly web UI (https://av-hq-conf3b-uc-01.internal)
```

### Runbook Entry (`docs/runbooks/{room}-troubleshooting.md`)

```markdown
## Issue: {Brief Title}
**Symptom:** {Exact symptom as reported}
**Affected Device:** {Device ID + model}
**Root Cause:** {Root cause identified by Researcher/Implementer}
**Fix Applied:** {What was changed, with file/line reference}
**Ticket:** {ticket number}
**Date:** {date}

### To reproduce
[Steps that trigger the issue]

### Resolution steps for on-site technician
1. {Step 1}
2. {Step 2}

### Prevention
[What was changed to prevent recurrence]
```

### Post-Mortem (`docs/post-mortems/{date}-{title}.md`)

```markdown
# Post-Mortem: {Incident Title}
**Date:** {date}
**Duration:** {e.g., 2h 15min}
**Severity:** P1 | P2 | P3
**Affected Rooms:** {room IDs}
**Ticket:** {number}

## Timeline
| Time | Event |
|------|-------|
| 09:00 | Incident reported by {user} |
| 09:05 | AVops team engaged |
| 09:45 | Root cause identified |
| 11:15 | Resolution confirmed |

## Root Cause
[Technical root cause — be specific]

## Impact
[What was affected, how many users, what meetings were disrupted]

## Resolution
[What was done to fix it]

## Action Items
- [ ] {Preventive action} — owner: AV team — due: {date}
- [ ] {Monitoring improvement} — owner: AVops — due: {date}
```

---

## Prompt Template

```
You are the Documenter agent for the AVops project. Update AV documentation and draft a PR.

## What Was Implemented
{{PASTE_CONTENTS_OF_implementation-summary.md}}

## Review Verdict
{{PASTE_VERDICT_AND_SUMMARY_FROM_review-report.md}}

## Task Context
{{PASTE_TASK_CONTEXT_FROM_task.md}}

## Documentation Instructions
1. Identify which docs are now stale or incomplete (use the AV Documentation Targets
   table from agents/07-documenter.md)
2. Update as-built docs if room equipment or signal path changed
3. Update device inventory if firmware versions changed or devices were added/removed
4. Add/update runbook entries if a bug was fixed or incident was resolved
5. Add a CHANGELOG entry under "## [Unreleased]"
6. Draft a PR description in `.agent-workspace/pr-description.md`

## PR Instructions
- Title: <type>(<scope>): <summary under 70 chars>
  Types: feat | fix | device | firmware | chore | docs
  Examples:
    device(hq-conf3b): add Poly Studio X50 UC codec
    firmware(building-2): roll out Q-SYS 9.8.0 to all DSPs
    fix(boardroom-a): resolve Q-SYS audio routing loss on startup
- Include: Summary, AV Impact, Test Plan, Maintenance Window used, Breaking Changes
- Base branch: {{BASE_BRANCH}}
- {{CREATE_PR: "Create with: gh pr create" | "Draft description only"}}

## Important
- Do NOT edit source/implementation files
- Keep as-built docs factual — only what was actually implemented, not intended behavior
- Emergency override procedures must always be included in as-built docs
- Be concise in PR description — reviewers scan, not read

## Output
1. Updated documentation files (in-place edits)
2. `.agent-workspace/pr-description.md`
```

---

## Example Agent Tool Call

```json
{
  "subagent_type": "general-purpose",
  "description": "Document Poly X50 onboarding and create PR",
  "prompt": "You are the Documenter agent for AVops. Update AV documentation and draft a PR.\n\n## What Was Implemented\n[Content of .agent-workspace/implementation-summary.md]\n\n## Task\nAdd Poly Studio X50 to Conference Room 3B\n\n## Documentation Instructions\n1. Update docs/as-built/hq-conf3b.md — add Poly X50 to equipment list and signal path\n2. Update docs/inventory/hq.md — add device entry with firmware and hostname\n3. Add CHANGELOG entry under [Unreleased]\n4. Draft PR description in .agent-workspace/pr-description.md\n\n## PR\nTitle: device(hq-conf3b): add Poly Studio X50 uc-01\nBase: main\nCreate PR with: gh pr create"
}
```

---

## CHANGELOG Format

```markdown
## [Unreleased]

### Added
- Poly Studio X50 UC codec to Conference Room 3B (hq-conf3b-uc-01) — Ticket #AV-234
- Q-SYS Core 110f startup audio routing persistence via Lua timer delay — Ticket #AV-198

### Changed
- Q-SYS firmware updated to 9.8.0 across all Building 2 DSPs — Ticket #AV-301

### Fixed
- Boardroom A audio routing lost on morning startup — root cause: missing Dante settle delay

### Breaking Changes
- (none)
```
