# Source slice

Prepared source preflight is linked from the shared plan in the brief. Existing `config/env.js` passes REACT_APP variables through Webpack DefinePlugin. `runtimeConfig.ts` resolves runtime values first; the new commit accessor must bypass that path. StageLayout uses Text; AuthenticatedApp uses a div. Retain these renderers/classes in one small shared component.

Risk: an unset variable must still be replaced at build time. Add an explicit empty build-commit default to env.js; validate full lowercase 40-character SHA in the accessor. Release stays runtime-configurable.

Tests: StageLayout visible readback first (behavioral RED), then shared footer rendering and runtime spoof/invalid input coverage. Inspect two real production builds with independent fixture commits at the same release.
