# 7-Agent Architecture Setup Guide

> A reusable, tech-stack-agnostic multi-agent system for software development projects
> built on Claude Code's native Agent tool and subagent system.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │           USER REQUEST               │
                        └──────────────────┬──────────────────┘
                                           │
                        ┌──────────────────▼──────────────────┐
                        │         1. ORCHESTRATOR              │
                        │      (main Claude session)           │
                        │  • Routes tasks to workflows         │
                        │  • Manages TodoWrite task list       │
                        │  • Aggregates agent outputs          │
                        │  • Enforces quality gates            │
                        └──────┬───────────┬──────────────────┘
                               │           │
              ┌────────────────┘           └────────────────┐
              │                                             │
   ┌──────────▼──────────┐                    ┌────────────▼────────────┐
   │   2. RESEARCHER      │ ←── parallel ──→  │   2b. RESEARCHER (2nd)  │
   │   (Explore agent)   │    (optional)      │   (Explore agent)       │
   │  • Read-only         │                   │  • Different focus area │
   │  • Maps codebase     │                   └─────────────────────────┘
   │  • Finds reuse opps  │
   └──────────┬──────────┘
              │  research-findings.md
   ┌──────────▼──────────┐
   │    3. PLANNER        │
   │    (Plan agent)      │
   │  • Designs approach  │
   │  • Orders steps      │
   │  • Flags decisions   │
   └──────────┬──────────┘
              │  ⚠ HUMAN REVIEW GATE ⚠
              │  (Orchestrator shows plan to user)
              │  implementation-plan.md
   ┌──────────▼──────────┐
   │   4. IMPLEMENTER     │
   │  (general-purpose)   │
   │  • Writes code       │
   │  • Edits files       │
   │  • Commits changes   │
   └──────────┬──────────┘
              │  implementation-summary.md
   ┌──────────▼──────────┐
   │    5. TESTER         │
   │  (general-purpose)   │
   │  • Runs test suite   │
   │  • Runs lint         │
   │  • Checks criteria   │
   └──────────┬──────────┘
              │  test-results.md
   ┌──────────▼──────────┐
   │    6. REVIEWER       │
   │  (general-purpose)   │
   │  • Reviews diff      │
   │  • Security audit    │
   │  • APPROVE/BLOCK     │
   └──────────┬──────────┘
              │  review-report.md
   ┌──────────▼──────────┐
   │   7. DOCUMENTER      │
   │  (general-purpose)   │
   │  • Updates docs      │
   │  • Creates PR        │
   └──────────┬──────────┘
              │
   ┌──────────▼──────────┐
   │     MERGED ✓         │
   └─────────────────────┘
```

---

## Agent Quick Reference

| # | Name | Subagent Type | Writes | Reads |
|---|------|--------------|--------|-------|
| 1 | Orchestrator | _(main session)_ | `task.md` | all hand-offs |
| 2 | Researcher | `Explore` | `research-findings.md` | codebase |
| 3 | Planner | `Plan` | `implementation-plan.md` | research |
| 4 | Implementer | `general-purpose` | `implementation-summary.md` + code | plan, research |
| 5 | Tester | `general-purpose` | `test-results.md` | implementation |
| 6 | Reviewer | `general-purpose` | `review-report.md` | diff, test results |
| 7 | Documenter | `general-purpose` | docs + `pr-description.md` | summary, review |

---

## Workflow Selection

Choose the right workflow for your task:

| Task Type | Agents Used | Workflow File |
|-----------|-------------|--------------|
| New feature | All 7 | `workflows/standard-feature.md` |
| Bug fix | 1, 2, 4, 5, 6 | `workflows/bug-fix.md` |
| Code review only | 1, 2, 6, 7 | `workflows/code-review.md` |
| Exploration/Q&A | 1, 2 | Launch Researcher directly |

---

## Hand-off Protocol

Agents communicate through files in `.agent-workspace/` (gitignored):

```
.agent-workspace/
├── task.md                   ← Created by Orchestrator at session start
├── research-findings.md      ← Written by Researcher
├── implementation-plan.md    ← Written by Planner
├── implementation-summary.md ← Written by Implementer
├── test-results.md           ← Written by Tester
├── review-report.md          ← Written by Reviewer
└── pr-description.md         ← Written by Documenter
```

**Rule:** Each agent reads the files from upstream agents and writes its own output.
Agents never call other agents directly — the Orchestrator coordinates everything.

---

## Orchestration Patterns

### Pattern A: Sequential (default for features)
```
Researcher → Planner → [USER GATE] → Implementer → Tester → Reviewer → Documenter
```

### Pattern B: Fan-Out Research (for large or unclear scope)
```
Researcher-A ─┐
Researcher-B ─┼─► Planner → ...
Researcher-C ─┘
(all launched in parallel)
```

### Pattern C: Targeted (for bug fixes, small tasks)
```
Researcher → Implementer → Tester → Reviewer
(skip Planner and Documenter)
```

---

## Quality Gates

| Gate | Trigger | Action if Failed |
|------|---------|-----------------|
| Research complete | Before planning | Re-run Researcher with refined focus |
| Plan approved | Before implementation | User modifies plan or Planner revises |
| Tests pass | After implementation | Return to Implementer with failures |
| Review approved | Before docs/PR | Return to Implementer with findings |
| Docs updated | Before PR | Documenter re-runs |

**Human review gate** (mandatory): Orchestrator must show the plan to the user and
wait for explicit approval before launching the Implementer.

---

## Getting Started

### Step 1: Initialize the workspace

```bash
./scripts/init-agent-team.sh
```

### Step 2: Customize CLAUDE.md

Edit `CLAUDE.md` and fill in all `[CUSTOMIZE]` sections:
- Project name and tech stack
- Test, lint, build commands
- Git branch naming conventions
- Code style rules

### Step 3: Start a session

```
User → Orchestrator: "Add X feature to Y component"

