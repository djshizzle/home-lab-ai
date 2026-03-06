# Workflow: Code Review

> Use this workflow to perform a standalone code review of a PR, branch diff,
> or specific commit range. No implementation — review and feedback only.
> Agents: Orchestrator → Researcher → Reviewer → Documenter (summary)

---

## Prerequisites

- [ ] The code to review is available (branch, commit range, or PR number)
- [ ] Review scope is known (what to focus on: security, correctness, style, all)

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Determine what to review:
         Option A: PR number    → gh pr diff <number>
         Option B: Branch diff  → git diff main...<feature-branch>
         Option C: Commit range → git diff <sha1>..<sha2>
         Option D: Specific files → git diff HEAD -- path/to/file

[ ] 1.2  Create .agent-workspace/task.md with:
         - task_type: review
         - review_target: PR #N | branch name | commit range
         - diff_command: <exact command to get the diff>
         - review_focus: all | security | performance | style | correctness
         - context: <any background the reviewer needs>
         - deadline: <optional>

[ ] 1.3  Create TodoWrite list:
         - [ ] Research context for changed code
         - [ ] Perform code review
         - [ ] Generate review summary

[ ] 1.4  Ask user for review focus if not specified
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Launch Researcher to understand the context of the changed code:
         - What does the code being changed normally do?
         - What tests exist for it?
         - Are there related files not in the diff that are affected?
         - What are the architectural patterns in this part of the codebase?

[ ] 2.2  Researcher prompt for code review context:
         "Read the diff [insert diff command] and then explore the surrounding
         context: what do these files/functions do? What tests exist?
         Are there related patterns elsewhere in the codebase?
         Write findings to .agent-workspace/research-findings.md"

[ ] 2.3  Wait for research-findings.md
```

**Research output:** `.agent-workspace/research-findings.md`

---

## Phase 3: Review (Reviewer → general-purpose agent)

```
[ ] 3.1  Launch Reviewer agent using agents/06-reviewer.md prompt template
         Additional context for standalone reviews:
         - Pass the diff command to run
         - Pass research context
         - Specify review focus
         - Note: this is a review-only session, no fixes will be implemented

[ ] 3.2  Wait for review-report.md

[ ] 3.3  Orchestrator reads report:
         - Are all findings specific (file + line number)?
         - Are CRITICAL issues clearly separated from suggestions?
         - Is the verdict (APPROVE / REQUEST CHANGES / BLOCK) justified?

[ ] 3.4  If findings seem incomplete: ask Reviewer to re-examine specific areas
```

**Review output:** `.agent-workspace/review-report.md`

---

## Phase 4: Summary (Documenter → general-purpose agent)

```
[ ] 4.1  Launch Documenter in summary mode (not full docs update):
         Task: Convert review-report.md into a formatted review comment
         suitable for posting on the PR or sharing with the team

[ ] 4.2  Documenter produces .agent-workspace/review-comment.md:
         - Executive summary (2-3 sentences)
         - Verdict
         - Critical issues (must fix)
         - Suggestions (nice to have)
         - Positive observations (what was done well)

[ ] 4.3  Optional: Post review comment automatically
         gh pr review <number> --body "$(cat .agent-workspace/review-comment.md)"
         OR
         gh pr review <number> --request-changes --body "..."
         OR
         gh pr review <number> --approve --body "..."
         (Confirm with user before posting)
```

**Summary output:** `.agent-workspace/review-comment.md`

---

## Phase 5: Completion (Orchestrator)

```
[ ] 5.1  Present review summary to user
[ ] 5.2  If user wants to post: confirm and run gh pr review command
[ ] 5.3  Mark all TodoWrite tasks complete
[ ] 5.4  Optional: If review found critical issues, offer to switch to bug-fix workflow
```

---

## Review Comment Format

```markdown
## Code Review: [PR Title / Branch]

**Verdict:** APPROVE ✓ | REQUEST CHANGES ⚠ | BLOCK ✗

**Summary**
[2-3 sentences describing overall quality and what the change does]

---

### Critical Issues (must fix before merge)

- `path/to/file.py:45` — **[Issue title]**
  [Description]. Fix: [specific suggestion].

---

### Suggestions (non-blocking)

- `path/to/file.py:67` — [Suggestion description]

---

### Positive Observations

- Good use of [pattern/approach] in [file]
- Tests cover [scenarios] well

---

_Review generated with 7-Agent Architecture_
```

---

## Focused Review Modes

### Security Review Only

Launch Reviewer with:
```
focus: security
checklist: use the OWASP Top 10 checklist from agents/06-reviewer.md
ignore: style, formatting, naming conventions
```

### Performance Review Only

Launch Reviewer with:
```
focus: performance
look for: N+1 queries, unbounded loops, missing indexes, unnecessary allocations,
          blocking I/O in async contexts, missing caching opportunities
ignore: style, naming conventions
```

### Style Review Only

Launch Reviewer with:
```
focus: style
check against: CLAUDE.md code style rules
ignore: logic correctness (assume it works)
```
