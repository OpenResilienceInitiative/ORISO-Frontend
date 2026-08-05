#!/usr/bin/env bash
#
# Applies this repo's raw manifests into a namespace chosen at deploy time.
#
# FE-H05 (#178): the manifests used to pin `namespace: caritas` in object
# metadata. A fixed namespace is not acceptable — @joro4b's ruling on #178 is
# that it should always be supplied at deploy time. Helm charts never carry the
# release namespace in metadata, and the raw equivalent is to let the apply
# supply it.
#
# The namespace comes from ORISO_K8S_NAMESPACE — the same variable the deploy
# scripts use — and is also substituted into manifests that must name it
# explicitly (Traefik middleware references).
#
# Usage:
#   ORISO_K8S_NAMESPACE=oriso ./scripts/apply-k8s.sh deployment-v2.yaml service-v2.yaml
#
# Defaults to `caritas`, the namespace pre-dev runs in today, so this script is
# behaviour-preserving until someone deliberately overrides it.
set -euo pipefail

ORISO_K8S_NAMESPACE="${ORISO_K8S_NAMESPACE:-caritas}"
export ORISO_K8S_NAMESPACE

if [[ $# -eq 0 ]]; then
	echo "Usage: ORISO_K8S_NAMESPACE=<ns> $0 <manifest.yaml> [manifest.yaml ...]" >&2
	exit 1
fi

for manifest in "$@"; do
	if [[ ! -f "$manifest" ]]; then
		echo "Manifest not found: $manifest" >&2
		exit 1
	fi
done

echo "Applying $# manifest(s) into namespace '${ORISO_K8S_NAMESPACE}'"

for manifest in "$@"; do
	echo "  -> ${manifest}"
	# envsubst is restricted to ORISO_K8S_NAMESPACE so unrelated $VARs in the
	# manifests (none today, but cheap insurance) are left untouched.
	envsubst '${ORISO_K8S_NAMESPACE}' <"$manifest" |
		kubectl apply -n "$ORISO_K8S_NAMESPACE" -f -
done

echo "Applied into namespace '${ORISO_K8S_NAMESPACE}'"
