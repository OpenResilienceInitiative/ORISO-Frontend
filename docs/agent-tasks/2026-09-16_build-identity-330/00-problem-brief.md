# Build identity — Frontend 1420

Source: [Helm 330](https://github.com/OpenResilienceInitiative/ORISO-Helm/issues/330), [shared plan](../../../../0%20-%20Docs/artifacts/oriso-autodev-20260915/plan-330.md).

The runtime release label can remain unchanged after an image swap. Bug reports need the actual bundle commit beside it.

Goal: both public and authenticated footers identify the bundle independently of runtime configuration.

- [x] CI injects the actual checkout full commit.
- [x] Both footer locations share formatting and expose the full commit.
- [x] Runtime overrides cannot replace baked identity; an absent or malformed commit renders as unknown only when a release is present, while missing both release and commit returns `null`.
- [x] Focused tests, full unit/script lint/style lint/build checks are recorded.
- [ ] Root supplies browser evidence and separate review.

No release choice, deployment, authentication changes, redesign, or external writes. No implementation-blocking questions. Operator release/PreDev gates remain open.

## Bounded F1/F2 follow-up

The coordinator proved that the public identity is hidden below 900px and has insufficient contrast over the desktop stage. Make only the identity readable across the existing layouts; preserve legal/navigation choices, fixed-button clearance and authenticated on-surface color. Rendered acceptance remains open because this session cannot launch a browser. See ART/implementation-330-responsive.md.
