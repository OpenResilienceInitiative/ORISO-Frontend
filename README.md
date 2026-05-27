# ORISO Frontend

Frontend application for the Online-Beratung platform, including registration, messaging, bookings, profile flows, and Matrix-backed real-time communication.

## Current Stack

- React + TypeScript
- custom webpack build and dev pipeline
- `react-router-dom` v5 routing
- SCSS, CSS modules, and MUI theming
- Storybook and Cypress

For the full architecture and workflow rules, use the docs hub:

- [docs/README.md](./docs/README.md)

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

### Common Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run storybook
```

### Environment Setup

Copy `.env.example` to `.env` and provide the environment values required by your local or deployment target.

## Documentation

Use these docs as the canonical references:

- [Architecture](./docs/architecture/current-architecture.md)
- [Engineering Rules](./docs/rules/engineering-rules.md)
- [Implementation Skills](./docs/skills/implementation-skills.md)
- [Planning Guide](./docs/plan/README.md)
- [Master Roadmap](./docs/plan/master-roadmap.md)

Legacy root docs may still exist for historical context, but new documentation should live under `docs/`.

## Knowledge Graph

This repo has an Understand-Anything graph at:

```bash
.understand-anything/knowledge-graph.json
```

To open the graph dashboard:

```bash
PROJECT_DIR="$(pwd)"
cd "$UNDERSTAND_ANYTHING_DASHBOARD"
GRAPH_DIR="$PROJECT_DIR" pnpm exec vite --host 127.0.0.1
```

Set `UNDERSTAND_ANYTHING_DASHBOARD` to your local Understand-Anything `packages/dashboard` directory before running the command.

Find the access token in the terminal output after the dashboard starts. Use the full URL from the line that starts with `Dashboard URL`, for example:

```bash
http://127.0.0.1:5173/?token=<token>
```

Auto-update is enabled for this repo through `.understand-anything/config.json`. The equivalent Understand-Anything setup command is:

```bash
/understand . --auto-update
```

In an environment that supports the Understand-Anything auto-update hook, the graph is updated after commits. If the hook is not available or the graph looks stale after meaningful project changes, rebuild it manually by running the Understand-Anything skill again for this repo, or use `/understand . --full` if your agent environment exposes the slash command.
