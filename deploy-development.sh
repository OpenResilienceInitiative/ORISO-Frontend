#!/bin/bash
set -e

# The workloads still live in the legacy `caritas` namespace on the cluster;
# the default therefore documents reality rather than the target name. Override
# with ORISO_K8S_NAMESPACE once the namespace migration lands (see #178).
ORISO_K8S_NAMESPACE="${ORISO_K8S_NAMESPACE:-caritas}"
echo "🔨 Building frontend..."
cd /root/online-beratung/ORISO-Complete/caritas-workspace/ORISO-Frontend
npm run build

echo "🐳 Building Docker image..."
TIMESTAMP=$(date +%s)
IMAGE_TAG="caritas-frontend:dev-${TIMESTAMP}"
docker build -t ${IMAGE_TAG} .
docker tag ${IMAGE_TAG} caritas-frontend:latest

echo "📦 Importing image into k3s..."
docker save ${IMAGE_TAG} | sudo k3s ctr images import - > /dev/null 2>&1
docker save caritas-frontend:latest | sudo k3s ctr images import - > /dev/null 2>&1

echo "🚀 Restarting deployment..."
kubectl rollout restart deployment/oriso-platform-frontend -n "${ORISO_K8S_NAMESPACE}"
kubectl rollout status deployment/oriso-platform-frontend -n "${ORISO_K8S_NAMESPACE}" --timeout=120s

echo "✅ Frontend deployed successfully!"
echo "📋 Checking pod status..."
kubectl get pods -n "${ORISO_K8S_NAMESPACE}" -l app=frontend

echo "🔍 Verifying image details..."
kubectl get pod -n "${ORISO_K8S_NAMESPACE}" -l app=frontend -o jsonpath='{.items[0].spec.containers[0].image}{"\n"}'
kubectl get pod -n "${ORISO_K8S_NAMESPACE}" -l app=frontend -o jsonpath='{.items[0].status.containerStatuses[0].imageID}{"\n"}'
