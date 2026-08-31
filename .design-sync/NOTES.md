# design-sync notes — ORISO-Frontend (App Layer)

Target project: `ORISO App Layer` (`2766579f-40fe-4c6f-b10d-bac90ee284c1`).

## Context

- The workspace root `/Users/kio/Documents/GitHub/ORISO` is a multi-repo checkout, not a
  design-system repo. This repo is one of two DS sources; `ORISO-Admin` syncs into its own
  separate project because the two ship different MUI majors (v5 here, v9 there) and
  different styling idioms — one bundle/`styles.css`/anchor per project can't hold both.
- Owner decision (2026-08-18): **antd components are legacy and must stay out of the design
  system.** The antd → Material 3 migration was started and never finished, so several
  implementations of the same control coexist. This repo has no antd dependency, so that rule
  binds the ORISO-Admin run, not this one.
- Synced from branch `fix/ui-polish-814` (owner's explicit choice), not `pre-dev`.

## [GENERAL] Findings from the first sync

- **`node_modules` was two weeks stale and the storybook build failed because of it.**
  `package.json`/`package-lock.json` were updated 2026-08-04, `node_modules` was from
  2026-07-17, so `react-joyride` (in the lock, imported by
  `src/components/productTour/ProductTourAdapter.tsx`) was never installed. Vite dev tolerates
  that; `storybook build` dies with `Rollup failed to resolve import "react-joyride"`. Plain
  `npm ci` fixes it — `--legacy-peer-deps` was NOT needed on this branch, contrary to older
  workspace lore. **Always `npm ci` before building the reference.**
- **`npm i` under this npm blocks postinstall scripts by default.** The staged converter deps
  in `.ds-sync/` install esbuild without its binary until
  `npm approve-scripts esbuild` runs. Symptom would be esbuild failing at require time.
- **The reference storybook build reports exit 0 on the wrapper but can still have failed** —
  `index.json` gets written during indexing, before the preview bundle builds. Check for
  `iframe.html` (the skill says so for a reason; here it was the only signal).
- The build log is drowned in `"use client" directive was ignored` warnings from
  `@mui/icons-material`. Harmless noise — filter them out when looking for real errors.

## [GENERAL] Why there is a generated bundle entry

This repo is an **application**: no `dist/`, no barrel, `main` points at a non-existent
`index.ts`. The converter needs one module whose exports become `window.OrisoApp`, so
`.design-sync/gen-entry.mjs` generates `.design-sync/ds-entry.ts` from the storybook index.
It is wired as `cfg.buildCmd`, so re-syncs regenerate it automatically.

Two things it has to get right, both dictated by `lib/story-imports.mjs`:

1. **Rule 2** redirects any story import resolving to an exported component's module onto the
   global — so every binding a story destructures alongside the component
   (`import { Box, BoxTypes } from './Box'`) must also be an export, or the cell gets
   `undefined`.
2. **Rule 3** bundles helpers from source, and component imports _inside_ those helpers
   recurse back through rule 2. So the generator walks relative imports up to depth 3 rather
   than stopping at the story file — `GroupCallWidget` is only reachable through
   `__storybook__/groupCallHarness.tsx`, and would otherwise be missing from the global.

Component modules are identified by PascalCase file/dir name or a `*Component` suffix, with a
fallback for the `import { Card } from './'` idiom (lowercase dir, PascalCase binding).
Story scaffolding stays lowercase by convention here (`messageStoryShell`,
`composerStoryDecorator`, `sessionHelpers`, `storybookDesignLinks`) and is correctly excluded.

Result: 139 component modules, 213 exports, 107 of 108 story titles reaching a component.

## [GENERAL] Why the entry is pre-compiled

`lib/bundle.mjs` runs esbuild with a fixed option set — no `.scss` loader, no extra
`resolveExtensions` — and the skill marks it as app-contract surface that must never be
forked. This repo's components import SCSS directly, extensionless
(`import './agencyLanguages.styles'` — the CRA/webpack convention that `.storybook/main.ts`
mirrors), so the converter's bundler produced **183 esbuild errors** on raw source.

`.design-sync/prebundle.mjs` compiles `ds-entry.ts` first, with exactly the loaders
`.storybook/main.ts` uses, and the converter gets finished JS. It is chained into
`cfg.buildCmd`, so re-syncs do it automatically. What it has to replicate:

- **SCSS**: `settings.scss` prepended to every sheet, `loadPaths` = [own dir, `src`,
  `node_modules`], and webpack's `~pkg` prefix stripped (dart-sass has no such notion).
- **`resolveExtensions`** including `.scss`/`.css`/`.sass` for the extensionless imports.
- **CRA dual-export SVG** (`import { ReactComponent as Icon }`) via `@svgr/core` — 116 files
  depend on the named half. **Trap:** SCSS reaches SVGs too
  (`background: url(.../arrow-down.svg)`), and a CSS url-token cannot consume a JSX module.
  The plugin therefore claims SVGs in `onResolve` only when `args.kind !== 'url-token'`;
  CSS-side ones fall through to the `'.svg': 'dataurl'` loader. Without that split the build
  fails with `Cannot use "…svg" as a URL`.
- **`packages: 'external'`** — every bare import stays an import, so the converter still does
  its own dependency resolution and its `react`/`react-dom`/`react-is`/`scheduler` shims still
  bind to `window.React`. Pre-inlining React here would break those shims.

Output: `.design-sync/.cache/ds-entry.bundle.js` (~7 MB) + `.css` (~570 KB, wired as
`cfg.cssEntry`), 163 packages left external.

- **`titleMap` keys are title SEGMENTS, not full titles** (`lib/common.mjs:72` `titleParts`).
  `{"<Segment>": null}` excludes a component from the sync entirely.
- `Components/Layout/ResizableSidebar` is a documentation-only story — no component import at
  all — and is excluded via `titleMap: {"ResizableSidebar": null}`.
- Four export collisions are benign: `globalState/index.ts` and
  `globalState/interfaces/index.ts` are re-export barrels, so the "dropped" sibling module
  exports the _same_ object identity. First-wins is correct here.
- Pulling the `globalState` providers/contexts onto the global was not the goal but is a
  welcome side effect: stories that wrap components in `MatrixClientContext` /
  `ServerSettingsProvider` now share context identity with the bundled component instead of
  bundling a second copy from source.

## [GENERAL] How components become visible to the converter

Two separate mechanisms, easy to confuse — both are needed:

- **`cfg.componentSrcMap`** adds/pins components for the PACKAGE shape and provides
  source enrichment. On the **storybook** shape it does NOT decide which titles survive.
- **`exportedNames()`** (`lib/dts.mjs`) is what the storybook adapter matches story titles
  against. It reads ONE file: `projectFor()` at `lib/dts.mjs:90` opens
  `<pkgDir>/<pkgJson.types ?? 'index.d.ts'>`. With no `types` field that is **`<repo>/index.d.ts`**
  — note that `findTypesRoot()` may report a `types/` directory, but a `types/index.d.ts`
  is never read by this path. Writing declarations there produced
  `[DTS] parsed 1 .d.ts files from …/types` alongside `exported PascalCase symbols: 0`.

`gen-entry.mjs` therefore writes `index.d.ts` at the repo root (gitignored, regenerated by
`buildCmd`). Entries use `typeof import('<source>').<Export>` rather than
`ComponentType<any>`, so ts-morph resolves the real `.tsx` and the per-component `.d.ts`
the design agent codes against carries actual props (77 of 95 resolve that way; composite
demo stories fall back to `any`).

**Bug worth remembering:** the generator first merged its own auto-generated `titleMap`
nulls forward. Reading them back on the next run made every excluded title invisible to
the classification, which then wrote an empty `titleMap` — the set oscillated between runs
instead of converging. Auto-nulls are now recomputed from scratch each run; only
human-written renames (non-null values) are preserved.

## [GENERAL] The `story-imports` fork

`.design-sync/overrides/story-imports.mjs`, declared in `cfg.libOverrides`. The preview
compile needs two things the app's own build has and `cfg.storyImports.*` cannot express
(that seam returns `{plugins, loaders}` only — no `resolveExtensions`):

1. **Extensionless SCSS side-effect imports** (`import './chatMenuDropdown.styles'`). The
   plugin claims a relative specifier only when a stylesheet sibling exists AND no JS/TS
   sibling does, so normal resolution is untouched; the resolved `.scss` then hits
   `STORY_LOADERS`' `empty` loader, which is correct because component styles ship via
   `_ds_bundle.css`.
2. **CRA dual-export SVG** (`import { ReactComponent as Icon } from './x.svg'`).
   `STORY_LOADERS` maps `.svg` to `dataurl`, which has no named export. svgr is resolved
   from the REPO's `node_modules` by absolute path — the fork's own `node_modules` symlink
   points at the converter deps, which have no svgr.

`.mp3`/`.wav`/`.ogg` needed no fork — `cfg.storyImports.loaders` covers them
(`soundPlayback.ts` imports an mp3, which reached a dozen chat components).

This took preview build failures from 20+ to **0 of 95**.

## [GENERAL] The provider chain is rebuilt, not bundled

The converter normally bundles `.storybook/preview` and reuses its decorators. Here that
fails — `preview.tsx` imports `src/resources/styles/styles.scss` and the decorator bundler
has no SCSS loader. Without decorators every cell renders context-less and most components
throw.

`.design-sync/preview-providers.tsx` rebuilds the chain (`MemoryRouter` → `Suspense` →
`I18nextProvider` → 11 nested contexts → `ThemeProvider` → `LegalLinksProvider` →
`SessionTypeContext`), is re-exported from `ds-entry.ts` so it ships as a bundle export,
and is wired via `cfg.provider`. Setting `cfg.provider` also makes the converter skip
decorator bundling entirely.

**This is a copy and it can drift.** When `MuiStoryShell`/`withMuiTheme` in
`.storybook/preview.tsx` change, this file must change with them — divergence shows up as
previews that differ from the storybook reference, which the compare loop grades as
mismatches with no obvious cause.

## Re-sync risks

- `.design-sync/preview-providers.tsx` duplicates `.storybook/preview.tsx`'s decorator
  chain. Diff the two whenever previews regress for no other reason.
- The `story-imports` fork must be re-checked against the staged original after a skill or
  converter update — it is a full copy with two plugins appended, so upstream changes to
  the other plugins are NOT inherited.
- `index.d.ts` and `ds-entry.ts` are generated at the repo root / in `.design-sync`; both
  are gitignored and rebuilt by `cfg.buildCmd`.
- The heavy-module exclusion list in `gen-entry.mjs` is hand-maintained. If a component is
  added that pulls matrix-js-sdk, draft-js, tiptap, tone or emoji-picker, the bundle can
  cross the 12 MB upload cap again — re-run `.design-sync/.cache/weigh.mjs` to see the
  per-module closures.

- `.design-sync/ds-entry.ts` is generated. If a new story introduces a component whose module
  is lowercase-named, the generator will not see it — check the
  "NO COMPONENT MODULE" list that `gen-entry.mjs` prints on every run.
- The depth-3 traversal is a bound, not a proof. A component reached only through four hops of
  story scaffolding would silently be missing from the global.
- `node_modules` staleness is invisible until the storybook build fails. Re-run `npm ci`
  whenever the reference build errors on an unresolvable import.
