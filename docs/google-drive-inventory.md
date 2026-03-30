# AVops Agent Team — Google Drive File Inventory & Organization Guide

**Generated**: 2026-03-30
**Repository**: djshizzle/home-lab-ai
**Purpose**: Complete catalog of all project artifacts, organized by file type and function, ready for Google Drive upload.

---

## Recommended Google Drive Folder Structure

```
📁 AVops Agent Team/
├── 📁 01 — Documentation/
│   ├── CLAUDE.md                        ← Project master config & instructions
│   ├── AGENT-TEAM-SETUP.md              ← 7-Agent architecture setup guide (with diagrams)
│   └── notebooklm-plan-export.md        ← Full architecture plan exported for NotebookLM review
│
├── 📁 02 — Agent Definitions/
│   ├── 📁 Template Agents (agents/)/
│   │   ├── README.md                    ← Agent roster overview
│   │   ├── 01-orchestrator.md           ← Task classifier & coordinator
│   │   ├── 02-researcher.md             ← Device & codebase discovery
│   │   ├── 03-planner.md                ← AV solution architect
│   │   ├── 04-implementer.md            ← AV code & config writer
│   │   ├── 05-tester.md                 ← Device & integration validator
│   │   ├── 06-reviewer.md               ← AV security & quality auditor
│   │   └── 07-documenter.md             ← As-built & PR writer
│   │
│   └── 📁 Native Claude Code Agents (.claude/agents/)/
│       ├── 01-orchestrator.md           ← Claude Code native orchestrator definition
│       ├── 02-researcher.md             ← Claude Code native researcher definition
│       ├── 03-planner.md                ← Claude Code native planner definition
│       ├── 04-implementer.md            ← Claude Code native implementer definition
│       ├── 05-tester.md                 ← Claude Code native tester definition
│       ├── 06-reviewer.md               ← Claude Code native reviewer definition
│       └── 07-documenter.md             ← Claude Code native documenter definition
│
├── 📁 03 — Workflows/
│   ├── standard-feature.md              ← New AV feature / integration workflow
│   ├── bug-fix.md                       ← Bug / device fault fix workflow
│   ├── device-onboarding.md             ← New device onboarding workflow
│   ├── firmware-rollout.md              ← Firmware rollout workflow
│   ├── room-integration.md              ← Room AV integration workflow
│   ├── incident-response.md             ← Incident response workflow
│   └── code-review.md                   ← Code review workflow
│
├── 📁 04 — Scripts & Code/
│   ├── init-agent-team.sh               ← Bash script: initializes .agent-workspace/ directory
│   ├── pre-tool-validate.sh             ← Bash hook: blocks dangerous tool calls (safety gate)
│   └── post-task-notify.sh              ← Bash hook: appends agent activity to audit log
│
├── 📁 05 — Configuration/
│   ├── settings.json                    ← Claude Code permissions (allow/deny rules)
│   ├── .gitignore                       ← Git ignore rules for workspace & secrets
│   └── AGENT_STATE.md                   ← Agent workspace state tracker / audit log
│
└── 📁 06 — Workspace Templates/
    ├── plans/.gitkeep                   ← Placeholder for implementation plans
    ├── docs-drafts/.gitkeep             ← Placeholder for documentation drafts
    ├── research/.gitkeep                ← Placeholder for research outputs
    └── reviews/.gitkeep                 ← Placeholder for review reports
```

---

## Complete File Inventory

### Documentation (3 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `CLAUDE.md` | Markdown | **Master project config** — loaded every Claude Code session. Defines project identity, AV device scope, agent roster, team norms, security constraints, git conventions, code style, and AV domain reference. |
| 2 | `AGENT-TEAM-SETUP.md` | Markdown | **Architecture guide** — full setup instructions for the 7-Agent system including architecture diagrams, agent definitions, workflow patterns, quality gates, and customization instructions. |
| 3 | `docs/notebooklm-plan-export.md` | Markdown | **NotebookLM export** — complete architecture plan formatted for review in Google NotebookLM. Includes all agent definitions, communication protocols, workflow patterns, and examples. |

### Agent Definitions — Template Layer (8 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 4 | `agents/README.md` | Markdown | Overview of the agent roster and how to use agent definitions. |
| 5 | `agents/01-orchestrator.md` | Markdown | **Orchestrator agent** — routes tasks, manages todo lists, coordinates the other 6 agents. Customized for AV operations. |
| 6 | `agents/02-researcher.md` | Markdown | **Researcher agent** — explores codebase and device inventories, gathers information before planning. |
| 7 | `agents/03-planner.md` | Markdown | **Planner agent** — designs implementation plans for AV solutions, produces plan documents. |
| 8 | `agents/04-implementer.md` | Markdown | **Implementer agent** — writes production code, device configs, and control system logic. |
| 9 | `agents/05-tester.md` | Markdown | **Tester agent** — writes and runs tests, validates device connectivity and signal paths. |
| 10 | `agents/06-reviewer.md` | Markdown | **Reviewer agent** — audits code for security, AV-specific safety, and quality. |
| 11 | `agents/07-documenter.md` | Markdown | **Documenter agent** — writes as-built docs, API references, PR descriptions. |

