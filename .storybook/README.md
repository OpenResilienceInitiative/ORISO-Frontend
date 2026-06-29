# Storybook + Storybook MCP

Storybook **10** on the **Vite** builder, with the official **Storybook MCP**
(`@storybook/addon-mcp`) so AI coding agents (Claude Code, Codex, Cursor, …) can
query our **real** components — names, props, variants, usage — and reuse them
instead of regenerating markup.

## Run it

```bash
npm run storybook            # dev server on http://localhost:6006
```

The MCP endpoint is then live at `http://localhost:6006/mcp`. Register it once
with your agent, e.g. Claude Code:

```bash
claude mcp add --transport http storybook http://localhost:6006/mcp
```

The agent then has tools like `list-all-documentation`, `get-documentation`,
and `get-documentation-for-story`. Pair it with the Figma MCP (design side) for a
design→code loop that stays on our design system. Code Connect is **not** needed
(it is Organization/Enterprise-only); the MCP reads our Storybook directly.

## Builder = Vite (not the app's webpack)

Storybook was migrated from 7 (custom webpack) to 10 on **Vite**, decoupled from
`config/webpack.config.js`. To keep parity with the app's webpack, `main.ts`'s
`viteFinal` adds:

- **settings.scss prepend** — `css.preprocessorOptions.scss.additionalData` (the
  app's sass-loader did this); `loadPaths` for bare scss imports.
- **`~pkg` scss imports** — a sass `importers.findFileUrl` strips the webpack `~`
  (dart-sass can't resolve it).
- **extensionless style imports** — `.scss/.css` added to `resolve.extensions`
  (components do `import './x.styles'`).
- **`process.env`** — `define: { 'process.env': {} }` so `REACT_APP_*` reads
  don't crash under Vite.
- **CRA svg dual-mode** — a tiny pre-load plugin rewrites a bare `.svg` import to
  re-export `{ default } from '?url'` (asset URL) **and**
  `{ default as ReactComponent } from '?react'` (vite-plugin-svgr), replicating
  `@svgr/webpack` so both `import x from './x.svg'` and
  `import { ReactComponent } from './x.svg'` work.

`preview.tsx` wraps every story in the full app shell (MUI theme + i18n + router +
mocked context providers: RocketChat, E2EE, Registration, UserData, …) so
context-driven components render.

## Story taxonomy (mirrors Figma)

Stories are titled by atomic-design level so they line up with the Figma
structure: `Atoms/*`, `Molecules/*`, `Organisms/*`, `Templates/*`. When adding a
component, pick the level it has in Figma.

## Status / known limitations

- Coverage is incremental (~30 of ~95 components so far). Add stories per
  component; the MCP only sees what has a story (it can also help write them).
- Some organisms compile and expose props but render `Loading`/empty without a
  real route param + network data — that's fine for MCP prop extraction.
- Legacy SB7-era stories that are not yet in the `stories` glob (e.g. some
  `sessionsList`/`message` ones) are **not** migrated yet and may use removed
  SB7 packages; migrate them before adding to the glob.
