#!/usr/bin/env bash
set -euo pipefail

DIST="${1:-build}"

if [[ ! -d "$DIST" ]]; then
	echo "Build output directory not found: $DIST" >&2
	exit 1
fi

PATTERNS=(
	'91.99.219.182'
	':8087'
	'caritas.de'
	'online-beratung'
	'app.oriso.site'
	'api.oriso.org'
)

for pattern in "${PATTERNS[@]}"; do
	if matches=$(grep -R -n -F "$pattern" "$DIST" 2>/dev/null || true); then
		if [[ -n "$matches" ]]; then
			echo "Hardcoded deployment value found in $DIST: $pattern" >&2
			echo "$matches" >&2
			exit 1
		fi
	fi
done

echo "No forbidden hardcoded deployment values found in $DIST"
