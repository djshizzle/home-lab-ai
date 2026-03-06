#!/usr/bin/env bash
# pre-tool-validate.sh
# Claude Code PreToolUse hook — runs before every tool execution.
# Blocks dangerous patterns and enforces project safety rules.
#
# Exit codes:
#   0 = allow the tool call
#   2 = block the tool call (Claude sees the stderr message)

set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
TOOL_INPUT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null || echo "{}")

# ── Bash tool safety ────────────────────────────────────────────────────────
if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

  # Block destructive patterns
  BLOCKED=(
    "rm -rf /"
    "rm -rf \*"
    "sudo rm"
    "curl.*\| *bash"
    "curl.*\| *sh"
    "wget.*\| *sh"
    "wget.*\| *bash"
    "> /dev/sda"
    "dd if="
    "mkfs\."
    "chmod 777"
  )

  for pattern in "${BLOCKED[@]}"; do
    if echo "$CMD" | grep -qE "$pattern" 2>/dev/null; then
      echo "BLOCKED by pre-tool-validate: Dangerous command pattern detected." >&2
      echo "Pattern: $pattern" >&2
      echo "Command: $CMD" >&2
      exit 2
    fi
  done
fi

# ── Write/Edit tool safety ───────────────────────────────────────────────────
if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
  FILE=$(echo "$TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path', d.get('path','')))" 2>/dev/null || echo "")

  # Block writes to secret/credential files
  SECRET_PATTERNS=(
    '\.env$'
    '\.env\.'
    'secrets\.'
    'credentials\.'
    'id_rsa'
    'id_ed25519'
    '\.pem$'
    '\.key$'
    'service-account.*\.json$'
  )

  for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$FILE" | grep -qE "$pattern" 2>/dev/null; then
      echo "BLOCKED by pre-tool-validate: Direct writes to secret/credential files are not allowed." >&2
      echo "File: $FILE" >&2
      echo "Manually edit sensitive files outside of Claude Code." >&2
      exit 2
    fi
  done
fi

exit 0
