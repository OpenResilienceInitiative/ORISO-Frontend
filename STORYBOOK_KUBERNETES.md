# Storybook and Kubernetes

## Where the running Storybook gets its image

- **Helm chart:** `caritas-workspace/ORISO-Kubernetes/helm/charts/storybook/`
- **Deployment template:** `templates/deployment.yaml` → container image `{{ .Values.image.repository }}:{{ .Values.image.tag }}`
- **Default values:** `helm/charts/storybook/values.yaml` → `repository: caritas-storybook`, `tag: latest` (often `pullPolicy: Never` for local clusters)
- **Ingress (example):** `caritas-workspace/ORISO-Kubernetes/ingress/22-storybook-ingress.yaml` → host `storybook.oriso-dev.site`, service `oriso-platform-storybook`
- **Bundled snapshot:** `configmaps/.../all-workloads.yaml` may list `image: caritas-storybook:latest` for `oriso-platform-storybook`

## How the Docker image is built (this repo)

- **Dockerfile:** `caritas-workspace/ORISO-Frontend/Dockerfile.storybook`
- **Steps:** Node image → `npm install` → `npm run build-storybook` → static output to `storybook-static/` → **nginx:alpine** serves `/usr/share/nginx/html`

Source of truth for UI is always **`ORISO-Frontend`** (this app’s `src/` + `.storybook/`).

## Redeploy Storybook to the cluster (typical flow)

From **`caritas-workspace/ORISO-Frontend`** (adjust registry/tag for your environment):

```bash
docker build -f Dockerfile.storybook -t caritas-storybook:latest .
# If the cluster pulls from a registry, tag and push there, then set image in values.

kubectl rollout restart deployment/oriso-platform-storybook -n caritas
# namespace/name may differ; match your Helm release.
```

Or reinstall/upgrade the **storybook** subchart of `oriso-platform` with updated `image.tag` / `image.repository`.

## Local verification

```bash
cd caritas-workspace/ORISO-Frontend
npm run build-storybook
npx serve storybook-static
```

`npm run storybook` runs the dev server on port **6006** (not the same as the nginx image, which serves the static build).
