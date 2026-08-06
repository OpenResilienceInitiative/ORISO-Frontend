#!/usr/bin/env bash
# beforeShellExecution: ask on narrowly matched destructive commands.
# stdin: hook JSON; stdout: permission JSON. Requires jq.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' '{"permission":"deny","user_message":"Safety hook requires jq","agent_message":"Install jq; destructive-command guard could not parse input."}'
  exit 0
fi

input="$(cat || true)"
if ! printf '%s' "$input" | jq -e . >/dev/null 2>&1; then
  printf '%s\n' '{"permission":"deny","user_message":"Malformed hook input","agent_message":"beforeShellExecution input was not valid JSON."}'
  exit 0
fi

command="$(printf '%s' "$input" | jq -r '.command // empty')"
if [[ -z "$command" ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

patterns=(
  'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)'
  'git[[:space:]]+push[[:space:]].*(--force([^-]|$)|[[:space:]]-f([[:space:]]|$))'
  'git[[:space:]]+reset[[:space:]].*--hard'
  'git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*f'
  'git[[:space:]]+branch[[:space:]].*-D[[:space:]]'
  'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)'
  'drop[[:space:]]+(table|database|schema)'
  'terraform[[:space:]]+destroy'
  'kubectl[[:space:]]+delete'
  'docker[[:space:]]+(system|volume)[[:space:]]+prune'
  'chmod[[:space:]]+-R[[:space:]]+777'
  'mkfs\.'
  '>([[:space:]]*)/dev/(sd|disk|nvme)'
)

for p in "${patterns[@]}"; do
  if [[ "$command" =~ $p ]]; then
    jq -n --arg cmd "$command" '{
      permission: "ask",
      user_message: ("Potentially destructive command flagged by safety hook — review before running:\n" + $cmd),
      agent_message: "A safety hook flagged this command as potentially destructive. It requires explicit user approval. Do not bypass by rephrasing."
    }'
    exit 0
  fi
done

printf '%s\n' '{"permission":"allow"}'
exit 0