### Agent Definitions — Native Claude Code Layer (7 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 12 | `.claude/agents/01-orchestrator.md` | Markdown | Native Claude Code agent definition for the Orchestrator. |
| 13 | `.claude/agents/02-researcher.md` | Markdown | Native Claude Code agent definition for the Researcher. |
| 14 | `.claude/agents/03-planner.md` | Markdown | Native Claude Code agent definition for the Planner. |
| 15 | `.claude/agents/04-implementer.md` | Markdown | Native Claude Code agent definition for the Implementer. |
| 16 | `.claude/agents/05-tester.md` | Markdown | Native Claude Code agent definition for the Tester. |
| 17 | `.claude/agents/06-reviewer.md` | Markdown | Native Claude Code agent definition for the Reviewer. |
| 18 | `.claude/agents/07-documenter.md` | Markdown | Native Claude Code agent definition for the Documenter. |

### Workflows (7 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 19 | `workflows/standard-feature.md` | Markdown | Step-by-step workflow for implementing new AV features or integrations. |
| 20 | `workflows/bug-fix.md` | Markdown | Workflow for diagnosing and fixing bugs or device faults. |
| 21 | `workflows/device-onboarding.md` | Markdown | Workflow for onboarding new AV devices into the managed fleet. |
| 22 | `workflows/firmware-rollout.md` | Markdown | Workflow for planning and executing firmware updates across device fleets. |
| 23 | `workflows/room-integration.md` | Markdown | Workflow for end-to-end AV integration of a conference room or event space. |
| 24 | `workflows/incident-response.md` | Markdown | Workflow for responding to AV system incidents and outages. |
| 25 | `workflows/code-review.md` | Markdown | Workflow for conducting code reviews on AV-related changes. |

### Scripts & Hooks (3 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 26 | `scripts/init-agent-team.sh` | Shell Script | Initializes the `.agent-workspace/` directory, validates template files exist, and scaffolds the workspace for first use. |
| 27 | `.claude/hooks/pre-tool-validate.sh` | Shell Script | **Safety hook** — runs before every Claude Code tool call. Blocks destructive commands (`rm -rf`, `sudo rm`, pipe-to-bash, `chmod 777`). |
| 28 | `.claude/hooks/post-task-notify.sh` | Shell Script | **Audit hook** — runs after tool calls. Appends timestamped agent activity entries to `AGENT_STATE.md` for session tracking. |

### Configuration (3 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 29 | `.claude/settings.json` | JSON | Claude Code permission rules — defines allowed operations (git, read) and denied operations (destructive commands). |
| 30 | `.gitignore` | Config | Git ignore rules — excludes `.agent-workspace/`, `__pycache__`, `.env`, and other sensitive/temp files. |
| 31 | `.claude/workspace/AGENT_STATE.md` | Markdown | Agent state tracker — logs task status (READY/ACTIVE/COMPLETE) and appends activity entries from the post-task hook. |

### Workspace Templates (4 placeholder files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 32 | `.claude/workspace/plans/.gitkeep` | Placeholder | Empty dir for implementation plan documents generated by the Planner agent. |
| 33 | `.claude/workspace/docs-drafts/.gitkeep` | Placeholder | Empty dir for draft documentation generated by the Documenter agent. |
| 34 | `.claude/workspace/research/.gitkeep` | Placeholder | Empty dir for research outputs generated by the Researcher agent. |
| 35 | `.claude/workspace/reviews/.gitkeep` | Placeholder | Empty dir for review reports generated by the Reviewer agent. |

---

## Summary by File Type

| File Type | Count | Description |
|-----------|-------|-------------|
| Markdown (`.md`) | 27 | Documentation, agent definitions, workflows, state tracking |
| Shell Script (`.sh`) | 3 | Init script, safety hooks |
| JSON (`.json`) | 1 | Claude Code permissions config |
| Config (`.gitignore`) | 1 | Git ignore rules |
| Placeholder (`.gitkeep`) | 4 | Empty directory markers |
| **Total** | **36** | |

## Summary by Function

| Category | Count | Description |
|----------|-------|-------------|
| Documentation | 3 | Project config, setup guide, NotebookLM export |
| Agent Definitions | 15 | 7 template agents + 7 native Claude Code agents + 1 README |
| Workflows | 7 | Step-by-step procedures for common AV operations |
| Scripts & Hooks | 3 | Initialization and safety automation |
| Configuration | 3 | Permissions, git ignore, state tracking |
| Workspace Templates | 4 | Placeholder directories for agent outputs |
| **Total** | **35** | _(36 files, .gitignore counted in config)_ |

---

## How to Upload to Google Drive

1. Create a folder called **"AVops Agent Team"** in Google Drive
2. Create the 6 subfolders shown in the folder structure above
3. Copy files from the repo into the matching folders
4. Alternatively, run the helper script below to create the organized structure locally, then drag-and-drop upload the entire folder

```bash
# Run from the repo root to create an upload-ready folder structure:
bash scripts/organize-for-drive.sh
# Then upload the generated 'drive-upload/' folder to Google Drive
```

---

*Generated by Claude Code from djshizzle/home-lab-ai repository*
