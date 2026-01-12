---
description: 'High-level project overview, tech stack, and architecture for ORISO Frontend'
alwaysApply: true
---

# Project Overview

## Overview

ORISO Frontend is a React-based application for the Online Beratung (Online Counseling) platform. It provides real-time communication, video calls, and counseling session management with multi-tenant support.

## Tech Stack

### Core Technologies

- **React**: 18.3.1 (functional components with hooks)
- **TypeScript**: 5.3.3 (strict mode, except strictNullChecks: false)
- **Webpack**: 5.89.0 (custom configuration)
- **SCSS**: 1.70.0 (BEM naming, CSS modules support)
- **Node.js**: >=18.16.1

### Key Libraries

- **Matrix JS SDK**: 38.4.0 - Real-time messaging and WebRTC calls
- **Compound UI**: @vector-im/compound-web 8.2.5 - Design system components
- **Material-UI**: @mui/material 5.13.7 - UI components
- **React Router**: 5.3.4 - Client-side routing
- **i18next**: 23.8.2 - Internationalization with WebLate integration
- **Jotai**: 2.7.0 - Atomic state management
- **Cypress**: 13.6.3 - E2E testing
- **Storybook**: 7.0.18 - Component documentation

### Development Tools

- **ESLint**: Code linting (react-app config)
- **Prettier**: Code formatting
- **Stylelint**: SCSS linting
- **TypeScript**: Type checking
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Project Structure

```
src/
├── api/              # API functions (apiActionName.ts pattern)
├── components/       # React components (ComponentName.tsx)
├── containers/       # Page-level containers
├── globalState/     # Context providers and global state
│   ├── provider/    # Context providers
│   ├── interfaces/  # TypeScript interfaces
│   └── state.tsx     # Provider composition
├── hooks/           # Custom React hooks (useHookName.tsx)
├── services/        # Domain services (Matrix, LiveKit, etc.)
├── utils/           # Utility functions
├── resources/       # Static resources
│   ├── i18n/        # Translation files
│   ├── img/         # Images and SVGs
│   └── styles/      # Global styles
├── store/           # Jotai atoms
└── types/           # TypeScript type definitions
```

## Key Patterns

### Component Structure

- **Component files**: `ComponentName.tsx` (PascalCase)
- **Style files**: `componentName.styles.scss` or `componentName.module.scss`
- **Export pattern**: Named exports (`export const ComponentName`)
- **Props interfaces**: `ComponentNameProps`

### API Pattern

- **API functions**: `apiActionName.ts` (e.g., `apiGetUserData.ts`)
- **Always use**: `fetchData` utility from `src/api/fetchData.ts`
- **Error handling**: `FETCH_ERRORS` constants
- **Response handling**: `responseHandling` parameter array

### State Management

- **Global state**: Context providers in `src/globalState/provider/`
- **Provider composition**: `ProviderComposer` pattern
- **Simple state**: Jotai atoms in `src/store/`
- **Local state**: `useState` hook
- **Temporary state**: Session storage (registration data)

### Styling

- **SCSS with BEM**: `component__element--modifier`
- **CSS modules**: Supported (see `Box` component)
- **Theming**: CSS variables `--skin-color-*` (multi-tenant)
- **Design tokens**: Compound UI `--cpd-*` variables

## Architecture Decisions

### Multi-Tenant Support

- Each tenant can have custom theming via CSS variables
- Tenant-specific settings loaded from backend
- Theme variables: `--skin-color-*`

### Real-Time Communication

- **Matrix SDK**: Primary messaging and presence
- **LiveKit**: Video conferencing
- **WebSocket**: Real-time updates
- **Matrix Client Service**: Singleton pattern for client management

### Internationalization

- **i18next** with WebLate integration
- **Translation files**: `src/resources/i18n/`
- **Namespaces**: `common`, `consultingTypes`, `agencies`, `languages`
- **Fallback language**: German (`de`)

### Authentication

- **Keycloak**: Primary authentication
- **Token storage**: Cookies (session-based)
- **CSRF protection**: Token generation and validation
- **Matrix authentication**: Integrated with Keycloak

## Development Workflow

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run test` - Run Cypress E2E tests
- `npm run lint` - Lint code (ESLint + TypeScript)
- `npm run lint:style` - Lint SCSS
- `npm run storybook` - Start Storybook

### Code Quality

- **Pre-commit hooks**: Husky + lint-staged
- **Formatting**: Prettier (single quotes, tabs, no trailing commas)
- **Linting**: ESLint (react-app config) + Stylelint
- **Type checking**: TypeScript strict mode

### Testing

- **E2E**: Cypress (port 9001)
- **Component docs**: Storybook (port 6006)
- **Test data**: Cypress fixtures

## Key Files Reference

- `src/initApp.tsx` - Application entry point
- `src/components/app/app.tsx` - Main app component
- `src/api/fetchData.ts` - API utility function
- `src/globalState/state.tsx` - Context provider composition
- `src/services/matrixClientService.ts` - Matrix client service
- `src/i18n.ts` - i18next configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.stylelintrc.js` - SCSS linting rules

## Browser Support

- **Production**: >0.2%, IE 11, not dead, not op_mini all
- **Development**: Last 1 Chrome, Firefox, Safari versions

## Environment Variables

- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_MATRIX_HOMESERVER_URL` - Matrix homeserver
- `REACT_APP_KEYCLOAK_URL` - Keycloak URL
- `REACT_APP_ENABLE_TRANSLATION_CHECK` - Translation validation

## References

- `package.json` - Complete dependency list
- `README.md` - Setup and deployment instructions
- `STORYBOOK_SETUP.md` - Storybook configuration
- `src/globalState/globalState_notes.md` - State management documentation
