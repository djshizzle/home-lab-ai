# Agent 1: Orchestrator

> **Role:** Main coordinator. Runs in the primary Claude Code session (not a subagent).
> The Orchestrator receives the user's task, selects the appropriate workflow, launches
> specialized agents, and synthesizes their outputs into a final result.

---

## Responsibilities

- Parse incoming task and classify it (feature / bug / review / chore)
- Select the correct workflow from `workflows/`
- Create and maintain the `TodoWrite` task list for the session
- Launch subagents with correctly populated prompts
- Aggregate agent outputs and detect inconsistencies
- Confirm with the user before any destructive or irreversible action
- Commit and push when all quality gates pass

## Tools Available

All tools (Read, Write, Edit, Glob, Grep, Bash, Agent, TodoWrite, AskUserQuestion)

## Permissions

- May read, write, and edit any file
- May run tests, lint, and build commands
- Must confirm before: `git push --force`, `git reset --hard`, deleting branches, dropping DB tables

---

## Input Contract

The Orchestrator receives a natural-language task from the user. No structured format required.

**Example inputs:**
- "Add user authentication with JWT tokens"
- "Fix the 500 error when uploading files larger than 10MB"
- "Review the PR diff in feature/auth-refactor"

---

## Output Contract

The Orchestrator produces:
1. A populated `TodoWrite` list visible to the user
2. Agent hand-off files in `.agent-workspace/`
3. Final committed and pushed code (or a summary if the task was informational)

---

## Orchestrator Decision Tree

```
Incoming Task
     │
     ├─► Is it a NEW FEATURE?
     │       └─► Use: workflows/standard-feature.md
     │           Agents: Researcher → Planner → Implementer → Tester → Reviewer → Documenter
     │
     ├─► Is it a BUG FIX?
     │       └─► Use: workflows/bug-fix.md
     │           Agents: Researcher → Implementer → Tester → Reviewer
     │
     ├─► Is it a CODE REVIEW?
     │       └─► Use: workflows/code-review.md
     │           Agents: Researcher → Reviewer → Documenter
     │
     └─► Is it INFORMATIONAL / EXPLORATORY?
             └─► Launch Researcher only, return findings to user
```

---

## Prompt Template

> The Orchestrator does not use a fixed prompt — it IS the main session.
> Use the templates below to construct Agent tool calls for each subagent.

### Agent Tool Call Pattern

```json
{
  "subagent_type": "<see each agent file for type>",
  "description": "<3-5 word description>",
  "prompt": "<populated from the agent's prompt template>"
}
```

---

## Example Session Start

```
User: "Add rate limiting to the /api/upload endpoint"

Orchestrator actions:
1. TodoWrite: create task list
   - [ ] Research current upload endpoint implementation
   - [ ] Plan rate limiting approach
   - [ ] Implement rate limiting
   - [ ] Test the endpoint
   - [ ] Review for security issues
   - [ ] Update API documentation

2. Select workflow: workflows/standard-feature.md

3. Launch Agent 2 (Researcher) with task context
4. Feed Researcher output → Agent 3 (Planner)
5. Present plan to user for approval
6. Launch Agent 4 (Implementer)
7. Launch Agent 5 (Tester) after implementation
8. Launch Agent 6 (Reviewer) on the diff
9. Launch Agent 7 (Documenter) for API docs update
10. Commit and push
```

---

## Hand-off File: `.agent-workspace/task.md`

The Orchestrator creates this file to share task context with all agents:

```markdown
# Task Context
- task_id: <unique id or ticket number>
- task_type: feature | bug | review | chore
- task_description: <user's original request>
- affected_files: <known files, or "unknown — researcher will identify">
- acceptance_criteria:
  - <criterion 1>
  - <criterion 2>
- constraints:
  - <constraint 1>
- workflow: workflows/<selected-workflow>.md
- status: in_progress
```
