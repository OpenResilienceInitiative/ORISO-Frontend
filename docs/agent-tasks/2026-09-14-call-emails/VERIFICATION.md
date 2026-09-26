# Local verification — 2026-09-14

Environment: Node 22.12.0, isolated dev-based checkout.
No deployed browser acceptance, actual media or mail receipt is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 447 files, 4,906 tests |
| `npm run lint:scripts` | PASS |
| `npm run lint:style` | PASS |
| `npm run build` | PASS with dependency/bundle warnings; postbuild host check passed |

Focused email tests passed 11/11, including byte equality for all 54 generated call assets. The cross-repository verifier passed for all 18 native UserService assets and three catalogue entries against companion Draft PR 1152. This does not prove email delivery or recipient selection.

All four local gates passed. Run the
README commands in this checkout; no retained source-directory dependency is
needed. Source inventory is in `SOURCE-FILES.sha256`.

Local full-output fingerprints:

```text
0607c120ebfde8481d869ce2ad215a262080c56219b284e5ce28336a7a7ebf76  unit
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  style
cdced0ebe26609c650101f817bd12ee268b937b074037783daeb637c06de7f72  build
a492f5d400ebd6e16551d42c487aedd12d5a4d0e8dac120a5115b9b81598edaa  binding
```
