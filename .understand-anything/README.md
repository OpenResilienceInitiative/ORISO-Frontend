# Understand-Anything Graph: ORISO-Frontend

This directory contains the Understand-Anything graph and developer notes for `ORISO-Frontend`.

## Graph

- Graph file: `.understand-anything/knowledge-graph.json`
- Generated at: `2026-06-11T18:41:36.426Z`
- Source commit: `36fb0462dbb0106d764c836cf2e9f517f3c84789`
- Files analyzed: 985
- Nodes: 2601
- Edges: 5534

## Repository Purpose

Frontend application for the Online-Beratung platform, including registration, messaging, bookings, profile flows, and Matrix-backed real-time communication.

## Existing Setup Status

Previous graph already referenced commit `36fb0462dbb0106d764c836cf2e9f517f3c84789`; regenerated to refresh documentation and derived graph structure.

## Dashboard

From this repository root:

```sh
PLUGIN_ROOT="$HOME/.understand-anything-plugin"
test -d "$PLUGIN_ROOT/packages/dashboard" || PLUGIN_ROOT="$HOME/.understand-anything/repo/understand-anything-plugin"
cd "$PLUGIN_ROOT/packages/dashboard"
GRAPH_DIR="$(pwd)" npx vite --host 127.0.0.1
```

Use the tokenized URL printed by Vite. The dashboard reads `.understand-anything/knowledge-graph.json`.

## Main Files Scanned

- `.cursor/settings.json (config, json)`
- `.dockerignore (code, unknown)`
- `.env.example (config, config)`
- `.github/actions/docker-build-push/action.yml (config, yaml)`
- `.github/actions/node-build/action.yml (config, yaml)`
- `.github/workflows/ci-feature-branch.yml (pipeline, yaml)`
- `.github/workflows/ci-main.yml (pipeline, yaml)`
- `.github/workflows/ci-pull-request.yml (pipeline, yaml)`
- `.github/workflows/ci-storybook-feature-branch.yml (pipeline, yaml)`
- `.github/workflows/ci-storybook-main.yml (pipeline, yaml)`
- `.github/workflows/ci-storybook-pull-request.yml (pipeline, yaml)`
- `.github/workflows/frontend-deploy.yml (pipeline, yaml)`
