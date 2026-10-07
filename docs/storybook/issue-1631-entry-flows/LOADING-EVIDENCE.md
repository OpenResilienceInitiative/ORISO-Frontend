# Shared loading evidence — issue 1631

Local Storybook only. No backend, deployment or Dev acceptance is claimed.

The numbered pairs show the same global Loading consumer at 375/1440 and the same legacy Spinner story at 1440. Before source: dev aa6ab41d. After source: accepted integrated local revision 0b3119bb; the loading package starts from its 16 loading-related files. Images are real Chromium Storybook captures; they are not generated illustrations.

The later `isDark` compatibility correction preserves the legacy Spinner option by selecting the existing neutral orbital palette. The default stays brand-colored. The focused unit regression covers both options; the captures above predate this correction.

The existing global loading surface previously showed a small moving dot and hid itself after a fixed timer. It now presents the shared orbital animation, a translated status, and remains visible for the active operation. Legacy consumers reuse it.

Capture checks: 6 selected before stories PASS; 9 selected after stories PASS across loading, live and registration. Initial after attempts were interrupted by Vite dependency optimisation before/while setting up the runner; the final unchanged after run passed. Original source overlay restored byte-for-byte. No capture shim is committed.

## Reproduce

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
npm run build-storybook
npx vitest run --project storybook src/components/app/Loading.stories.tsx src/components/loadingIndicator/LoadingIndicator.stories.ts src/components/loadingSpinner/LoadingSpinner.stories.ts src/components/spinner/Spinner.stories.ts
```
