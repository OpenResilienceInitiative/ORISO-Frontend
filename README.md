# ORISO Frontend

## Overview
React/Vite-based frontend application for the Online Beratung platform with Matrix integration for real-time communication and video calls.

## Quick Start

### Build Docker Image
```bash
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend
docker build -t caritas-frontend:latest .
sudo k3s ctr images import <(docker save caritas-frontend:latest)
```

### Run Locally (Development)
```bash
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend
npm install
npm run dev
```

### Environment Configuration
Copy `.env.example` to `.env` and configure:

```bash
# API Configuration
VITE_API_URL=http://91.99.219.182

# Matrix Configuration
VITE_MATRIX_HOMESERVER_URL=https://matrix.oriso.de
VITE_MATRIX_DOMAIN=matrix.oriso.de

# Keycloak Configuration
VITE_KEYCLOAK_URL=http://91.99.219.182:8080
VITE_KEYCLOAK_REALM=online-beratung
VITE_KEYCLOAK_CLIENT_ID=app

# Jitsi Configuration
VITE_JITSI_DOMAIN=meet.oriso.de
VITE_JITSI_ROOM_PREFIX=caritas_
```

## Kubernetes Deployment
```bash
kubectl apply -f /home/caritas/Desktop/online-beratung/kubernetes-complete/03-frontend-admin.yaml
```

## Important Notes
- Uses Docker image: `caritas-frontend:latest`
- Runs on port: `80`
- Environment variables are baked into the Docker image during build
- Matrix SDK integration for real-time messaging and WebRTC calls
- Requires Nginx proxy for HTTPS and routing

## Dependencies
- Node.js 18+
- React 18
- Vite 4
- Matrix JS SDK
- Keycloak JS adapter

## Troubleshooting
- If build fails, ensure `.env` file exists and is properly formatted
- For CORS issues, check Nginx configuration
- For Matrix connection issues, verify Matrix homeserver URL and domain
