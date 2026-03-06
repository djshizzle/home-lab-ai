# 7-Agent Architecture Template — Design Plan
**Project**: home-lab-ai
**Exported**: 2026-03-06
**Branch**: claude/agent-team-template-JPUph
**Purpose**: NotebookLM review copy of the complete 7-agent template plan

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Agent Definitions (Native Claude Code Format)](#agent-definitions)
   - [01 Orchestrator](#01-orchestrator)
   - [02 Researcher](#02-researcher)
   - [03 Planner](#03-planner)
   - [04 Implementer](#04-implementer)
   - [05 Tester](#05-tester)
   - [06 Reviewer](#06-reviewer)
   - [07 Documenter](#07-documenter)
4. [Inter-Agent Communication Protocol](#inter-agent-communication-protocol)
5. [Workflow Patterns](#workflow-patterns)
6. [Quality Gates](#quality-gates)
7. [Safety & Security Layer](#safety--security-layer)
8. [Model Tiers & Cost Rationale](#model-tiers--cost-rationale)
9. [How to Customize for Any Project](#how-to-customize-for-any-project)
10. [Example End-to-End Run](#example-end-to-end-run)

---

## Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │           USER REQUEST               │
                        └──────────────────┬──────────────────┘
                                           │
                        ┌──────────────────▼──────────────────┐
                        │         1. ORCHESTRATOR              │
                        │         model: claude-opus-4-6       │
                        │  • Routes tasks to specialists       │
                        │  • Manages TodoWrite task list       │
                        │  • Aggregates agent outputs          │
                        │  • Enforces quality gates            │
                        └──────┬───────────┬──────────────────┘
                               │           │
              ┌────────────────┘           └────────────────┐
              │                                             │
   ┌──────────▼──────────┐                    ┌────────────▼────────────┐
   │   2. RESEARCHER      │ ←── parallel ──→  │   2b. RESEARCHER (2nd)  │
   │ model: claude-haiku  │    (optional)      │   (different focus)     │
   │  • Read-only         │                   └─────────────────────────┘
   │  • Maps codebase     │
   │  • Finds reuse opps  │
   └──────────┬──────────┘
              │  research/YYYY-MM-DD-[topic].md
   ┌──────────▼──────────┐
   │    3. PLANNER        │
   │  model: opus         │
   │  • Designs approach  │
   │  • Orders steps      │
   │  • Flags risks       │
   └──────────┬──────────┘
              │  ⚠ HUMAN REVIEW GATE ⚠
              │  plans/YYYY-MM-DD-[feature].md
   ┌──────────▼──────────┐
   │   4. IMPLEMENTER     │
   │  model: sonnet       │
   │  • Writes code       │
   │  • Edits files       │
   │  • Runs lint         │
   └──────────┬──────────┘
              │
   ┌──────────▼──────────┐     ┌──────────────────────┐
   │    5. TESTER         │     │    6. REVIEWER        │
   │  model: sonnet       │     │   model: opus         │
   │  • Runs test suite   │     │  • Security audit     │
   │  • Writes new tests  │     │  • APPROVE/BLOCK       │
   │  • Diagnoses fails   │     │  • OWASP checklist    │
   └──────────┬──────────┘     └──────────┬────────────┘
              └──────────┬────────────────┘
                         │  reviews/ + plans verified
              ┌──────────▼──────────┐
              │   7. DOCUMENTER      │
              │  model: sonnet       │
              │  • Docstrings        │
              │  • README updates    │
              │  • CHANGELOG         │
              │  • PR description    │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │      MERGED ✓        │
              └─────────────────────┘
```

**Execution Modes**
- **Sequential** (default): `1 → 2 → 3 → 4 → 5 → 6 → 7`
- **Parallel research**: `1 → {2a ∥ 2b} → 3 → 4 → {5 ∥ 6} → 7`
- **Review-only**: `1 → {2 ∥ 6} → 7`
- **Bug fix**: `1 → 2 → 4 → 5 → 6`

---

## File Structure

```
/project-root/
│
├── CLAUDE.md                          ← Master bootstrap (every agent reads this)
├── AGENT-TEAM-SETUP.md                ← Architecture guide + usage reference
├── .gitignore                         ← Workspace outputs ignored; secrets blocked
│
├── .claude/
│   ├── settings.json                  ← Permission allowlist/denylist
│   │
│   ├── agents/                        ← Native Claude Code subagent definitions
│   │   ├── 01-orchestrator.md         ← YAML frontmatter + system prompt
│   │   ├── 02-researcher.md
│   │   ├── 03-planner.md
│   │   ├── 04-implementer.md
│   │   ├── 05-tester.md
│   │   ├── 06-reviewer.md
│   │   └── 07-documenter.md
│   │
│   ├── hooks/
│   │   ├── pre-tool-validate.sh       ← Blocks: rm -rf, pipe-to-bash, secret files
│   │   └── post-task-notify.sh        ← Logs agent activity to AGENT_STATE.md
│   │
│   └── workspace/                     ← Shared inter-agent file space (gitignored)
│       ├── AGENT_STATE.md             ← Current task status (all agents read/write)
│       ├── research/                  ← Researcher outputs
│       ├── plans/                     ← Planner outputs
│       ├── reviews/                   ← Tester + Reviewer outputs
│       └── docs-drafts/               ← Documenter working files
│
├── agents/                            ← Prompt template reference guides
│   ├── README.md
│   └── 01–07-*.md
│
├── workflows/
│   ├── standard-feature.md            ← 8-phase full-team workflow
│   ├── bug-fix.md                     ← Streamlined 5-agent flow
│   └── code-review.md                 ← Review-only workflow
│
└── scripts/
    └── init-agent-team.sh             ← Workspace initializer + validator
```

---

## Agent Definitions

### 01 Orchestrator

**YAML Frontmatter**
```yaml
name: orchestrator
description: >
  Master coordinator for complex, multi-step development tasks. Use this agent
  as the entry point when a task requires research, planning, implementation,
  testing, review, or documentation. Proactively delegate to specialists.
  Invoke for any feature request, bugfix, refactor, or significant change.
tools: Read, Bash, Glob, Grep, Agent, TodoWrite, AskUserQuestion
model: claude-opus-4-6
```

**Role**: Team lead. Entry point for all work. Decomposes tasks, routes to specialists, aggregates results, enforces quality gates.

**Key Responsibilities**
1. Decompose the user's task into ordered/parallelizable subtasks
2. Route each subtask to the appropriate specialist subagent
3. Maintain `.claude/workspace/AGENT_STATE.md` with current task status
4. Enforce quality gates — never ship without tester + reviewer sign-off
5. Confirm with user before any destructive or irreversible action

**Delegation Message Format** (used in every Agent tool call):
```
TASK: [one clear sentence]
CONTEXT: [file paths, constraints, prior findings]
OUTPUT: Write results to .claude/workspace/[subfolder]/YYYY-MM-DD-[topic].md
SUCCESS CRITERIA: [what done looks like]
```

**Anti-Patterns** (enforced in system prompt):
- Never implement code — delegate to implementer
- Never review own plan — delegate to reviewer
- Never skip research for unfamiliar technology
- Never mark done without tester sign-off

---

### 02 Researcher

**YAML Frontmatter**
```yaml
name: researcher
description: >
  Codebase explorer and knowledge gatherer. Invoked before implementing anything
  unfamiliar. Use to understand existing code structure, API behavior, external
  library patterns, or dependency constraints. Read-only access. Proactively
  invoked before any planning or implementation phase begins.
tools: Read, Glob, Grep, Bash, WebFetch, WebSearch
model: claude-haiku-4-5-20251001
```

**Role**: Fast read-only intelligence. Gathers facts before planning begins.

**Protocol**:
1. Use `Glob` to map directory structure
2. Use `Grep` to find patterns, function names, imports
3. Use `Read` to understand key files in depth
4. Use `WebSearch`/`WebFetch` for external docs (official sources preferred)

**Output file**: `.claude/workspace/research/YYYY-MM-DD-[topic].md`

**Output format**:
```markdown
# Research: [Topic]
## Summary (3-5 bullets)
## Key Findings
## Existing Code to Reuse
## Risks & Gotchas
## Recommendations for Planner
## Open Questions
```

**Hard constraints**: Read-only. No file modifications. No architectural decisions.

---

### 03 Planner

**YAML Frontmatter**
```yaml
name: planner
description: >
  Architecture designer and task breakdown specialist. Invoked after research
  is complete and before any code is written. Creates detailed, unambiguous
  implementation plans. Required before the implementer agent is invoked.
  Read-only access; produces plan documents only — never writes source code.
tools: Read, Glob, Grep, Bash
model: claude-opus-4-6
```

**Role**: Architect. Converts research into unambiguous implementation plans.

**Protocol**:
1. Read research from `.claude/workspace/research/`
2. Read `CLAUDE.md` for conventions
3. Design minimal file changes needed
4. Decompose into tasks (each targets one file, has acceptance criteria)
5. Define test strategy
6. Mark plan status as **DRAFT** — user approves via orchestrator

**Output file**: `.claude/workspace/plans/YYYY-MM-DD-[feature].md`

**Output format**:
```markdown
# Plan: [Feature/Change Name]
**Status**: DRAFT
**Estimated Size**: S | M | L | XL
## Problem Statement
## Approach
## Risk Assessment (table)
## Implementation Tasks (each with: Files, Action, Description, Acceptance criteria, Dependencies)
## Test Strategy
## Rollback Plan
```

**Hard constraints**: Never write code. Never mark plan APPROVED (user does that).

---

### 04 Implementer

**YAML Frontmatter**
```yaml
name: implementer
description: >
  Code writer and refactoring specialist. Invoked only after an approved plan
  exists in .claude/workspace/plans/. Writes production-quality code following
  project conventions from CLAUDE.md. Implements exactly what the plan specifies
  — never invents requirements. Full file write access for source and test files.
tools: Read, Write, Edit, Bash, Glob, Grep
model: claude-sonnet-4-6
```

**Role**: Hands-on engineer. Writes code against the approved plan only.

**Pre-Implementation Checklist** (enforced in system prompt):
1. Read plan — confirm status is APPROVED, not DRAFT
2. Read `CLAUDE.md` for conventions and lint command
3. Read every file to be modified before touching it
4. Surface plan ambiguities to orchestrator — never guess

**Per-Task Workflow**:
1. Read target file(s)
2. Implement the change
3. Run lint command from CLAUDE.md immediately
4. Fix lint errors before next task
5. Commit after logical task groups

**Commit format**: `feat(scope): summary` / `fix(scope): summary`

**Hard constraints**: No out-of-plan features. No test file modifications. No git push.

---

### 05 Tester

**YAML Frontmatter**
```yaml
name: tester
description: >
  Test writing and execution specialist. Invoked after implementation is complete.
  Writes unit, integration, and edge-case tests for all new code. Runs the full
  test suite and diagnoses failures with root causes and fix suggestions.
  Does not modify source code — only writes and runs tests.
tools: Read, Write, Edit, Bash, Glob, Grep
model: claude-sonnet-4-6
```

**Role**: QA engineer. Validates all new code has test coverage; diagnoses failures.

**Protocol**:
1. Run full existing test suite first — stop if pre-existing tests fail
2. Identify coverage gaps per implemented function
3. Write tests covering: happy path, invalid inputs, boundary values, error propagation, state mutations
4. Run and iterate — fix setup/teardown only, never source code

**Test naming**: `test_[what]_[condition]_[expected]`

**Output file**: `.claude/workspace/reviews/YYYY-MM-DD-test-results.md`

**Output format**:
```markdown
# Test Report
## Summary (pre-existing baseline, new tests written, final status)
## New Tests Added (table)
## Failures (error, root cause, recommendation)
## Acceptance Criteria Check (checklist)
```

**Hard constraints**: Never modify source files. Never report "all good" without running tests.

---

### 06 Reviewer

**YAML Frontmatter**
```yaml
name: reviewer
description: >
  Security and code quality reviewer. Invoked after implementation and testing.
  Reviews for security vulnerabilities, logic errors, performance issues, and
  adherence to best practices. Proactively invoked before any code is merged
  or shipped. Read-only access. Produces structured review reports with
  APPROVE / REQUEST CHANGES / BLOCK verdict.
tools: Read, Glob, Grep, Bash
model: claude-opus-4-6
```

**Role**: Security gatekeeper. Blocks vulnerable or broken code from shipping.

**Security Checklist** (OWASP Top 10 baseline):

| Category | Checks |
|----------|--------|
| Injection | SQL, command, XSS, path traversal |
| Auth & Authz | Missing auth, broken access control, insecure tokens, session fixation |
| Secrets | Hardcoded creds, secrets in logs, unencrypted sensitive fields |
| Code Quality | Logic correctness, error handling, resource leaks, race conditions, dead code |
| Performance | N+1 queries, missing indexes, unbounded result sets, blocking I/O |

**Verdict scale**:
| Verdict | When |
|---------|------|
| APPROVE | No critical issues, plan implemented, tests pass |
| REQUEST CHANGES | Issues fixable without redesign |
| BLOCK | Critical security vulnerability or broken functionality |

**Maximum re-review cycles**: 2 before escalating to user.

**Output file**: `.claude/workspace/reviews/YYYY-MM-DD-review-[scope].md`

**Finding format**:
```
CRIT-001: [Title]
File: src/auth.py:42
Category: Injection
Description: ...
Risk: ...
Fix: ...
```

**Hard constraints**: Read-only. Every finding must include file:line. Never approve with criticals.

---

### 07 Documenter

**YAML Frontmatter**
```yaml
name: documenter
description: >
  Documentation writer for user-facing docs, API references, inline docstrings,
  and changelogs. Invoked after a feature is reviewed and approved. Drafts pull
  request descriptions. Writes accurate documentation based on actual implemented
  code — never documents assumed behavior. Can modify source files for docstrings.
tools: Read, Write, Edit, Glob, Grep, Bash
model: claude-sonnet-4-6
```

**Role**: Technical writer. Ensures every shipped feature has correct, complete docs.

**Documentation scope**:
1. **Inline docstrings** — all new public functions/classes, language-native format
2. **README updates** — only sections affected by the change
3. **CHANGELOG** — every feature/fix under `## [Unreleased]`
4. **PR description** — title + summary bullets + motivation + test plan + breaking changes

**Protocol**:
1. Read AGENT_STATE.md for modified files
2. Read plan for intended behavior
3. Read review report for caveats
4. Write docs, then verify against actual code
5. Check for broken cross-references

**Hard constraints**: Only document actual code, not assumed behavior. No placeholder docs.

---

## Inter-Agent Communication Protocol

Agents communicate through files in `.claude/workspace/` — never directly.

```
.claude/workspace/
├── AGENT_STATE.md             ← Shared task status log (all agents read + append)
├── research/
│   └── YYYY-MM-DD-[topic].md  ← Written by Researcher
├── plans/
│   └── YYYY-MM-DD-[feature].md ← Written by Planner; status: DRAFT → APPROVED by user
├── reviews/
│   ├── YYYY-MM-DD-test-results.md   ← Written by Tester
│   └── YYYY-MM-DD-review-[scope].md ← Written by Reviewer
└── docs-drafts/
    └── YYYY-MM-DD-[feature]-docs.md ← Written by Documenter
```

**Rule**: Each agent reads upstream outputs, writes its own output. Orchestrator is the only agent that reads across all subfolders and synthesizes.

**AGENT_STATE.md** is the shared state file. Written by:
- Orchestrator at session start (task description, classification, workflow chosen)
- Implementer when complete (`## Implementation Complete — [date]`)
- Documenter when complete (`## Documentation Complete — [date]`)
- Hook `post-task-notify.sh` after every Write/Edit/Bash/Agent call

---

## Workflow Patterns

### Pattern A: Standard Feature (Full 7-agent pipeline)
```
researcher → planner → [USER GATE] → implementer → tester → reviewer → documenter
```
Use for: new features, significant refactors, anything touching security-sensitive code.
Human gate: Orchestrator shows plan to user and waits for explicit approval before implementation.

### Pattern B: Fan-Out Research
```
researcher-A ─┐
researcher-B ─┼─► planner → implementer → tester → reviewer → documenter
researcher-C ─┘
```
Use for: large scope, multiple subsystems, unfamiliar codebase. All researchers launch in parallel.

### Pattern C: Bug Fix (Targeted)
```
researcher → implementer → tester → reviewer
```
Use for: isolated bugs with clear root cause. Skip Planner and Documenter.

### Pattern D: Code Review Only
```
researcher → reviewer → documenter (PR)
```
Use for: reviewing existing code without new implementation.

### Pattern E: Exploration / Onboarding
```
researcher (multiple, parallel) → orchestrator synthesizes
```
Use for: understanding an unfamiliar codebase before planning work.

---

## Quality Gates

| Gate | When | Action if Failed |
|------|------|-----------------|
| Research complete | Before planning | Re-run Researcher with refined focus |
| Plan approved by user | Before implementation | User modifies or Planner revises |
| Tests pass | After implementation | Return to Implementer with failure details |
| Review APPROVE | Before docs/PR | Return to Implementer with findings; max 2 cycles |
| Docs complete | Before PR creation | Documenter re-runs |

**The human gate is mandatory and non-skippable**: Orchestrator must surface the plan file to the user and receive explicit approval before invoking the Implementer.

---

## Safety & Security Layer

### `.claude/settings.json` — Permission Rules
```json
{
  "permissions": {
    "allow": ["Bash(git log *)", "Bash(git diff *)", "Bash(git status)", "Read(*)"],
    "deny":  ["Bash(rm -rf *)", "Bash(sudo rm *)", "Bash(curl * | bash)", "Bash(wget * | sh)"]
  }
}
```

### `.claude/hooks/pre-tool-validate.sh` — PreToolUse Hook
Runs before every tool execution. Blocks:
- Destructive bash patterns: `rm -rf /`, `rm -rf *`, `sudo rm`, pipe-to-bash/sh
- Writes to secret/credential files: `.env`, `.env.*`, `*.pem`, `*.key`, `secrets.*`, `credentials.*`, `service-account*.json`

Exit code 2 = tool call blocked. Claude sees the stderr message.

### `.claude/hooks/post-task-notify.sh` — PostToolUse Hook
Appends activity log entries to `AGENT_STATE.md` for Write, Edit, Bash, Agent tool uses. Provides a lightweight audit trail within a session.

### `.gitignore` entries
```
# Never commit workspace session files
.claude/workspace/research/*.md
.claude/workspace/plans/*.md
.claude/workspace/reviews/*.md
.claude/workspace/docs-drafts/*.md

# Keep structure
!.claude/workspace/AGENT_STATE.md
!.claude/workspace/**/.gitkeep

# Never commit secrets
.env
.env.*
*.pem
*.key
secrets.*
credentials.*
```

---

## Model Tiers & Cost Rationale

| Agent | Model | Rationale |
|-------|-------|-----------|
| Orchestrator | claude-opus-4-6 | Deep multi-step reasoning; routes the entire team |
| Researcher | claude-haiku-4-5-20251001 | Fast read-only searches; speed > depth |
| Planner | claude-opus-4-6 | Architectural decisions require strongest reasoning |
| Implementer | claude-sonnet-4-6 | Reliable code generation; Opus not needed |
| Tester | claude-sonnet-4-6 | Mechanical test writing + execution; mid-tier sufficient |
| Reviewer | claude-opus-4-6 | Security review requires deep reasoning + recall |
| Documenter | claude-sonnet-4-6 | Structured writing; Opus not needed |

**Cost optimization**: Swap all to `claude-sonnet-4-6` for ~60% cost reduction on non-security-critical projects.

---

## How to Customize for Any Project

### Minimum Required Changes (10 minutes)
1. Edit `CLAUDE.md` — fill in `[CUSTOMIZE]` sections:
   - Project name and tech stack
   - Test command (e.g., `pytest -v` or `npm test`)
   - Lint command (e.g., `ruff check .` or `eslint src/`)
   - Git conventions
   - Code style rules
2. Run `./scripts/init-agent-team.sh` to validate and scaffold workspace

### Tech Stack Examples

**Python / FastAPI**
```yaml
Test command:  pytest -v --tb=short
Lint command:  ruff check . && mypy src/
Source layout: src/ for app code, tests/ for pytest files
```

**Node.js / TypeScript**
```yaml
Test command:  npm test
Lint command:  npx eslint . && npx tsc --noEmit
Build command: npm run build
Source layout: src/ for TS source, dist/ for compiled output
```

**Go**
```yaml
Test command:  go test ./...
Lint command:  go vet ./... && golangci-lint run
Build command: go build ./...
Source layout: cmd/ for entrypoints, internal/ for private packages
```

### Adding a Custom 8th Agent
1. Create `.claude/agents/08-[name].md` with YAML frontmatter
2. Add to CLAUDE.md agent roster table
3. Update Orchestrator's delegation table in `01-orchestrator.md`
4. Claude Code auto-discovers it via the `description` field

### Stack-Specific Security Checks to Add to Reviewer
Add to the reviewer's system prompt under "Additional checks by stack":
- **Django/Rails**: CSRF tokens, mass assignment, `safe` template filters
- **Node.js**: Prototype pollution, ReDoS, `eval` usage, deserialization
- **Go**: Unchecked errors, goroutine leaks, race conditions (`go test -race`)
- **Python**: `pickle`/`yaml.load` deserialization, `eval`/`exec`, SQL via f-strings

---

## Example End-to-End Run

**User request**: "Add rate limiting to /api/upload — 10 requests per minute per IP"

```
Step 1 — Orchestrator
  Creates task in AGENT_STATE.md
  Selects standard-feature workflow
  TodoList: [Research] [Plan] [⚠ User Gate] [Implement] [Test] [Review] [Document]

Step 2 — Researcher (launched by Orchestrator)
  Finds: src/routes/upload.py, src/middleware/logging.py
  Identifies: existing middleware pattern to follow
  Writes: .claude/workspace/research/2026-03-06-rate-limiting.md

Step 3 — Planner (launched with research findings)
  Designs: RateLimiter class, @rate_limit decorator, 3 acceptance criteria
  Status: DRAFT
  Writes: .claude/workspace/plans/2026-03-06-rate-limiting.md

⚠ Step 4 — Human Gate
  Orchestrator surfaces plan to user
  User reviews and approves

Step 5 — Implementer (launched with approved plan)
  Creates: src/middleware/rate_limit.py
  Edits: src/routes/upload.py (adds @rate_limit decorator)
  Creates: tests/test_rate_limit.py
  Runs: ruff check src/ (lint clean)
  Commits: feat(upload): add IP-based rate limiting
  Writes: implementation status to AGENT_STATE.md

Step 6 — Tester (launched)
  Runs: pytest -v (all existing tests pass)
  Adds: 5 new tests (happy path, 429 response, retry-after header, edge cases)
  All pass
  Writes: .claude/workspace/reviews/2026-03-06-test-results.md

Step 7 — Reviewer (launched)
  Runs: git diff HEAD~2 HEAD
  Finds: WARN-001: IP extracted from X-Forwarded-For without validation (spoofable)
  Verdict: REQUEST CHANGES
  Writes: .claude/workspace/reviews/2026-03-06-review-rate-limiting.md

  Orchestrator returns finding to Implementer → fix applied → Reviewer re-runs → APPROVE

Step 8 — Documenter (launched)
  Adds: docstrings to RateLimiter class and @rate_limit decorator
  Updates: README.md API section
  Adds: CHANGELOG.md entry under [Unreleased]
  Drafts: PR description
  Creates: gh pr create

Step 9 — Orchestrator
  Confirms: PR created at https://github.com/.../pull/42
  Updates: AGENT_STATE.md with completion
  Reports to user: summary + PR link
```

---

*Generated from branch `claude/agent-team-template-JPUph` on 2026-03-06.*
*Source files: `.claude/agents/`, `AGENT-TEAM-SETUP.md`, `workflows/`, `agents/`*
