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

## Fresh Dev checks — 2026-10-06

TargetDev `9ec1b655c6973d26d7fbc0bc5a319fe26793a9c6`, Node22.12.0. Three regression cases first fail for ambiguous timezone-free/date-only/locale-specific input. Fresh focused UTC suites:3files53tests pass with6 Berlin-specific skips; Berlin suites:3files57tests pass with2 UTC-specific skips. These cover Z and explicit+02:00 calendar payloads, DST/midnight and30 ICS tests. September full-suite counts above are historical. Current-head CI, backend and real browser acceptance remain separate gates.

Fresh full unit suite:607 suites pass,1 timezone-only suite skipped;10979 tests pass,8 timezone-specific tests skipped in the default environment. All8 skipped cases are exercised by the explicit UTC and Berlin runs above. Fresh fullESLint+TypeScript, style, productionbuild andpostbuild hostvalidation pass. No backend/browser acceptance is claimed.
