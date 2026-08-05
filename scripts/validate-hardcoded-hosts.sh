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

# Fixed strings miss the domain that actually caused FE-H05: the mandatory
# privacy/imprint fallback pointed at `caritas-beratungundhilfe.de`, which does
# not contain the literal `caritas.de`. Match any Caritas *domain* instead.
# Deliberately anchored on a TLD so German UI copy ("Beratung der Caritas.")
# and in-cluster names ("caritas.svc.cluster.local") do not trip the gate.
REGEX_PATTERNS=(
	'caritas[a-z0-9-]*\.(de|org|com|net)'
)

# Source maps embed `sourcesContent` — the original files, comments and all —
# so they match on prose that never becomes a runtime value (e.g. the
# `app.oriso.org -> api.oriso.org` example in runtimeConfig.ts). A genuinely
# hardcoded value is emitted into the .js/.css/.html as well, so skipping maps
# costs no real coverage and keeps this gate free of false failures.
for pattern in "${PATTERNS[@]}"; do
	if matches=$(grep -R -n -F --exclude='*.map' "$pattern" "$DIST" 2>/dev/null || true); then
		if [[ -n "$matches" ]]; then
			echo "Hardcoded deployment value found in $DIST: $pattern" >&2
			echo "$matches" >&2
			exit 1
		fi
	fi
done

for pattern in "${REGEX_PATTERNS[@]}"; do
	if matches=$(grep -R -n -E -i --exclude='*.map' "$pattern" "$DIST" 2>/dev/null || true); then
		if [[ -n "$matches" ]]; then
			echo "Third-party domain found in $DIST: /$pattern/i" >&2
			echo "$matches" | cut -c1-200 >&2
			exit 1
		fi
	fi
done

echo "No forbidden hardcoded deployment values found in $DIST"
