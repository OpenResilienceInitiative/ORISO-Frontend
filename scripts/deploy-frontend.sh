#!/usr/bin/env bash
set -euo pipefail

# Defaults match production ORISO — override only when deploying elsewhere.
export ORISO_APP_HOST="${ORISO_APP_HOST:-app.oriso.org}"
export ORISO_APP_TLS_SECRET="${ORISO_APP_TLS_SECRET:-app-oriso-org-tls}"
export FRONTEND_IMAGE="${FRONTEND_IMAGE:-ghcr.io/openresilienceinitiative/oriso-frontend:dev}"

export LIVEKIT_TOKEN_SERVICE_URL="${LIVEKIT_TOKEN_SERVICE_URL:-http://livekit-token-service.caritas.svc.cluster.local:3010}"
export KEYCLOAK_REALM_URL="${KEYCLOAK_REALM_URL:-http://oriso-platform-keycloak.caritas.svc.cluster.local:8080/realms/online-beratung}"
export USER_SERVICE_URL="${USER_SERVICE_URL:-http://oriso-platform-userservice.caritas.svc.cluster.local:8082}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="${SCRIPT_DIR}/../manifests/deployment.yaml"

echo "Deploying frontend image: ${FRONTEND_IMAGE}"
echo "Ingress host: ${ORISO_APP_HOST}"
envsubst < "${MANIFEST_FILE}" | kubectl apply -f -
kubectl rollout status deployment/frontend -n caritas --timeout=180s
kubectl get pods -n caritas -l app=frontend
