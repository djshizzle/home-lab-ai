#!/usr/bin/env bash
# init-agent-team.sh
# Initializes the .agent-workspace/ directory and validates the agent team setup.
# Run this once when starting a new project with the 7-Agent Architecture template.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WORKSPACE=".agent-workspace"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     7-Agent Architecture — Initializer       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

cd "${PROJECT_ROOT}"

# ─── Step 1: Validate template files exist ────────────────────────────────────

echo -e "${YELLOW}[1/4] Validating template files...${NC}"

MISSING=()

check_file() {
    if [[ ! -f "$1" ]]; then
        MISSING+=("$1")
    fi
}

check_file "CLAUDE.md"
check_file "AGENT-TEAM-SETUP.md"
check_file "agents/01-orchestrator.md"
check_file "agents/02-researcher.md"
check_file "agents/03-planner.md"
check_file "agents/04-implementer.md"
check_file "agents/05-tester.md"
check_file "agents/06-reviewer.md"
check_file "agents/07-documenter.md"
check_file "workflows/standard-feature.md"
check_file "workflows/bug-fix.md"
check_file "workflows/code-review.md"

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Missing template files:${NC}"
    for f in "${MISSING[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "Please ensure you have the complete 7-Agent Architecture template."
    exit 1
fi

echo -e "${GREEN}✓ All template files present${NC}"

# ─── Step 2: Create .agent-workspace/ ────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/4] Setting up .agent-workspace/...${NC}"

mkdir -p "${WORKSPACE}"

# Create hand-off file templates
cat > "${WORKSPACE}/task.md" << 'EOF'
# Task Context
<!-- Filled by Orchestrator at session start -->

- task_id:
- task_type: feature | bug | review | chore
- task_description:
- affected_files: unknown — researcher will identify
- acceptance_criteria:
  -
- constraints:
  -
- workflow: workflows/standard-feature.md
- status: pending
EOF

cat > "${WORKSPACE}/research-findings.md" << 'EOF'
# Research Findings
<!-- Written by Researcher (Agent 2) -->

## Relevant Files
| File | Purpose | Lines |
|------|---------|-------|

## Existing Patterns to Reuse
-

## Current Behavior
[Description]

## Risks & Gotchas
-

## Recommended Entry Points for Changes
- Primary:
- Tests:

## Open Questions for Planner
-
EOF

cat > "${WORKSPACE}/implementation-plan.md" << 'EOF'
# Implementation Plan
<!-- Written by Planner (Agent 3) -->

## Approach
[1-3 sentences]

## Files to Modify
| File | Action | Change Summary |
|------|--------|---------------|

## Steps (Ordered)

### Step 1: [Name]
- File:
- What:
- Why:
- Acceptance:

## Tests to Add/Update
-

## Decisions Made
-

## Open Questions (needs user input)
-
EOF

cat > "${WORKSPACE}/implementation-summary.md" << 'EOF'
# Implementation Summary
<!-- Written by Implementer (Agent 4) -->

## Completed Steps
- [x] Step 1:

## Files Changed
| File | Action | Lines Changed |
|------|--------|--------------|

## Deviations from Plan
- None

## Blockers / Questions
- None
EOF

cat > "${WORKSPACE}/test-results.md" << 'EOF'
# Test Results
<!-- Written by Tester (Agent 5) -->

## Summary
- Status: PENDING
- Tests run: 0
- Tests passed: 0
- Tests failed: 0

## Lint Results
- Status: PENDING

## New Tests Added
-

## Failures (if any)
- None

## Regressions
- None detected

## Acceptance Criteria Check
- [ ]
EOF

cat > "${WORKSPACE}/review-report.md" << 'EOF'
# Code Review Report
<!-- Written by Reviewer (Agent 6) -->

## Verdict
PENDING

## Summary
[Not yet reviewed]

## Security Findings
### CRITICAL
- None

### WARNING
- None

## Code Quality Findings
-

## Plan Compliance
- [ ]

## Recommendations
-
EOF

cat > "${WORKSPACE}/pr-description.md" << 'EOF'
# PR Description Draft
<!-- Written by Documenter (Agent 7) -->

## Title
[type(scope): summary]

## Summary
-

## Motivation
[Why this change was needed]

## Test Plan
- [ ]

## Breaking Changes
None
EOF

echo -e "${GREEN}✓ .agent-workspace/ created with hand-off templates${NC}"

# ─── Step 3: Add .agent-workspace to .gitignore ───────────────────────────────

echo ""
echo -e "${YELLOW}[3/4] Updating .gitignore...${NC}"

GITIGNORE=".gitignore"

if [[ ! -f "${GITIGNORE}" ]]; then
    touch "${GITIGNORE}"
fi

if ! grep -q "^\.agent-workspace" "${GITIGNORE}" 2>/dev/null; then
    echo "" >> "${GITIGNORE}"
    echo "# Agent team hand-off workspace (session-specific, not committed)" >> "${GITIGNORE}"
    echo ".agent-workspace/" >> "${GITIGNORE}"
    echo -e "${GREEN}✓ Added .agent-workspace/ to .gitignore${NC}"
else
    echo -e "${GREEN}✓ .agent-workspace/ already in .gitignore${NC}"
fi

# ─── Step 4: Validate CLAUDE.md customization ────────────────────────────────

echo ""
echo -e "${YELLOW}[4/4] Checking CLAUDE.md customization...${NC}"

UNCUSTOMIZED=()

if grep -q "<YOUR_TEST_COMMAND>" "CLAUDE.md" 2>/dev/null; then
    UNCUSTOMIZED+=("Test command not set")
fi
if grep -q "<YOUR_LINT_COMMAND>" "CLAUDE.md" 2>/dev/null; then
    UNCUSTOMIZED+=("Lint command not set")
fi
if grep -q "my-project" "CLAUDE.md" 2>/dev/null; then
    UNCUSTOMIZED+=("Project name still set to 'my-project'")
fi

if [[ ${#UNCUSTOMIZED[@]} -gt 0 ]]; then
    echo -e "${YELLOW}⚠ CLAUDE.md has uncustomized placeholders:${NC}"
    for item in "${UNCUSTOMIZED[@]}"; do
        echo "  - ${item}"
    done
    echo ""
    echo "  → Open CLAUDE.md and fill in the [CUSTOMIZE] sections before your first session."
else
    echo -e "${GREEN}✓ CLAUDE.md appears customized${NC}"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Setup complete! Next steps:            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "  1. Edit CLAUDE.md → fill in all [CUSTOMIZE] sections"
echo "  2. Open Claude Code in this directory"
echo "  3. Give Claude a task — it will use the agent team automatically"
echo ""
echo "  Quick reference:"
echo "  → AGENT-TEAM-SETUP.md   — Architecture overview and guide"
echo "  → agents/               — Individual agent prompt templates"
echo "  → workflows/            — Step-by-step workflow checklists"
echo ""
echo "  Example task to try:"
echo '  "Add input validation to the user registration endpoint"'
echo ""
