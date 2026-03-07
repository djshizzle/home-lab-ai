# Workflow: Standard Feature Development — AVops

> Use this workflow when adding a new software feature, automation script, API endpoint,
> monitoring integration, or significant enhancement to the AVops platform.
> All 7 agents are involved. Estimated sessions: 1 (simple) to 3 (complex features).
>
> AV-specific features examples:
> - New device driver (REST, TCP, RS-232)
> - REST API endpoint for device control or monitoring
> - Automation script (firmware audit, mass reboot, inventory sync)
> - SNMP monitoring integration for a new device class
> - UC platform API integration (Teams, Zoom, Webex)
> - Dashboard or reporting feature for AV estate health

---

## Prerequisites

- [ ] `.agent-workspace/` directory exists (run `./scripts/init-agent-team.sh` if not)
- [ ] `CLAUDE.md` is loaded (contains AV device scope and tech stack)
- [ ] User has provided a clear task description
- [ ] For device drivers: target device model, firmware version, and API docs are known
- [ ] For API features: authentication requirements and rate limits are known

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Receive and parse the user's task
[ ] 1.2  Create .agent-workspace/task.md with:
         - task_id, task_type (feature), task_description
         - acceptance_criteria (infer from user's request, confirm if unclear)
         - constraints (from CLAUDE.md)
         - workflow: workflows/standard-feature.md

[ ] 1.3  Create TodoWrite task list with all steps below
[ ] 1.4  Clarify any ambiguous requirements with AskUserQuestion before proceeding
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Determine research scope:
         - SMALL (isolated feature): 1 Researcher agent
         - LARGE (touches multiple systems): 2-3 Researcher agents in PARALLEL

[ ] 2.2  Launch Researcher agent(s) using agents/02-researcher.md prompt template
         Populate: task_description, known_entry_points, questions_to_answer

[ ] 2.3  Wait for research-findings.md to be written

[ ] 2.4  Orchestrator reviews findings:
         - Are all relevant files identified?
         - Are reuse opportunities noted?
         - Are risks flagged?
         If incomplete: re-run Researcher with more specific focus
```

**Research output:** `.agent-workspace/research-findings.md`

---

## Phase 3: Planning (Planner → Plan agent)

```
[ ] 3.1  Launch Planner agent using agents/03-planner.md prompt template
         Pass: research-findings.md contents + task.md contents

[ ] 3.2  Wait for implementation-plan.md to be written

[ ] 3.3  Orchestrator reviews plan:
         - Are all acceptance criteria addressed?
         - Are steps specific and ordered correctly?
         - Are there open questions that need user input?

[ ] 3.4  ⚠ HUMAN REVIEW GATE ⚠
         Present plan to user:
         "Here is the implementation plan. Please review and approve to proceed."
         [Show contents of implementation-plan.md]
         [Wait for explicit user approval or change requests]

[ ] 3.5  If user requests changes: revise plan (edit file or re-run Planner)
         If user approves: proceed to Phase 4
```

**Planning output:** `.agent-workspace/implementation-plan.md`

---

## Phase 4: Implementation (Implementer → general-purpose agent)

```
[ ] 4.1  Launch Implementer agent using agents/04-implementer.md prompt template
         Pass: implementation-plan.md + key research findings

[ ] 4.2  For large plans (10+ steps), consider splitting:
         - Launch Implementer for Steps 1-5
         - After completion, launch Implementer for Steps 6-10

[ ] 4.3  Wait for implementation-summary.md to be written

[ ] 4.4  Orchestrator reviews summary:
         - Were all steps completed?
         - Are there blockers or deviations?
         If blockers: resolve and re-run from blocked step
         If deviations: assess if they are acceptable or need correction
```

**Implementation output:** `.agent-workspace/implementation-summary.md` + code changes

---

## Phase 5: Testing (Tester → general-purpose agent)

```
[ ] 5.1  Launch Tester agent using agents/05-tester.md prompt template
         Pass: implementation-summary.md + acceptance criteria from plan

[ ] 5.2  Wait for test-results.md to be written

[ ] 5.3  Orchestrator reviews results:
         - Did all tests pass?
         - Are all acceptance criteria met?
         - Any regressions?

[ ] 5.4  If tests FAIL:
         - Minor failures: Return to Implementer with specific failures → fix → re-test
         - Design failures: Return to Planner for re-planning
         - Unclear failures: Escalate to user

[ ] 5.5  If tests PASS: proceed to Phase 6
```

**Testing output:** `.agent-workspace/test-results.md`

---

## Phase 6: Code Review (Reviewer → general-purpose agent)

```
[ ] 6.1  Launch Reviewer agent using agents/06-reviewer.md prompt template
         Pass: implementation-summary.md + test-results.md + commit range for diff

[ ] 6.2  Wait for review-report.md to be written

[ ] 6.3  Orchestrator reads verdict:

         APPROVE:
         → Proceed to Phase 7

         REQUEST CHANGES:
         → Send specific findings back to Implementer
         → Implementer fixes issues
         → Re-run Tester
         → Re-run Reviewer
         → Maximum 2 re-review cycles; escalate to user if still blocked

         BLOCK:
         → Stop immediately
         → Present review-report.md to user
         → Wait for user guidance
```

**Review output:** `.agent-workspace/review-report.md`

---

## Phase 7: Documentation & PR (Documenter → general-purpose agent)

```
[ ] 7.1  Launch Documenter agent using agents/07-documenter.md prompt template
         Pass: implementation-summary.md + review-report.md + task.md

[ ] 7.2  Wait for documentation updates and pr-description.md

[ ] 7.3  Orchestrator reviews PR description:
         - Is the title clear and under 70 chars?
         - Does the test plan match actual test cases?
         - Are breaking changes noted?

[ ] 7.4  If create_pr = yes:
         Confirm with user before running gh pr create
         Run: gh pr create with pr-description.md contents
```

**Documentation output:** Updated doc files + `.agent-workspace/pr-description.md`

---

## Phase 8: Completion (Orchestrator)

```
[ ] 8.1  Mark all TodoWrite tasks as completed
[ ] 8.2  Confirm PR URL with user (or confirm code is committed on branch)
[ ] 8.3  Clean up .agent-workspace/ if desired (or leave for audit trail)
[ ] 8.4  Report summary to user:
         - What was built
         - Files changed
         - Tests added
         - PR link
```

---

## AV-Specific Notes for Standard Features

- **Device drivers**: always inherit `DeviceBase`, set `API_RATE_LIMIT`, use env vars for credentials
- **API endpoints**: reboot/reset device endpoints require admin role (not helpdesk)
- **Automation scripts**: include `--dry-run` flag for scripts that modify AV device state
- **Monitoring integrations**: validate SNMP OIDs against actual device MIB before implementing
- **Control system code**: always include startup timing delays (see Implementer agent rules)

## Rollback Plan

If the implementation needs to be reverted:

```bash
# Find the last good commit before implementation started
git log --oneline -10

# Reset to it (DESTRUCTIVE — confirm with user first)
git reset --hard <commit-hash>

# Or create a revert commit (safer)
git revert HEAD~<n>..HEAD
```

---

## Timing Guidance

| Phase | Typical Agent Runs |
|-------|-------------------|
| Research | 1-3 Explore agents (parallel for large scope) |
| Planning | 1 Plan agent |
| Implementation | 1-2 general-purpose agents (split for large plans) |
| Testing | 1 general-purpose agent |
| Review | 1-2 general-purpose agents (re-run if REQUEST CHANGES) |
| Documentation | 1 general-purpose agent |
