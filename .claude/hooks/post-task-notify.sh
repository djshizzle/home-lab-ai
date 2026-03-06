#!/usr/bin/env bash
# post-task-notify.sh
# Claude Code PostToolUse hook — appends agent activity to AGENT_STATE.md.
# Provides a lightweight audit trail of agent activity within a session.

set -euo pipefail

WORKSPACE=".claude/workspace"
STATE_FILE="$WORKSPACE/AGENT_STATE.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read tool info from stdin
INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name','unknown'))" 2>/dev/null || echo "unknown")

mkdir -p "$WORKSPACE"

if [ ! -f "$STATE_FILE" ]; then
  cat > "$STATE_FILE" << 'STATEINIT'
# Agent State Log

## Status
READY

## Pending Tasks
(none)

## Completed Tasks
(none)

## Activity Log
STATEINIT
fi

# Log significant tool uses (skip trivial reads)
SIGNIFICANT_TOOLS=("Write" "Edit" "Bash" "Agent")

for sig_tool in "${SIGNIFICANT_TOOLS[@]}"; do
  if [ "$TOOL" = "$sig_tool" ]; then
    echo "- [$TIMESTAMP] Tool: $TOOL" >> "$STATE_FILE"
    break
  fi
done

exit 0
