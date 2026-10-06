# Onboarding Guide: ORISO-Frontend

1. Read `README.md` for the repository purpose, stack, and local commands.
2. Read `docs/README.md` and `docs/architecture/current-architecture.md` for the maintained project documentation, and `MATRIX-INTEGRATION-GUIDE.md` for the Matrix stack.
3. Open `.understand-anything/README.md` and launch the dashboard with the command listed there.
4. Start the guided tour in the dashboard. The refreshed tour covers:

- Core
- Configuration Layer
- API Layer
- Utility Layer
- UI Layer
- Service Layer
- Test Layer
- Supporting Components

## High-Value Entry Points

- `index.ts`
- `src/initApp.tsx`
- `src/components/app/app.tsx`
- `src/components/app/RouterConfig.tsx` (React Router v7 route tables)
- `src/api/index.ts`
- `src/api/fetchData.ts`
- `src/services/matrixClientService.ts`
- `src/services/chatTransportService.ts`
- `src/globalState/index.ts`
- `src/hooks/useAppConfig.tsx`
- `config/webpack.config.js`
- `proxy/server.js`

## Review Tips

- Use `contains` edges to find the functions and classes defined in a file, and `calls` edges to follow function-level dependencies.
- For chat, encryption, and call changes, start in `src/services/` (Matrix client, crypto, key backup, transport, CallManager) before touching UI components.
- For auth-sensitive changes, inspect registration, session-cookie, and Matrix login-data modules before reviewing UI behavior.
- Verification lives in several harnesses: Vitest unit tests, Storybook story tests, Playwright smoke specs under `playwright/`, and Cypress under `cypress/` — check which one covers the area you are changing.
