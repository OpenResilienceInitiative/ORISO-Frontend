# Local verification — 2026-09-14

Final static/build log fingerprints:

```text
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  style
56a3433a47dd45839192e9f82b94e5697324547400eb017cd708ceed7bf4e702  build
```

Environment: Node 22.12.0, isolated checkout based on dev `31dac29b`.
No deployment, real media, two-account browser acceptance or mail receipt is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 456 files, 4,823 tests |
| `npm run lint:scripts` | PASS on final source |
| `npm run lint:style` | PASS on final source |
| `npm run build` | PASS on final source; postbuild host check passed |

Initial concurrent full-suite runs hit 10-second timeouts in the unchanged
`matrixPasswordRecoveryService.test.ts`. Untouched dev passed 32/32 recovery
tests, and each handoff branch passed the same 32/32 retry without code or
timeout changes. The complete serial rerun above is green. The initial timeouts
are not called a pre-existing product defect.

The real-locale regression first reproduced four missing message.callLifecycle namespaces, then passed after correcting the nesting. Seven resource/fallback tests plus presenter tests passed (21 total); the full i18n guard also passed.

Lint/style/build also passed again after the final locale corrections. Builds
emit existing dependency/bundle warnings; no production readiness is inferred.

Final full-unit log SHA-256: `e10d84cd819d61f359b574509f96341fb783323e53e403e2a8d69270038ef736`.
