# Workflow: MECE AVops Incident Pipeline

> Use this workflow for any AV alert, monitoring event, or incident that must be routed
> through the 5-pillar MECE framework. Every issue enters at Signal Ingestion and exits
> at Closure & Learning — no gaps, no overlaps, no stalling.

---

## When to Use This Workflow

| Trigger | Use MECE pipeline? |
|---------|-------------------|
| Splunk alert fires for an AV device | YES |
| ServiceNow incident created for AV room | YES |
| Webex Control Hub device goes offline | YES |
| SNMP trap from AV infrastructure | YES |
| Proactive health check detects drift | YES |
| User reports AV issue in a room | YES |
| Firmware rollout or room integration | NO → use firmware-rollout.md / room-integration.md |
| New software feature request | NO → use standard-feature.md |

---

## Agent Assignments

| Step | Pillar | Agent File | Subagent Type | Output |
|------|--------|-----------|---------------|--------|
| 1 | SI — Signal Ingestion | `agents/mece/02-researcher-si.md` | `Explore` | `.agent-workspace/si-signals.md` |
| 2 | AC — Alert Classification | `agents/mece/03-planner-ac-ia.md` | `Plan` | `.agent-workspace/ac-classification.md` |
| 3 | IA — Impact Assessment | `agents/mece/03-planner-ac-ia.md` | `Plan` | `.agent-workspace/ia-impact-score.md` |
| 4 | RR — Resolution Routing | `agents/mece/04-implementer-rr.md` | `general-purpose` | `.agent-workspace/rr-resolution.md` |
| 5a | CL — Verification | `agents/mece/05-tester-cl-verify.md` | `general-purpose` | `.agent-workspace/cl-verification.md` |
| 5b | CL — Quality Gate | `agents/mece/06-reviewer-rr-quality.md` | `general-purpose` | `.agent-workspace/review-report.md` |
| 5c | CL — Doc + Trend + Loop | `agents/mece/07-documenter-cl.md` | `general-purpose` | `.agent-workspace/cl-closure.md` |

> Steps 2 and 3 (AC + IA) are run as a **single Agent tool call** to the Planner.
> Steps 5a and 5b (Tester + Reviewer) may run **sequentially** — Reviewer needs Tester output.

---

## Workflow Execution Steps

### 0. Initialize Pipeline

```bash
# Orchestrator creates workspace files
pipeline_id="MECE-$(date +%Y-%m-%d)-$(uuidgen | cut -c1-4)"
mkdir -p .agent-workspace/backups
```

TodoWrite task list:
```
- [ ] SI: Ingest and normalize all 4 signal buckets
- [ ] AC: Assign exactly one fault class
- [ ] IA: Score scope + severity, apply context, produce priority score
- [ ] [User confirmation if P1/P2]
- [ ] RR: Execute one resolution track
- [ ] CL-Verify: Independent verification of resolution
- [ ] CL-Review: MECE logic quality gate
- [ ] CL-Doc: Documentation, trend analysis, feedback loop
```

---

### 1. SI — Signal Ingestion

**Launch Agent (foreground — needed before AC):**
```json
{
  "subagent_type": "Explore",
  "description": "SI: ingest signals for {incident_summary}",
  "prompt": "[Populated from agents/mece/02-researcher-si.md prompt template]"
}
```

**Gate:** Do not proceed until `si-signals.md` exists and contains all 4 buckets.

---

### 2 & 3. AC + IA — Classification & Impact (single Agent call)

**Launch Agent (foreground — P1/P2 gate follows):**
```json
{
  "subagent_type": "Plan",
  "description": "AC+IA: classify and score {incident_summary}",
  "prompt": "[Populated from agents/mece/03-planner-ac-ia.md prompt template]"
}
```

**Gate after AC:** Confirm exactly one fault class assigned. If two classes appear → reject and re-run AC.

**Gate after IA:** Confirm priority score and resolution track are explicit.

**Human confirmation gate (P1/P2):**
```
IF priority_score IN [P1, P2]:
    Orchestrator presents ia-impact-score.md to user:
    "Priority {score} — {scope} scope — {resolution_track} recommended.
    Affected: {room_id}. Confirm routing?"
    Wait for user approval before launching RR.
ELSE:
    Continue automatically.
```

---

### 4. RR — Resolution Routing

**Launch Agent (foreground):**
```json
{
  "subagent_type": "general-purpose",
  "description": "RR: {resolution_track} for {device_id}",
  "prompt": "[Populated from agents/mece/04-implementer-rr.md prompt template]"
}
```

**Track-specific gates:**

| Track | Gate before launching |
|-------|----------------------|
| Auto-Remediate | Confirm device reachable (ping/GET status) |
| Escalate | Confirm ticket system credentials available |
| Defer | Confirm maintenance window date from user or calendar |
| Suppress | Confirm expiry date is set (mandatory) |

