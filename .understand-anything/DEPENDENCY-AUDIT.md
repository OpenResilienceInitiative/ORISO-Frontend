# Dependency Audit: ORISO-Frontend

## Detected Manifests

- `package.json`
- `src/extensions/package.json`
- `proxy/package.json`

## Main Runtime Dependencies

- React and React DOM
- React Router v5
- MUI and Emotion
- Matrix JS SDK
- LiveKit client and React components
- STOMP/SockJS communication clients
- i18next localization stack
- Tiptap and Draft.js editor tooling
- Cypress fixtures and support code for integration coverage

## Build And Tooling Dependencies

- Webpack custom build pipeline
- Babel and TypeScript
- ESLint, Stylelint, and Prettier
- Storybook
- Cypress component and e2e test tooling
- Playwright package presence for browser testing support
- Docker, Kubernetes YAML, and GitHub Actions workflow files

## Graph Dependency Signals

- Internal import edges: 2179
- Configuration edges: 80
- Deployment edges: 3
- CI/CD trigger edges: 7

## Audit Notes

- The graph does not perform vulnerability scanning. Run the repository's package audit tooling separately when dependency security is in scope.
- Generated graph outputs, fingerprints, and scratch files are excluded from graph dependency analysis.
- Backend API compatibility cannot be proven from this frontend repository alone.
