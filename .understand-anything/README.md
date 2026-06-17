# Understand-Anything Graph: ORISO-Frontend

This directory contains the Understand-Anything graph and graph documentation for the ORISO frontend repository.

## Graph

- Graph file: `.understand-anything/knowledge-graph.json`
- Source commit: `36fb0462dbb0106d764c836cf2e9f517f3c84789`
- Generated at: `2026-06-12T02:09:52.466Z`
- Files analyzed: 1009
- Files filtered by `.understandignore`: 131
- Nodes: 2002
- Edges: 4243
- Layers: 13
- Tour steps: 8

The refresh is scoped to this repository only. Generated graph outputs and scratch paths are excluded from analysis through `.understand-anything/.understandignore`.

## Repository Purpose

ORISO-Frontend is the React and TypeScript frontend for the Online-Beratung platform. It covers registration, authentication, messaging, bookings, profile flows, localization, Matrix-backed real-time communication, and frontend deployment assets.

## Dashboard

From this repository root:

```sh
PROJECT_DIR="$(pwd)"
PLUGIN_ROOT="$HOME/.understand-anything-plugin"
test -d "$PLUGIN_ROOT/packages/dashboard" || PLUGIN_ROOT="$HOME/.understand-anything/repo/understand-anything-plugin"
cd "$PLUGIN_ROOT/packages/dashboard"
GRAPH_DIR="$PROJECT_DIR" pnpm exec vite --host 127.0.0.1
```

Open the tokenized dashboard URL printed by Vite. The dashboard reads:

```sh
.understand-anything/knowledge-graph.json
```

## Refresh Notes

- Latest `dev` was fetched and merged into `feature/understand-anything-graph`.
- Slash commands were not directly callable in this Codex session, so the installed Understand-Anything scripts were used locally.
- The graph was rebuilt from the current repository, not from a parent folder or sibling repository.
- Scratch outputs under `.understand-anything/intermediate/` and `.understand-anything/tmp/` are not intended for commit.