**Maintenance window check:**
```
IF track = Auto-Remediate AND room is live AND time is 08:00–18:00 local:
    IF priority = P1:
        → Proceed immediately (no window needed for P1)
    ELSE:
        → AskUserQuestion: "Live room change during business hours.
          Proceed now or schedule for maintenance window?"
```

---

### 5a. CL — Verification (Tester)

**Launch Agent (foreground):**
```json
{
  "subagent_type": "general-purpose",
  "description": "CL-Verify: confirm resolution for {device_id}",
  "prompt": "[Populated from agents/mece/05-tester-cl-verify.md prompt template]"
}
```

**Gate:** If verdict = FAIL → return to Implementer (Track 1: retry once) or escalate (Track 2).

---

### 5b. CL — Quality Gate (Reviewer)

**Launch Agent (foreground — after Tester):**
```json
{
  "subagent_type": "general-purpose",
  "description": "CL-Review: MECE logic quality check",
  "prompt": "[Populated from agents/mece/06-reviewer-rr-quality.md prompt template]"
}
```

**Gate:** APPROVE → proceed to Documenter. REQUEST CHANGES → fix and re-review. BLOCK → stop, present to user.

---

### 5c. CL — Documentation, Trend, Feedback (Documenter)

**Launch Agent (background OK — no downstream dependencies):**
```json
{
  "subagent_type": "general-purpose",
  "description": "CL-Doc: close ticket, update CMDB, trend, feedback",
  "prompt": "[Populated from agents/mece/07-documenter-cl.md prompt template]"
}
```

**Gate:** Confirm `cl-closure.md` shows all 4 CL buckets checked.

---

### 6. Pipeline Complete

Orchestrator confirms:
```
✓ SI: 4 signal buckets ingested
✓ AC: 1 fault class assigned
✓ IA: Priority score produced
✓ RR: 1 resolution track executed
✓ CL-Verify: Resolution confirmed
✓ CL-Review: APPROVE
✓ CL-Doc: CMDB, runbook, ticket, trend, feedback complete

Pipeline {pipeline_id}: CLOSED
MTTR: {minutes}
Resolution: {Auto/Escalate/Defer/Suppress}
AV Build Readiness: {room_id} → {score}
```

---

## Fast Path: P1 Active Call Impacted

For P1 incidents (live call down right now), compress the pipeline:

```
1. SI:  Researcher — run all 4 buckets in parallel (fast, 5-minute limit)
2. AC:  Planner — classify only (skip full IA scoring for speed)
        → Assume P1-Room scope, proceed immediately
3. RR:  Implementer — Auto-Remediate (attempt once) OR Escalate (if not auto-fixable)
        → Skip maintenance window check for P1
4. CL:  Tester → verify (90s wait) → if PASS, proceed
        Documenter runs in background (don't block on documentation for P1)

Target MTTR for P1 fast path: < 15 minutes
```

---

## Parallel SI Pattern (Large Fleet / Multi-Room Incidents)

For fleet-wide or multi-room incidents, launch SI agents in parallel:

```
Agent A: SI — Device Telemetry for all affected rooms
Agent B: SI — ITSM events (all open tickets for affected rooms)
Agent C: SI — Infrastructure logs (Splunk, syslog for affected VLAN)

Each writes to separate files:
- .agent-workspace/si-telemetry.md
- .agent-workspace/si-itsm.md
- .agent-workspace/si-infra.md

Orchestrator merges into si-signals.md before launching AC.
```

---

## Pipeline Failure Recovery

| Failure point | Recovery action |
|--------------|----------------|
| SI incomplete | Re-run Researcher for missing buckets only |
| AC dual-classification | Re-run Planner with explicit instruction: "Rule out 3 classes first" |
| IA missing context multipliers | Re-run Planner with full context checklist |
| RR device unreachable | Switch to Escalate track immediately |
| RR auto-remediation failed | Retry once (90s wait); if still failing → Escalate |
| CL verification FAIL | Re-run Implementer for retry; if still failing → Escalate |
| CL-Review BLOCK | Stop → present review-report.md to user → wait for guidance |
| CL-Doc incomplete | Re-run Documenter for missing buckets only |

---

## Workspace File Index

```
.agent-workspace/
├── pipeline-state.md          # Pipeline ID, status, current pillar
├── si-signals.md              # SI output — normalized signals, all 4 buckets
├── ac-classification.md       # AC output — fault class + evidence
├── ia-impact-score.md         # IA output — priority score + track recommendation
├── rr-resolution.md           # RR output — track executed, actions taken
├── cl-verification.md         # CL-V output — verification verdict
├── review-report.md           # CL quality gate — APPROVE/REQUEST/BLOCK
├── cl-closure.md              # CL-D/T/F output — full closure summary
├── cmdb-update.json           # CMDB delta record
├── trend-update.json          # Splunk KV store update
├── feedback-loop.md           # Automation ratio, confidence delta
└── backups/                   # Pre-change config backups (if any)
```
