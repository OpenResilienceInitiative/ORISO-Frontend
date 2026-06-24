# Onboarding Guide: ORISO-Frontend

1. Read `README.md` for the repository purpose, stack, and local commands.
2. Read `docs/README.md` and `docs/architecture/current-architecture.md` for the maintained project documentation.
3. Open `.understand-anything/README.md` and launch the dashboard with the command listed there.
4. Start the guided tour in the dashboard. The refreshed tour covers:

- Project Overview
- Application Bootstrap
- Backend API Boundary
- Authentication And Invites
- Messaging And Realtime
- State Hooks And Configuration
- Features And Screens
- Quality And Delivery

## High-Value Entry Points

- `index.ts`
- `src/initApp.tsx`
- `src/App.tsx`
- `src/api/index.ts`
- `src/api/fetchData.ts`
- `src/globalState/index.ts`
- `src/hooks/useAppConfig.tsx`
- `config/webpack.config.js`
- `proxy/server.js`

## Review Tips

- Use `imports` edges to follow TypeScript module dependencies.
- Use `configures` edges to inspect package, webpack, Cypress, Storybook, and runtime configuration relationships.
- Use `deploys` and `triggers` edges for Docker, Kubernetes, and CI/CD delivery context.
- For auth-sensitive changes, inspect the Auth Registration Session layer before reviewing UI behavior.
