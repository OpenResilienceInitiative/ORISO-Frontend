# Oxlint ratchet and vendored anti-slop

- `anti-slop/` is vendored from https://github.com/dmmulroy/anti-slop at commit
  `63dbb09f73438e550a6991dc6d778f979ffbf183` (2026-11-20), copied from
  `skills/install-anti-slop/assets/anti-slop` with the upstream install script. MIT licence.
- Local deviation: `anti-slop/package.json` with `"type": "module"` so Node loads the plugin
  without a reparse warning. No rule source was changed.
- Upstream recommends `cloudflare/oxlint-config` for new setups. It needs the type-aware Oxlint
  backend, so this first step uses Oxlint's correctness category plus anti-slop only.
- `oxlintrc.json` holds the rules; `baseline.json` freezes today's findings per file and rule;
  `scripts/oxlint-ratchet.mjs` fails when a count goes up.
- Not enabled on purpose: `require-readable-spacing` (formatting taste, ~17k findings) and
  `no-module-mocking` (tests are out of scope).

## Local checks

- `npm run test:oxlint-ratchet` runs the regression tests of the gate.
- `npm run lint:oxlint` runs the gate; it needs Node 22.18 or later (the `.nvmrc` version).
- `npm run lint:oxlint:update` rewrites the baseline; regenerate it after merging the latest
  `dev`, because PRs merged in the meantime can add findings.
- Commands named inside `anti-slop/` (for example `pnpm check` or `sync:skill-assets` in
  `anti-slop/vendor/eslint-stylistic/UPSTREAM.md`) belong to the upstream repositories and are
  not runnable here. To update the vendored plugin, use the upstream `install-anti-slop` skill.
