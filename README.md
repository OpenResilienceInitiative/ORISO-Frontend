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

For the mixed local setup where only UserService runs locally, see
[Local Development](./docs/local-development.md).

## Documentation

Use these docs as the canonical references:

- [Architecture](./docs/architecture/current-architecture.md)
- [Engineering Rules](./docs/rules/engineering-rules.md)
- [Implementation Skills](./docs/skills/implementation-skills.md)
- [Planning Guide](./docs/plan/README.md)
- [Master Roadmap](./docs/plan/master-roadmap.md)

Legacy root docs may still exist for historical context, but new documentation should live under `docs/`.

## Knowledge Graph

The generated Understand-Anything graph (`knowledge-graph.json`, `meta.json`, `fingerprints.json`) is not committed to this repository. ORISO-Docs builds it and publishes it as a signed release asset. The hand-written summaries in `.understand-anything/*.md` stay here.

- Browse it: [understand.oriso.org](https://understand.oriso.org/)
- Fetch it locally:

```bash
mkdir -p /tmp/ua && cd /tmp/ua
curl -fsSLO https://github.com/OpenResilienceInitiative/ORISO-Docs/releases/download/ua-graph-latest/ORISO-Frontend.tar.gz
gh attestation verify ORISO-Frontend.tar.gz --repo OpenResilienceInitiative/ORISO-Docs \
  --signer-workflow OpenResilienceInitiative/ORISO-Docs/.github/workflows/ua-graph-refresh.yml
tar -xzf ORISO-Frontend.tar.gz   # unpacks to ORISO-Frontend/.understand-anything/
```

Before relying on it, compare `gitCommitHash` in `meta.json` with `origin/dev`.

To open the fetched graph in a local dashboard:

```bash
cd "$UNDERSTAND_ANYTHING_DASHBOARD"
GRAPH_DIR=/tmp/ua/ORISO-Frontend pnpm exec vite --host 127.0.0.1
```

Set `UNDERSTAND_ANYTHING_DASHBOARD` to your local Understand-Anything `packages/dashboard` directory before running the command.

Find the access token in the terminal output after the dashboard starts. Use the full URL from the line that starts with `Dashboard URL`, for example:

```bash
http://127.0.0.1:5173/?token=<token>
```

Local regeneration (`/understand . --full`) still works, but its output is git-ignored. Do not commit it; the published graph is the shared one.
