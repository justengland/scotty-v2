#!/bin/bash
set -eo pipefail

iterations="${1:-2}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

for ((i=1; i<=iterations; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  issues=$(cat issues/*.md 2>/dev/null || echo "No issues found")
  prompt=$(cat ralph/prompt.md)

  agent -p \
    --force \
    --output-format stream-json \
    --stream-partial-output \
    "Previous commits: $commits Issues: $issues $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj -f "$SCRIPT_DIR/format-chat.jq"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "Ralph finished: no more tasks after $i iteration(s)."
    exit 0
  fi
done

echo "Ralph stopped: ran out of iterations ($iterations max)."
exit 1
