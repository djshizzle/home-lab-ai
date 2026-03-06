# CLAUDE.md — Agent Team Project

> This file is automatically loaded by Claude Code every session.
> Customize the sections marked `[CUSTOMIZE]` for your specific project.

---

## Project Identity [CUSTOMIZE]

```
PROJECT_NAME:    my-project
PURPOSE:         Describe what this project does in 1-2 sentences
TECH_STACK:      e.g., Python 3.12 / FastAPI / PostgreSQL
REPO_URL:        https://github.com/your-org/your-repo
TEAM:            your-team-name
```

---

## Quick Commands [CUSTOMIZE]

```bash
# Install dependencies
# [CUSTOMIZE] e.g., pip install -e ".[dev]"   OR   npm install
install:    <YOUR_INSTALL_COMMAND>

# Run tests
# [CUSTOMIZE] e.g., pytest -x   OR   npm test
test:       <YOUR_TEST_COMMAND>

# Lint / format
# [CUSTOMIZE] e.g., ruff check . && ruff format --check .   OR   eslint src/
lint:       <YOUR_LINT_COMMAND>

# Build
# [CUSTOMIZE] e.g., python -m build   OR   npm run build
build:      <YOUR_BUILD_COMMAND>

# Run locally
# [CUSTOMIZE] e.g., uvicorn app.main:app --reload   OR   npm run dev
dev:        <YOUR_DEV_COMMAND>
```

---

## Agent Team

This project uses a **7-Agent Architecture**. See the full guide:
→ [AGENT-TEAM-SETUP.md](./AGENT-TEAM-SETUP.md)

### Agent Roster

| # | Agent | File | Subagent Type |
|---|-------|------|---------------|
| 1 | Orchestrator | _(main session)_ | — |
| 2 | Researcher | `agents/02-researcher.md` | `Explore` |
| 3 | Planner | `agents/03-planner.md` | `Plan` |
| 4 | Implementer | `agents/04-implementer.md` | `general-purpose` |
| 5 | Tester | `agents/05-tester.md` | `general-purpose` |
| 6 | Reviewer | `agents/06-reviewer.md` | `general-purpose` |
| 7 | Documenter | `agents/07-documenter.md` | `general-purpose` |

### Workflows

| Task Type | Workflow File |
|-----------|--------------|
| New feature | `workflows/standard-feature.md` |
| Bug fix | `workflows/bug-fix.md` |
| Code review | `workflows/code-review.md` |

---

## Team Norms

- Use `TodoWrite` to track all multi-step tasks; mark complete immediately when done
- Only **one** task `in_progress` at a time
- Read files before editing them — never propose changes blindly
- Prefer editing existing files over creating new ones
- Do not over-engineer: minimum complexity for the current task

## Security Constraints

- **Never** commit secrets, API keys, or credentials
- Always confirm before: `git push --force`, `git reset --hard`, destructive DB ops
- Validate at system boundaries (user input, external APIs); trust internal code
- Skip `--no-verify` only if the user explicitly requests it

## Git Conventions [CUSTOMIZE]

```
Branch naming:   feature/<ticket>-short-description
                 fix/<ticket>-short-description
                 chore/<ticket>-short-description

Commit format:   <type>(<scope>): <summary>
                 Types: feat | fix | chore | docs | test | refactor

PR title:        [<type>] <short summary> (under 70 chars)
```

## Code Style [CUSTOMIZE]

```
- Language-specific style: [e.g., PEP 8 / Airbnb / Google]
- Max line length: [e.g., 100]
- Import order: [e.g., stdlib → third-party → local]
- Naming: [e.g., snake_case for Python, camelCase for JS]
```

---

## Agent Workspace

Hand-off files between agents are stored in `.agent-workspace/` (gitignored).
Run `./scripts/init-agent-team.sh` to scaffold this directory on first use.
