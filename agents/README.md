# Agents Directory

This directory contains prompt templates and role definitions for each of the 7 agents.

---

## Quick Reference

| File | Agent | When to Use | Subagent Type |
|------|-------|------------|--------------|
| `01-orchestrator.md` | Orchestrator | Always — runs in the main session | _(main session)_ |
| `02-researcher.md` | Researcher | Explore codebase before any change | `Explore` |
| `03-planner.md` | Planner | Design implementation for features | `Plan` |
| `04-implementer.md` | Implementer | Write code per approved plan | `general-purpose` |
| `05-tester.md` | Tester | Validate implementation with tests | `general-purpose` |
| `06-reviewer.md` | Reviewer | Code review and security audit | `general-purpose` |
| `07-documenter.md` | Documenter | Update docs and create PR | `general-purpose` |

---

## How to Use These Files

Each agent file contains:
1. **Role description** — what this agent does and doesn't do
2. **Tools & permissions** — what the agent is allowed to use
3. **Input contract** — what information the agent needs to receive
4. **Output contract** — what file the agent writes to `.agent-workspace/`
5. **Prompt template** — copy this into the `Agent` tool call and fill placeholders
6. **Example Agent tool call** — a complete JSON example ready to adapt

### Usage Pattern

```python
# In Claude Code, invoke an agent like this:
Agent(
    subagent_type="Explore",           # from the agent's "Subagent Type" field
    description="Research auth module", # 3-5 words
    prompt="""                          # paste and fill the agent's prompt template
        [filled in from agents/02-researcher.md]
    """
)
```

---

## Agent Interaction Map

```
Orchestrator (01)
    │
    ├── launches ──► Researcher (02)   writes → research-findings.md
    │                    │
    ├── launches ──► Planner (03)      reads ← research-findings.md
    │                    │             writes → implementation-plan.md
    │                    │
    │               [USER GATE]
    │                    │
    ├── launches ──► Implementer (04)  reads ← implementation-plan.md
    │                    │             writes → implementation-summary.md + code
    │                    │
    ├── launches ──► Tester (05)       reads ← implementation-summary.md
    │                    │             writes → test-results.md
    │                    │
    ├── launches ──► Reviewer (06)     reads ← test-results.md, diff
    │                    │             writes → review-report.md
    │                    │
    └── launches ──► Documenter (07)   reads ← review-report.md
                                       writes → docs + pr-description.md
```

---

## Customization

Each agent's prompt template has `{{PLACEHOLDERS}}` for project-specific values.
The most important ones to fill when calling an agent:

| Placeholder | Description |
|-------------|-------------|
| `{{TASK_DESCRIPTION}}` | The user's original task |
| `{{TASK_CONTEXT}}` | Contents of `.agent-workspace/task.md` |
| `{{RESEARCH_FINDINGS}}` | Contents of `.agent-workspace/research-findings.md` |
| `{{TEST_COMMAND}}` | From `CLAUDE.md` Quick Commands |
| `{{LINT_COMMAND}}` | From `CLAUDE.md` Quick Commands |
| `{{BASE_BRANCH}}` | Your repo's main branch (e.g., `main`, `develop`) |

---

## Subagent Constraint

Claude Code subagents **cannot spawn their own subagents**. This means:
- The Orchestrator (main session) is the only one that can launch agents
- Agents communicate through files in `.agent-workspace/`, not directly
- All coordination flows through the Orchestrator

This is by design — it keeps the system predictable and the Orchestrator in control.
