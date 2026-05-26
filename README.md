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

CI split test marker 2026-05-26T11:10:52Z
