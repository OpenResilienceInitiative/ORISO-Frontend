# Onboarding Guide: ORISO-Frontend

1. Read `README.md` in the repository root if present.
2. Open `.understand-anything/README.md` and launch the dashboard using the command shown there.
3. Start with these tour files:

- `README.md` - README.md is a docs file under repository root; starts with "# ORISO Frontend".
- `package.json` - package.json is a config file under repository root; starts with ""name": "@onlineberatung/onlineberatung-frontend",".
- `.cursor/settings.json` - .cursor/settings.json is a config file under .cursor in this repository.
- `.env.example` - .env.example is a config file under repository root; starts with "VITE_PORT=9002".
- `.github/actions/docker-build-push/action.yml` - .github/actions/docker-build-push/action.yml is a config file under .github; starts with "name: Reusable Docker Build and Publish steps".
- `.github/actions/node-build/action.yml` - .github/actions/node-build/action.yml is a config file under .github; starts with "name: Reusable Node Build steps".
- `cypress/fixtures/api.v1.login.json` - cypress/fixtures/api.v1.login.json is a config file under cypress; starts with ""status": "success",".
- `cypress/fixtures/auth.token.json` - cypress/fixtures/auth.token.json is a config file under cypress; starts with ""expires_in": 600,".
- `.github/workflows/ci-feature-branch.yml` - .github/workflows/ci-feature-branch.yml is a pipeline file under .github; starts with "name: CI - Feature Branch".
- `.github/workflows/ci-main.yml` - .github/workflows/ci-main.yml is a pipeline file under .github; starts with "name: CI - Main".
- `.github/workflows/ci-pull-request.yml` - .github/workflows/ci-pull-request.yml is a pipeline file under .github; starts with "name: CI - Pull Request".
- `.github/workflows/ci-storybook-feature-branch.yml` - .github/workflows/ci-storybook-feature-branch.yml is a pipeline file under .github; starts with "name: CI - Storybook Feature Branch".

4. Review architecture layers in `.understand-anything/ARCHITECTURE.md`.
5. For changes, inspect files connected by `imports`, `configures`, `routes`, `deploys`, and `tested_by` edges in the graph.
