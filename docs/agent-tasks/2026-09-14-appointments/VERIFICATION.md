# Local verification — 2026-09-14

Environment: Node 22.12.0, isolated checkout based on dev `31dac29b`.
No backend, deployment or browser acceptance is claimed.

| Command | Result |
|---|---|
| `npm run test:unit` | PASS: 447 files passed, 1 skipped; 4,751 tests passed, 6 skipped |
| `npm run lint:scripts` | PASS |
| `npm run lint:style` | PASS |
| `npm run build` | PASS with dependency/bundle warnings; postbuild hardcoded-host check passed |

The full suite ran the appointment payload tests. Its six timezone cases were
explicitly rerun with their required environments: `TZ=Europe/Berlin` passed all
five Berlin/DST/midnight cases; `TZ=UTC` passed the remaining UTC case. The other
timezone's cases are intentionally skipped in each respective process.
No new booking feature or appointment backend contract was implemented.

Local full-output SHA-256 fingerprints (retained by the publishing agent):

```text
6fc8f26bacca1fb3f8b7d93c7b46e2e1eb35d26d2c7e812ca2d076f746cadd1a  unit
e8613f176c3df6f547095fd406df3d89f38298fccb36ff2fbd86433ecc901378  lint-scripts
16a82831bf01d7c6ee54330f536545a677ab1f09278d8b8966ff79b872659fde  lint-style
a2c513345185f6925523a6fd8778244f10894b068a2253ab1b3606b30b7a7642  build
```

Run the commands from README on your machine. Fingerprints identify this run;
they do not substitute for rerunning the tests or for the deferred integrated
phone/desktop and two-account browser acceptance.
