# Workflow: LLM Council Query

> **When to use:** High-stakes or ambiguous AV design decisions where a single model's
> perspective may be insufficient — protocol selection, multi-vendor interop, security
> architecture, or conflicting vendor documentation.
>
> **Plugin:** [plugins/llm-council/plugin.md](../plugins/llm-council/plugin.md)
> **Slot in main workflow:** Between Researcher (02) and Planner (03)

---

## Trigger Conditions

The Orchestrator initiates this workflow when any of the following are true:

- [ ] Two or more valid implementation approaches exist with non-obvious trade-offs
- [ ] Vendor documentation is ambiguous or contradictory
- [ ] The task spans multiple AV subsystems (control + DSP + video + UC)
- [ ] A previous similar change caused a regression or incident
- [ ] The user explicitly requests "get a second opinion" or "council review"

---

## Pre-conditions

- [ ] Researcher (02) has written `.agent-workspace/research-findings.md`
- [ ] LLM Council is running at http://localhost:5173
  (If not: `cd ~/tools/llm-council && ./start.sh`)
- [ ] `OPENROUTER_API_KEY` is set in `~/tools/llm-council/.env`

---

## Steps

### Step 1 — Orchestrator: Formulate the Council Query

The Orchestrator composes a precise query using this template:

```
## AV Design Question

**Context:**
- System: [room type, device models, firmware versions — use generic IDs, not real hostnames]
- Goal: [what we're trying to achieve in one sentence]
- Constraints: [VLAN rules, vendor API rate limits, maintenance window, no downtime, etc.]

**Question:**
[The specific technical question]

**Options considered:**
1. [Option A] — [brief description]
2. [Option B] — [brief description]
(add more if needed)

**Please evaluate each option and recommend the best approach, covering:**
- Trade-offs
- AV-specific compatibility risks (firmware, protocol, timing)
- Recommended implementation order
- Edge cases for AV control systems
```

> **Security reminder:** Sanitize the query. Replace real building codes, room IDs,
> internal hostnames, and network addresses with generic identifiers before pasting
> into LLM Council.

---

### Step 2 — User: Run the Council Query

1. Open http://localhost:5173
2. Paste the query from Step 1 into the input field
3. Submit and wait for all three stages to complete:
   - Stage 1: Individual responses from each council member
   - Stage 2: Peer review / cross-evaluation (anonymized)
   - Stage 3: Chairman's synthesis
4. Review the Chairman's final answer and note any significant dissent from other models

---

### Step 3 — User: Save Synthesis to Workspace

Copy the Chairman's synthesis into the agent hand-off file:

**File:** `.agent-workspace/council-synthesis.md`

```markdown
# LLM Council Synthesis

## Query Summary
[One sentence describing what was asked]

## Chairman's Recommendation
[Paste the Chairman model's final synthesis verbatim]

## Dissenting Views (if any)
[Note any significant disagreement worth flagging to the Planner]

## Council Run Details
- Date: YYYY-MM-DD
- Models: [list of council members]
- Chairman: [chairman model name]
- Related ticket / task: [task ID or description]
```

---

### Step 4 — Orchestrator: Hand off to Planner

Launch the Planner (03) with both documents:

```
You are the Planner agent for the AVops project.

## Research Findings
[Contents of .agent-workspace/research-findings.md]

## LLM Council Synthesis
[Contents of .agent-workspace/council-synthesis.md]

## Task
[Original task description]

Design an implementation plan. Where the Council's recommendation conflicts with the
Research Findings, flag it explicitly and present the trade-off to the user before
committing to an approach.
```

---

### Step 5 — User Review Gate

Before the Planner's output is passed to the Implementer:

- [ ] Review the implementation plan against the Council synthesis
- [ ] Confirm the chosen approach aligns with AV-specific constraints
- [ ] Approve or request changes (standard human review gate)

---

## Output Files

| File | Written By | Contents |
|------|-----------|---------|
| `.agent-workspace/research-findings.md` | Researcher (02) | Codebase & device research |
| `.agent-workspace/council-synthesis.md` | User (manually) | Chairman's recommendation |
| `.agent-workspace/implementation-plan.md` | Planner (03) | Final approved plan |

---

## Abort Conditions

Stop and flag to the user if:

- Council models produce **unanimous disagreement** with the Researcher's findings —
  re-run research before proceeding
- Council synthesis recommends an approach that **requires live device changes during
  business hours** — escalate for maintenance window approval
- Any council model flags a **security concern** not identified in research — add it to
  the review checklist for the Reviewer (06)
