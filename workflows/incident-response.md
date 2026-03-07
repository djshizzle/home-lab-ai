# Workflow: AV Incident Response

> Use this workflow for active AV incidents: room down, signal loss, device unreachable,
> audio/video failure during a meeting, or any P1/P2 outage affecting end users.
>
> ⚡ SPEED IS PRIORITY. Skip Planner for P1/P2. Fix first, document after.
>
> Agents: Orchestrator → Researcher → Implementer (fast-fix) → Tester → Documenter
> Reviewer is OPTIONAL for P1/P2 — run only if time permits and change is non-trivial.

---

## Severity Definitions

| Priority | Definition | Target Resolution |
|----------|-----------|------------------|
| P1 — Critical | Room completely down; live meeting/event impacted | 30 minutes |
| P2 — High | Major function broken (audio or video, not both); meeting degraded | 2 hours |
| P3 — Normal | Intermittent issue; not actively disrupting meetings | Same day |
| P4 — Low | Minor issue; cosmetic or non-critical function | Next business day |

---

## Phase 1: Triage (Orchestrator — immediate)

```
[ ] 1.1  Classify severity (P1–P4) using definitions above
         If P1: skip steps 1.2-1.4 and go directly to Phase 2

[ ] 1.2  Gather incident context (quickly — ask the user or pull from ticket):
         - Room ID and building
         - Affected device(s) or system (if known)
         - Symptom: exact error, what is and isn't working
         - Time incident started
         - Any recent changes (firmware update, construction, power event, cable work)?
         - Number of users affected
         - Is an active meeting happening RIGHT NOW?

[ ] 1.3  Create .agent-workspace/task.md:
         task_type: incident
         priority: P{1|2|3|4}
         room_scope: {room_id}
         device_scope: {device(s) or "unknown"}
         symptom: {exact symptom verbatim}
         meeting_in_progress: {yes | no}

[ ] 1.4  Create TodoWrite list:
         - [ ] Research root cause
         - [ ] Apply fast fix (P1/P2) or implement fix (P3/P4)
         - [ ] Validate fix
         - [ ] Document root cause and resolution
         - [ ] Post-mortem (P1/P2 only)
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Launch Researcher — FAST mode for P1/P2 (quick thoroughness level)
         Priority questions:
         1. Is the device reachable? (ping, API call, web UI)
         2. What do device event logs show? (errors, reboots, timeouts)
         3. What changed recently? (git log for configs, firmware history, physical changes)
         4. Is this a known vendor bug for this firmware version?
         5. Are adjacent devices/rooms on the same DSP, control system, or Dante network affected?
         6. What was the last successful state of this room?

[ ] 2.2  Researcher collects from codebase:
         - src/rooms/{room_id}/config.yaml — current expected state
         - control_systems/{room}/ — control system program
         - docs/as-built/{building}-{room}.md — signal path reference
         - docs/runbooks/{room}-troubleshooting.md — known issues
         - git log --oneline -20 — recent changes

[ ] 2.3  Researcher also checks (web-based for P3/P4, knowledge-based for P1/P2):
         - Known vendor bugs for current firmware version + symptom
         - Community forums or vendor KB for exact error message

[ ] 2.4  For P1: Researcher returns findings in <10 minutes
         Orchestrator reads and forms a rapid hypothesis — does not wait for perfect info.
```

**Research output:** `.agent-workspace/research-findings.md`

---

## Phase 2b: Rapid Triage Checklist (Orchestrator runs concurrently)

While Researcher is running, Orchestrator works through this checklist:

```
PHYSICAL CHECKS (delegate to on-site technician if available):
[ ] Power: Is the device powered on? (check PDU, check power LED)
[ ] Cables: Are all cables seated? (HDMI, Dante, control, power)
[ ] Network: Is the device reachable on the AV VLAN? (ping from management host)

QUICK SOFTWARE CHECKS:
[ ] Can the AVops API reach the device? GET /api/devices/{device_id}/status
[ ] Is the device's web UI accessible? (https://{hostname})
[ ] Is the control system (Crestron/QSC) online and connected to this device?
[ ] Are Dante subscriptions active (if audio issue)?

QUICK ISOLATION:
[ ] Does the issue affect ONLY this room, or multiple rooms?
[ ] Is the same symptom on the primary device or the backup path?
[ ] Does a reboot resolve it? (if P2/P3 and no meeting in progress)
```

---

## Phase 3: Fast Fix (Implementer → general-purpose agent)

> For P1/P2: Orchestrator may create an inline fix plan (no Planner agent).
> For P3/P4: Use the standard bug-fix workflow Phase 3 if the fix is non-trivial.

