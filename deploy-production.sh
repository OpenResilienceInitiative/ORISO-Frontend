#!/bin/bash
set -e
echo "🔨 Building frontend..."
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend
npm run build

echo "🐳 Building Docker image..."
docker build -t caritas-frontend:latest .

echo "📦 Importing image into k3s..."
docker save caritas-frontend:latest | sudo k3s ctr images import - > /dev/null 2>&1

echo "🚀 Restarting deployment..."
kubectl rollout restart deployment/frontend -n caritas
kubectl rollout status deployment/frontend -n caritas --timeout=120s

echo "✅ Frontend deployed successfully!"
kubectl get pods -n caritas -l app=frontend
