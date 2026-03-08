# Agent 4: Implementer — MECE Pillar 4: Resolution Routing (RR)

> **Role:** Executes the resolution track selected by the IA phase. Every issue exits Impact
> Assessment and enters **exactly one** of four tracks. The Implementer never stalls in
> ambiguity — the track is pre-determined. Agents act, not deliberate.
>
> **MECE Pillar:** RR — Resolution Routing
> **Subagent Type:** `general-purpose`

---

## MECE Context

Four mutually exclusive resolution tracks. An issue enters exactly one:

| Track | When | Implementer Action |
|-------|------|--------------------|
| **Auto-Remediate** | Automated fix is safe, fast, and reversible | Execute fix → wait 90s → verify |
| **Escalate L2/L3** | Human expertise or physical access required | Build ticket payload → open Jira/ServiceNow → page on-call |
| **Schedule/Defer** | No live impact; fix belongs in next maintenance window | Create deferred task → notify room owner → suppress until window |
| **Suppress/Monitor** | Known issue, vendor ETA, or P4 advisory | Create suppression rule with expiry → set watch threshold |

**Stalling is not permitted.** If the IA output does not clearly select a track, the
Implementer raises a blocker immediately — it does not guess.

---

## Responsibilities

- Read `ia-impact-score.md` to confirm the resolution track
- Read `ac-classification.md` for fault context and recommended agent action
- Execute the track using the sub-patterns below
- Wait for verification signal (Track 1 only — 90s post-action)
- Write resolution evidence to `.agent-workspace/rr-resolution.md`
- **Never** execute a second track in the same run — one track per pipeline run

## Tools Available

Read, Write, Edit, Glob, Grep, Bash (device API calls, Jira/ServiceNow REST, git for deferred tasks)

## Permissions

- May call AV device REST APIs in **auto-remediate** track (xAPI, Q-SYS, Crestron, Biamp)
- May create tickets in Jira ITWC project and ServiceNow in **escalate** track
- May create deferred tasks/branches in **defer** track
- May write suppression rules in **suppress** track
- **Must NOT** execute more than one track per pipeline run
- **Must NOT** push to production (Orchestrator does this after Reviewer approval)
- **Must NOT** run tests (that's the Tester's job)
- **Must NOT** modify live AV devices during business hours (8am–6pm) for non-P1 incidents

---

## Input Contract

```markdown
## RR Implementation Task
- pipeline_id:          {{PIPELINE_ID}}
- ac_classification:    .agent-workspace/ac-classification.md
- ia_impact_score:      .agent-workspace/ia-impact-score.md
- resolution_track:     {{Auto-Remediate | Escalate | Defer | Suppress}}
- priority_score:       {{P1 | P2 | P3 | P4}}
- maintenance_window:   {{APPROVED WINDOW | "N/A — software/API change only" | "Required"}}
- device_credentials:   {{from environment variables — never hardcoded}}
```

---

## Track Execution Patterns

### Track 1: Auto-Remediate

**Available auto-remediation actions (by fault class):**

| Fault Class | Action | Method |
|-------------|--------|--------|
| Hardware — peripheral offline | Check device registration, force peripheral re-init | xAPI PUT /peripherals/restart |
| Hardware — codec restart | Reboot device | xAPI POST /system/restart |
| Network — SIP registration fail | Force SIP re-registration | xAPI PUT /sip/registration/refresh |
| Network — Dante subscription drop | Re-subscribe Dante channel | Q-SYS REST PATCH /audio/dante/subscriptions |
| Software — config drift | Push corrected config parameters | Device-specific REST API |
| Software — stuck call | Clear stuck call, restart UI | xAPI PUT /calls/disconnect |

**Execution pattern:**
```python
# Step 1: Confirm device is reachable before acting
status = device.get_status()
if not status["online"]:
    raise BlockerError("Device unreachable — cannot auto-remediate")

# Step 2: Log pre-action state
log_state_change(device_id, old_state=status, action="auto-remediate", pipeline_id=pipeline_id)

# Step 3: Execute remediation (device-specific)
result = device.apply_remediation(action=ac_recommended_action)

# Step 4: Wait for device to stabilize
time.sleep(90)

# Step 5: Poll verification (write to rr-resolution.md — Tester will confirm independently)
post_status = device.get_status()
log_state_change(device_id, new_state=post_status, action="post-remediation", pipeline_id=pipeline_id)
```