```
[ ] 3.1  Orchestrator reads research findings and forms a fix hypothesis:

         Fast Fix Plan (inline — no separate Planner agent for P1/P2):
         Root cause: [from research]
         Fix: [specific change — config, code, device command, restart]
         File: [file:line or "none — device-level fix only"]
         Risk: [low | medium — escalate high risk fixes to user first]
         Rollback: [how to undo in <60 seconds if fix makes things worse]

[ ] 3.2  For P1 fixes that are device-level ONLY (no code change):
         Orchestrator may execute the fix directly via API or documented procedure
         without launching Implementer agent.
         Examples:
         - Reboot a device via AVops API: POST /api/devices/{id}/reboot
         - Reload a DSP preset via API
         - Push a known-good config via the control system
         - Manually override HDMI input via RS-232 command

[ ] 3.3  For fixes that require code/config changes:
         Launch Implementer with the inline fix plan
         Emphasize: minimal change — fix the symptom, don't refactor

[ ] 3.4  Wait for .agent-workspace/implementation-summary.md (or confirm device-level fix)
```

---

## Phase 4: Validation (Tester → general-purpose agent)

```
[ ] 4.1  For P1/P2 in-meeting incidents:
         Tester runs a fast validation checklist (not full suite):
         - Is the primary symptom resolved?
         - Can the affected room start a new meeting end-to-end?
         - Are any adjacent rooms affected by the fix?

[ ] 4.2  For P3/P4 post-meeting fixes:
         Run full test suite as per bug-fix workflow Phase 4

[ ] 4.3  If fix does NOT resolve the issue:
         - Revert the fix immediately (rollback step from fix plan)
         - Return to Phase 2 with new hypothesis
         - If 2 hypotheses have failed on P1: escalate to vendor support immediately

[ ] 4.4  Escalation triggers:
         - P1 not resolved in 30 min → escalate to AV team lead + vendor support
         - Fix made room worse → immediately revert + escalate to user
         - Physical hardware failure confirmed → dispatch on-site technician
```

**Validation output:** `.agent-workspace/test-results.md` (abbreviated for P1/P2)

---

## Phase 5: Code Review (Conditional)

```
[ ] 5.1  For P1/P2 fast fixes:
         Skip Reviewer if the fix is:
         - A device reboot
         - A preset reload
         - A config value restoration (reverting a recent change)
         - A one-line code fix with an obvious root cause

         Run Reviewer if the fix is:
         - A new function or module (>20 lines)
         - A control system program change
         - A device driver behavioral change

[ ] 5.2  For P3/P4 fixes: always run Reviewer (as per bug-fix workflow)
```

---

## Phase 6: Documentation (Documenter → general-purpose agent)

```
[ ] 6.1  Update troubleshooting runbook:
         docs/runbooks/{room}-troubleshooting.md
         Add entry: symptom, root cause, resolution steps (for next technician)

[ ] 6.2  For P1/P2: Create post-mortem document:
         docs/post-mortems/{date}-{room_id}-{brief_title}.md
         Include: timeline, root cause, impact, resolution, action items

[ ] 6.3  Update as-built if the root cause revealed an error in documentation:
         docs/as-built/{building}-{room}.md

[ ] 6.4  CHANGELOG entry:
         "fix({room_id}): {brief description} — root cause: {cause}"

[ ] 6.5  For P1/P2: action items must be tracked:
         - Create follow-up tickets for preventive actions
         - If firmware bug: schedule firmware update workflow
         - If hardware failure: initiate replacement/RMA process
```

---

## Phase 7: Completion

```
[ ] 7.1  Confirm incident resolved with the reporting user / helpdesk ticket
[ ] 7.2  Summarize for user:
         - Room: {room_id} — {now operational | still degraded}
         - Root cause: {brief}
         - Fix applied: {what was done}
         - Time to resolution: {duration}
         - Post-mortem: docs/post-mortems/{filename}
         - Action items: {list or "none"}
         - PR/commit: {link or hash}

[ ] 7.3  Mark all TodoWrite tasks complete
[ ] 7.4  Close or update helpdesk ticket with resolution summary
```

---

## Incident Response Quick Reference

### Common P1 Fixes (no code required)

| Symptom | First action | Second action |
|---------|-------------|---------------|
| Room display black — no signal | Check HDMI cable seating | Select correct input via RS-232 |
| No audio in room | Check Dante Controller — missing subscriptions | Reload DSP preset |
| Control touchpad unresponsive | Power cycle touchpad | Reboot control processor |
| Zoom/Teams camera not detected | Unplug/replug USB on codec | Reboot codec |
| "No internet" on MTR/Zoom screen | Check network switch port | Reboot codec |
| DSP clipping/distortion | Check input gain — reduce by 6dB | Reload "Default" preset |
| Projector won't turn on | Check IP/serial connection | Power cycle via PDU |
| Video wall frozen | Reboot display controllers | Check HDMI/NDI source |
| AVoIP stream dropped | Restart encoder via API | Check multicast routing on switch |

### Escalation Contacts (customize for your org)

```
L1 — AV Helpdesk:     {phone} / {email}
L2 — AV Engineering:  {phone} / {email}
L3 — AV Vendor Support:
  - Crestron:   1-888-273-7876
  - QSC:        1-800-854-4079
  - Biamp:      1-800-826-1457
  - Extron:     1-800-633-9876
  - Poly:       support.poly.com
  - Cisco:      1-800-553-2447
  - Shure:      1-800-516-2525
```
