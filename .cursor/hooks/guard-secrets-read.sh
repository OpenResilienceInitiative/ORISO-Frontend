#!/usr/bin/env bash
# beforeReadFile: deny known secret / private-key paths.
# stdin: hook JSON; stdout: { permission: allow|deny, ... }. Requires jq.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' '{"permission":"deny","user_message":"Secret-path guard requires jq"}'
  exit 0
fi

input="$(cat || true)"
if ! printf '%s' "$input" | jq -e . >/dev/null 2>&1; then
  printf '%s\n' '{"permission":"deny","user_message":"Malformed beforeReadFile input"}'
  exit 0
fi

file_path="$(printf '%s' "$input" | jq -r '.file_path // empty')"
if [[ -z "$file_path" ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

base="$(basename "$file_path")"
lower="$(printf '%s' "$file_path" | tr '[:upper:]' '[:lower:]')"

is_example=0
if [[ "$base" == *.example || "$base" == *.sample || "$base" == *.template || "$base" == *.example.* ]]; then
  is_example=1
fi

deny=0

if [[ "$is_example" -eq 0 ]]; then
  if [[ "$base" == ".env" || "$base" == .env.* || "$base" == *.secrets.env || "$base" == "config.env" ]]; then
    deny=1
  fi
fi

if [[ "$base" == *.pem || "$base" == *.key || "$base" == "id_rsa" || "$base" == "id_ed25519" ]]; then
  deny=1
fi

if [[ "$base" == realm.json.backup* || "$lower" == *"/backup/"*realm* ]]; then
  deny=1
fi

if [[ "$deny" -eq 1 ]]; then
  jq -n --arg p "$file_path" '{
    permission: "deny",
    user_message: ("Blocked read of sensitive path: " + $p),
    agent_message: "Do not read secret or private-key files. Use *.example templates or ask the user to provide redacted values."
  }'
  exit 0
fi

printf '%s\n' '{"permission":"allow"}'
exit 0
