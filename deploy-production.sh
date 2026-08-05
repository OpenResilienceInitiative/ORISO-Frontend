#!/bin/bash
set -e

# The workloads still live in the legacy `caritas` namespace on the cluster;
# the default therefore documents reality rather than the target name. Override
# with ORISO_K8S_NAMESPACE once the namespace migration lands (see #178).
ORISO_K8S_NAMESPACE="${ORISO_K8S_NAMESPACE:-caritas}"
echo "🔨 Building frontend..."
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend
npm run build

echo "🐳 Building Docker image..."
docker build -t caritas-frontend:latest .

echo "📦 Importing image into k3s..."
docker save caritas-frontend:latest | sudo k3s ctr images import - > /dev/null 2>&1

echo "🚀 Restarting deployment..."
kubectl rollout restart deployment/frontend -n "${ORISO_K8S_NAMESPACE}"
kubectl rollout status deployment/frontend -n "${ORISO_K8S_NAMESPACE}" --timeout=120s

echo "✅ Frontend deployed successfully!"
kubectl get pods -n "${ORISO_K8S_NAMESPACE}" -l app=frontend