Orchestrator:
1. Creates task.md in .agent-workspace/
2. Creates TodoWrite list
3. Selects workflow
4. Launches Researcher agent
5. ... continues through workflow
```

### Step 4: Agent tool call syntax

```json
// In your Claude Code session, launch agents like this:
{
  "subagent_type": "Explore",
  "description": "Research X implementation",
  "prompt": "[paste from agents/02-researcher.md prompt template, filled in]"
}
```

---

## Customization Guide

10 things to change for your project:

1. **`CLAUDE.md` → Project Identity block** — name, purpose, tech stack
2. **`CLAUDE.md` → Quick Commands** — your actual test/lint/build commands
3. **`CLAUDE.md` → Git Conventions** — your branch and commit format
4. **`CLAUDE.md` → Code Style** — your style guide rules
5. **`agents/06-reviewer.md` → Security Checklist** — add tech-stack-specific checks
   (e.g., for Django: CSRF, for Node: prototype pollution, for Go: race conditions)
6. **`agents/07-documenter.md` → Documentation Targets** — your actual doc file paths
7. **`agents/07-documenter.md` → CHANGELOG Format** — your changelog style
8. **`workflows/standard-feature.md`** — add/remove steps for your process
9. **All agent prompt templates** — add project-specific constraints and context
10. **`.agent-workspace/task.md` template** — add fields relevant to your ticketing system

---

## Example: Full Run for "Add Rate Limiting"

```
User: "Add rate limiting to /api/upload — 10 requests per minute per IP"

1. Orchestrator creates task.md, selects standard-feature workflow
   TodoList: [Research] [Plan] [Implement] [Test] [Review] [Document]

2. Researcher (Explore) launched:
   → Finds: src/routes/upload.py, src/middleware/logging.py (pattern to follow)
   → Writes: .agent-workspace/research-findings.md

3. Planner (Plan) launched with research findings:
   → Designs: RateLimiter class, @rate_limit decorator, 3 test cases
   → Writes: .agent-workspace/implementation-plan.md

4. Orchestrator shows plan to user → User approves

5. Implementer (general-purpose) launched with plan:
   → Creates: src/middleware/rate_limit.py
   → Edits: src/routes/upload.py (adds decorator)
   → Creates: tests/test_rate_limit.py
   → Writes: .agent-workspace/implementation-summary.md
   → Commits incrementally

6. Tester (general-purpose) launched:
   → Runs: pytest tests/test_rate_limit.py -v
   → Runs: ruff check src/
   → All pass. Writes: .agent-workspace/test-results.md

7. Reviewer (general-purpose) launched:
   → Runs: git diff HEAD~3 HEAD
   → Finds: IP spoofing risk in rate_limit.py:45
   → Verdict: REQUEST CHANGES
   → Writes: .agent-workspace/review-report.md

8. Orchestrator sends finding back to Implementer → Fix applied → Reviewer re-runs → APPROVE

9. Documenter (general-purpose) launched:
   → Updates: docs/api.md with rate limit documentation
   → Updates: CHANGELOG.md
   → Creates: gh pr create with generated description
   → Writes: .agent-workspace/pr-description.md

10. Orchestrator confirms: PR created at https://github.com/.../pull/42
```

---

## File Index

```
/
├── CLAUDE.md                      # Session bootstrap — customize for your project
├── AGENT-TEAM-SETUP.md            # This file
├── agents/
│   ├── README.md                  # Agent usage quick reference
│   ├── 01-orchestrator.md         # Orchestrator role + hand-off format
│   ├── 02-researcher.md           # Researcher prompt template + output format
│   ├── 03-planner.md              # Planner prompt template + output format
│   ├── 04-implementer.md          # Implementer prompt template + output format
│   ├── 05-tester.md               # Tester prompt template + output format
│   ├── 06-reviewer.md             # Reviewer prompt template + security checklist
│   └── 07-documenter.md           # Documenter prompt template + PR format
├── workflows/
│   ├── standard-feature.md        # Full 7-agent feature workflow
│   ├── bug-fix.md                 # Streamlined bug fix workflow
│   └── code-review.md             # Standalone review workflow
└── scripts/
    └── init-agent-team.sh         # Workspace initializer
```
