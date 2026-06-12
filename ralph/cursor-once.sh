#!/bin/bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

issues=$(cat issues/*.md 2>/dev/null || echo "No issues found")
commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
prompt=$(cat ralph/prompt.md)

agent -p \
  --force \
  --output-format stream-json \
  --stream-partial-output \
  "Previous commits: $commits Issues: $issues $prompt" \
| grep --line-buffered '^{' \
| jq --unbuffered -rj -f "$SCRIPT_DIR/format-chat.jq"
