# Shared loading evidence — issue 1631

Local Storybook only. No backend, deployment or Dev acceptance is claimed.

The latest position proof is in pairs14 and15: the same default loader inside a definite-height block at375×812 and1440×900. Before source: loading PR head f618d111. After source: the additional centering correction in this commit. The combined animation and translated status now occupy the vertical center of the available area. The before views reproduce the user-reported position near the top.

Pair16 verifies placement within the real StageLayout at1440×900. That pane already centered its content when given the app's definite-height container; its Storybook fixture now reproduces that container. The independent vertical reference is the header's lower edge through the host's bottom, not the content element's own height. Both captures retain the centered right pane. No production StageLayout change was necessary.

The existing wait message remains visible because it is already available for all seven shipped locale variants: German, informal German, English, French, Russian, Tigrinya and Turkish. Informal German intentionally inherits the neutral German wording. No duplicate dictionary entry is added. Storybook uses the runtime translations instead of a fixed German label. The live checking story retains its translated context-specific message.

**For developers — regression proof and measurements:**

```text
Matching before capture: desktop/mobile vertical centering failed, right pane passed.
Desktop block center: before154px, after450px; expected450px.
Mobile block center: before128px, after406px; expected406px.
Right pane center: before/after486px; header72px, viewport900px.
Geometric values: loading-centering-bounds.json (subpixel tolerance1px).
Final browser gate:5 files /29 tests PASS, including a bounded flex section, adapter stories and live-entry states.
Focused unit gate:5 files /49 tests PASS (Loading, Spinner, OrbitalTrails, Stage, i18n).
Full ESLint/TypeScript and style gates PASS on the changed source.
Actual i18next language switches verify all7 existing variant messages, then restore the original locale.
Temporary capture code is restored byte-for-byte; no capture shim is committed.
```

The initial pairs01–03 are historical animation replacement proof, from dev aa6ab41d to accepted local source0b3119bb. They predate this position fix. The later isDark correction preserves the legacy Spinner option using the existing neutral palette, with brand color remaining the default.

All images are actual local Chromium Storybook captures. They demonstrate appearance and position; runtime persistence, translations, reduced motion and adapter behavior are covered by tests. They do not establish deployment or Dev acceptance.

## Reproduce

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
npm run build-storybook
npx vitest run --project storybook src/components/app/Loading.stories.tsx src/components/loadingIndicator/LoadingIndicator.stories.ts src/components/loadingSpinner/LoadingSpinner.stories.ts src/components/spinner/Spinner.stories.ts
```
