# Local verification — 2026-09-14

Environment: Node 22.12.0, isolated dev-based checkout. No backend or browser
acceptance is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 446 files, 4,736 tests |
| `npm run lint:scripts` | PASS |
| `npm run lint:style` | PASS |
| `npm run build` | PASS with dependency/bundle warnings; postbuild host check passed |

The full suite includes the notification feed regression tests. This does not
prove the separate appointment event-production or real-time integration work.

Local full-output fingerprints:
```text
eaf94bc1c8f2177342458e0acd1a37431899243912e147b75b1a62fd54847b86  unit
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  style
d0168bd366cf28a3ef557b7e1b9a8b6afeeeee108ada36d642a9a1c18a407831  build
```

Rerun the README commands on the reviewer's machine. Source inventory is in
`SOURCE-FILES.sha256`; local checks and deployed acceptance remain separate.
