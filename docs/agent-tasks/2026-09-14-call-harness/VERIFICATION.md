# Local verification — 2026-09-14

Environment: Node 22.12.0, isolated dev-based checkout.
No deployed browser acceptance, actual media or mail receipt is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 447 files, 4,737 tests |
| `npm run lint:scripts` | PASS |
| `npm run lint:style` | PASS |
| `npm run build` | PASS with dependency/bundle warnings; postbuild host check passed |

The focused existing-widget harness tests passed 4/4, including real-host connecting/active teardown boundaries. This is not proof of real media or deployed call controls.

All four local gates passed. Run the
README commands in this checkout; no retained source-directory dependency is
needed. Source inventory is in `SOURCE-FILES.sha256`.

Local full-output fingerprints:

```text
ec93947a133fbcee80963f0c0e8599b8f48706169c405f4bc9ccd0b9d69d6d2d  unit
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  style
9828310667d781c8b6e982957a3e55b19d621054696c36faf6567dd1b079acb5  build
```
