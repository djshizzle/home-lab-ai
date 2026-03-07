# Workflow: Bug Fix — AVops

> Use this workflow for fixing a specific software bug, configuration defect, or
> regression in the AVops codebase (device drivers, API, automation scripts, room configs).
>
> ⚠ For ACTIVE INCIDENTS (room down, meeting impacted), use workflows/incident-response.md instead.
> This workflow is for non-urgent bugs discovered during testing, code review, or reported
> as P3/P4 issues with no immediate meeting impact.
>
> Streamlined: skips Planner (direct research-to-fix) and Documenter (unless API changes).
> Agents: Orchestrator → Researcher → Implementer → Tester → Reviewer
>
> AV-specific bug examples:
> - Device driver returns wrong status field
> - Room config YAML fails schema validation
> - Q-SYS Lua script missing startup delay (causing intermittent audio drop)
> - API rate limit not respected in retry loop
> - SNMP polling returns stale data due to caching bug

---

## Prerequisites

- [ ] `.agent-workspace/` directory exists
- [ ] Bug is clearly described (symptoms, steps to reproduce, expected vs. actual behavior)

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Receive bug report from user
[ ] 1.2  Create .agent-workspace/task.md with:
         - task_type: bug
         - bug_description: exact symptom
         - steps_to_reproduce: numbered steps
         - expected_behavior: what should happen
         - actual_behavior: what happens instead
         - error_message: exact error/stack trace if available
         - affected_version: [CUSTOMIZE] git commit or version number
         - acceptance_criteria:
           - Bug no longer occurs when following reproduction steps
           - No new test failures introduced

[ ] 1.3  Create TodoWrite list:
         - [ ] Research bug root cause
         - [ ] Implement fix
         - [ ] Verify fix with tests
         - [ ] Code review

[ ] 1.4  If bug is vague: use AskUserQuestion to get reproduction steps before proceeding
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Launch Researcher with targeted focus:
         - Find the code path that causes the bug
         - Find any existing tests that should have caught this
         - Find related code that might be affected by the fix
         - Find any previous fixes for similar issues (git log)

[ ] 2.2  Researcher prompt should include:
         - The exact error message or symptom
         - Stack trace if available
         - Steps to reproduce

[ ] 2.3  Wait for research-findings.md

[ ] 2.4  Review findings:
         - Is the root cause identified?
         - Is the affected code located?
         If not: re-run Researcher with additional context from findings
```

**Key research questions for AV bugs:**
1. Where exactly does the bug occur? (file, function, line)
2. What is the root cause? (logic error, missing validation, race condition, firmware API change?)
3. Is the bug firmware-version specific? (device may need firmware update, not code fix)
4. Were there existing tests that should have caught this?
5. Are there other device drivers or rooms with the same bug pattern?
6. Is this a known vendor issue with a documented workaround?

**Research output:** `.agent-workspace/research-findings.md`

---

## Phase 3: Fix (Implementer → general-purpose agent)

> For bug fixes, skip the formal Planner agent. The Orchestrator creates a brief
> fix plan inline based on the research findings.

```
[ ] 3.1  Orchestrator reads research findings and creates a brief fix plan:

         Fix Plan (inline, no separate agent needed for simple bugs):
         - Root cause: [from research]
         - Fix: [specific change to make]
         - Files: [file:line]
         - Regression test: [what test to add]

         For COMPLEX bugs (multiple root causes, large refactor needed):
         → Launch Planner agent from agents/03-planner.md
         → Require human review gate before implementing

[ ] 3.2  Launch Implementer agent using agents/04-implementer.md prompt template
         Adapt the prompt for bug fix context:
         - Pass the root cause and fix approach
         - Emphasize: minimal change — fix the bug, don't refactor surrounding code
         - Require: add a regression test that would have caught this bug

[ ] 3.3  Wait for implementation-summary.md

[ ] 3.4  Review summary for:
         - Was the minimal fix applied (no scope creep)?
         - Was a regression test added?
         - Any unintended changes?
```

**Implementer bug-fix constraints:**
- Fix ONLY the reported bug — do not refactor, optimize, or improve surrounding code
- Always add a regression test that would have caught this bug
- Keep the diff as small as possible

**Fix output:** `.agent-workspace/implementation-summary.md` + code changes

---

## Phase 4: Testing (Tester → general-purpose agent)

```
[ ] 4.1  Launch Tester agent using agents/05-tester.md prompt template

[ ] 4.2  Tester must verify:
         - The specific bug no longer occurs (reproduction steps pass)
         - The regression test passes
         - No other tests broke

[ ] 4.3  Wait for test-results.md

[ ] 4.4  If tests fail:
         - Is the regression test failing? → Fix is incorrect, return to Implementer
         - Are OTHER tests failing? → Fix introduced a regression, return to Implementer
         If tests pass: proceed to review
```

**Testing output:** `.agent-workspace/test-results.md`

---

## Phase 5: Review (Reviewer → general-purpose agent)

```
[ ] 5.1  Launch Reviewer agent using agents/06-reviewer.md prompt template
         Focus: correctness and minimality (not full feature review scope)

[ ] 5.2  Reviewer checks:
         - Does the fix actually solve the root cause?
         - Is the fix minimal? (no unnecessary changes)
         - Are there related bug patterns elsewhere that should also be fixed?
         - Does the regression test actually test the right thing?

[ ] 5.3  Verdict handling same as standard-feature workflow

[ ] 5.4  On APPROVE: commit and push (or confirm with user if not already committed)
```

**Review output:** `.agent-workspace/review-report.md`

---

## Phase 6: Documentation (Conditional)

```
[ ] 6.1  Does this fix change user-facing behavior or an API contract?
         YES → Launch Documenter to update docs and add CHANGELOG entry
         NO  → Skip Documenter; just add CHANGELOG entry inline:
               git commit -m "fix(scope): description of fix"

[ ] 6.2  Create PR:
         - Title: fix(<scope>): <what was fixed>
         - Body: bug description, root cause, fix approach, how to verify
```

---

## Phase 7: Completion (Orchestrator)

```
[ ] 7.1  Confirm fix is committed and pushed
[ ] 7.2  Summarize for user:
         - Root cause identified
         - Fix applied (file and line)
         - Regression test added
         - PR link or commit hash
[ ] 7.3  Mark all TodoWrite tasks complete
```

---

## Fast Path: Tiny Bugs

For obvious one-line fixes (typo, wrong constant, missing null check, wrong OID):

```
1. Orchestrator verifies the fix with Researcher (quick scan)
2. Orchestrator implements the fix directly (no Implementer agent needed)
3. Run tests directly
4. Commit with clear message
5. Skip formal review for trivial changes (but document in commit)
```

Use judgment: if the fix is < 5 lines and the root cause is obvious, don't over-process.

## AV Bug Fix Notes

- **Firmware API changes**: if a device driver is broken because the device firmware changed
  its API, use the firmware-rollout workflow to align firmware versions first, then fix the driver.
- **Room config bugs**: always validate with `python scripts/validate_room_configs.py` after fix.
- **Control system bugs**: Crestron/Q-SYS changes require compile check before pushing;
  never deploy uncompiled control system code.
- **Dante bugs**: Dante routing issues may require Dante Controller action in addition to code fix.
  Document both in the fix summary.
- **Update troubleshooting runbook**: after every bug fix, add an entry to
  `docs/runbooks/{room}-troubleshooting.md` so the next technician can resolve it faster.
