# Local verification — 2026-09-14

Final static/build log fingerprints:

```text
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  style
921a56f99b92289814e895918548c29d2d076420ca6b656f2503d283302c90cf  build
```

Environment: Node 22.12.0, isolated checkout based on dev `31dac29b`.
No deployment, real media, two-account browser acceptance or mail receipt is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 456 files, 4,800 tests |
| `npm run lint:scripts` | PASS on final source |
| `npm run lint:style` | PASS on final source |
| `npm run build` | PASS on final source; postbuild host check passed |

Initial concurrent full-suite runs hit 10-second timeouts in the unchanged
`matrixPasswordRecoveryService.test.ts`. Untouched dev passed 32/32 recovery
tests, and each handoff branch passed the same 32/32 retry without code or
timeout changes. The complete serial rerun above is green. The initial timeouts
are not called a pre-existing product defect.

The current dev i18n guard caught 36 redundant values in the retained informal overlay. Only those duplicate values were removed; genuine informal wording remains, and the guard passed 37/37.

Lint/style/build also passed again after the final locale corrections. Builds
emit existing dependency/bundle warnings; no production readiness is inferred.

Final full-unit log SHA-256: `f80bf8672f336476ae09debfde2f8b8019c4b8f4ccf2878311293459de3e99d5`.