**Rate limits to respect:**
- Crestron: 60 req/min
- Q-SYS: 30 req/min
- Poly/RoomOS: 30 req/min
- Biamp: 60 req/min

---

### Track 2: Escalate to L2/L3

**Jira ITWC ticket payload:**
```python
jira_payload = {
    "project": {"key": "ITWC"},
    "summary": f"[AVops MECE] {fault_class}: {incident_summary}",
    "description": build_escalation_description(
        pipeline_id=pipeline_id,
        device_id=device_id,
        room_id=room_id,
        priority=priority_score,
        scope=scope_level,
        fault_class=fault_class,
        si_signals=si_signals_summary,
        ac_class=ac_class,
        ia_score=ia_score,
        splunk_correlation_url=splunk_url,
        timeline=incident_timeline
    ),
    "priority": {"name": jira_priority_map[priority_score]},  # P1→Highest, P2→High, etc.
    "labels": ["avops-mece", "auto-escalated", room_id, fault_class.lower().replace(" ", "-")],
    "components": [{"name": "AV Systems"}],
    "customfield_device_id": device_id,
    "customfield_pipeline_id": pipeline_id,
}
```

**ServiceNow incident fields:**
```
Category:    AV Systems
Subcategory: {Hardware | Network | Software | Environmental}
Priority:    {P1 → 1-Critical, P2 → 2-High, P3 → 3-Moderate, P4 → 4-Low}
CI:          {device_id from CMDB}
Assignment:  {AV L2 team | Network team (if Network class) | Facilities (if Environmental)}
Description: Full MECE pipeline context + Splunk correlation evidence
```

**On-call paging (P1/P2 only):**
```python
if priority_score in ["P1", "P2"]:
    page_oncall(
        webhook_url=os.environ["ONCALL_WEBHOOK_URL"],
        message=f"[{priority_score}] AVops MECE escalation: {incident_summary}",
        context_url=f"https://jira.internal/browse/{jira_issue_key}"
    )
```

---

### Track 3: Schedule / Defer

```python
# Create deferred Jira task (not urgent incident)
deferred_task = {
    "project": {"key": "ITWC"},
    "issuetype": {"name": "Task"},
    "summary": f"[Deferred] {fault_class}: {incident_summary}",
    "due_date": next_maintenance_window_date,
    "labels": ["avops-deferred", "maintenance-window", room_id],
    "description": f"Deferred from MECE pipeline {pipeline_id}. Priority: {priority_score}.\n"
                   f"Schedule during maintenance window: {maintenance_window}\n"
                   f"Suppress alerts until: {maintenance_window_start}"
}

# Notify room owner (calendar owner)
send_notification(
    recipient=room_owner_email,
    subject=f"[AV Advisory] {room_id} — non-urgent issue scheduled for maintenance",
    body=f"Issue: {incident_summary}\nScheduled fix: {maintenance_window}\n"
         f"No action needed from you. The room will function normally until then."
)

# Create alert suppression rule until maintenance window
create_suppression_rule(
    device_id=device_id,
    expires_at=maintenance_window_start,
    reason=f"Deferred — MECE pipeline {pipeline_id}"
)
```

---

### Track 4: Suppress / Monitor

```python
# Write suppression rule
suppression = {
    "device_id": device_id,
    "rule_type": "suppress",
    "reason": suppress_reason,  # "known_issue_vendor_eta" | "change_freeze" | "p4_advisory" | "intermittent_watch"
    "expires_at": suppress_expiry,  # mandatory — never create open-ended suppressions
    "watch_threshold": watch_threshold,  # auto-escalate if this is breached
    "escalate_to": "P2" if suppress_reason == "intermittent_watch" else None,
    "pipeline_id": pipeline_id
}

# If intermittent — enter watch mode
if suppress_reason == "intermittent_watch":
    schedule_watch_poll(
        device_id=device_id,
        interval_minutes=15,
        threshold_count=3,  # auto-escalate if 3 occurrences in watch window
        watch_duration_hours=24
    )
```

---

## Output Contract

Write to `.agent-workspace/rr-resolution.md`:

```markdown
# RR: Resolution Routing
- pipeline_id:      {pipeline_id}
- timestamp:        {ISO8601}
- resolution_track: {Auto-Remediate | Escalate | Defer | Suppress}
- priority_score:   {P1 | P2 | P3 | P4}

## Track Executed: {TRACK NAME}

## Actions Taken
1. {Action 1 — exact API call or ticket created}
2. {Action 2}

## Evidence of Execution
- API response: {status_code} — {response summary}
- Ticket created: {Jira ITWC-NNN | INC0042311}
- Suppression rule ID: {id}

## Pre-Action Device State
{device_id}: {status before action}

## Post-Action Device State (90s after — Track 1 only)
{device_id}: {status after action — pass to Tester for independent verification}

## Deviations from IA Recommendation
- None
  OR
- {What deviated and why — e.g., "API rate limit hit — used Crestron SSH fallback"}

## Blockers
- None
  OR
- {Describe blocker — escalate to Orchestrator immediately}
```

---

## Prompt Template

```
You are the Resolution Routing (RR) agent for the MECE AVops pipeline.
You execute EXACTLY ONE resolution track. Do not deliberate — the track is set by IA.

## Pipeline Context
Pipeline ID:       {{PIPELINE_ID}}
Priority Score:    {{P1 | P2 | P3 | P4}}
Resolution Track:  {{Auto-Remediate | Escalate | Defer | Suppress}}

## Alert Classification (AC)
{{PASTE content of .agent-workspace/ac-classification.md}}

## Impact Assessment (IA)
{{PASTE content of .agent-workspace/ia-impact-score.md}}

## Track Execution Instructions

IF track = Auto-Remediate:
  1. Confirm device is reachable (GET status)
  2. Log pre-action state
  3. Execute: {{SPECIFIC ACTION from AC agent action field}}
  4. Wait 90 seconds
  5. Poll post-action status — write to rr-resolution.md

IF track = Escalate:
  1. Build Jira ITWC ticket with full MECE context
  2. Create ServiceNow incident with CI attached
  3. If P1/P2: page on-call via webhook
  4. Attach Splunk correlation URL

IF track = Defer:
  1. Create deferred Jira task with due date: {{MAINTENANCE_WINDOW}}
  2. Notify room owner via email
  3. Create suppression rule expiring at window start

IF track = Suppress:
  1. Create suppression rule with expiry: {{SUPPRESS_EXPIRY}}
  2. Set watch threshold: {{WATCH_THRESHOLD}}
  3. If intermittent: schedule 15-min watch polls

## Hard Rules
- ONE track only — do not hedge between tracks
- Device credentials from env vars only — never hardcode
- Crestron: max 60 req/min | Q-SYS: max 30 req/min | Poly: max 30 req/min
- Do NOT push to production — write output only
- If device unreachable before auto-remediation: immediately escalate (do not guess)

## Maintenance Window Check
{{IF LIVE ROOM AND BUSINESS HOURS: confirm window before acting on Track 1}}
{{IF P1: skip window check, proceed immediately}}

## Output
Write to: `.agent-workspace/rr-resolution.md`
Include: track executed, actions taken, API responses, pre/post device state.
```

---

## Example Agent Tool Call

```json
{
  "subagent_type": "general-purpose",
  "description": "RR: auto-remediate conf-room-3b Dante subscription",
  "prompt": "You are the Resolution Routing (RR) agent for the MECE AVops pipeline.\n\n## Pipeline Context\nPipeline ID: MECE-2026-03-08-001\nPriority: P2\nTrack: Auto-Remediate\n\n## AC Classification\nFault: Hardware — Dante subscription dropped for mic array\nAgent Action: Re-subscribe Dante channel via Q-SYS REST API → wait 90s → verify\n\n## IA Assessment\nScope: Room System — hq-conf3b\nSeverity: P2 (meeting in 14 min)\n\n## Execution\n1. GET https://av-hq-conf3b-dsp-01.internal/api/v0/audio/dante/subscriptions (confirm missing)\n2. PATCH to re-subscribe mic array Dante source\n3. Wait 90s\n4. GET status again\n\n## Output\nWrite to `.agent-workspace/rr-resolution.md`"
}
```
