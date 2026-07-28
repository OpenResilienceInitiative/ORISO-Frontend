# Problem brief

- **Source:** Chat architecture correction; follow-up to
  [ORISO-Frontend#789](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/789)
  and parent epic
  [ORISO-Frontend#302](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/302).
- **Problem:** Current `pre-dev` has removed Rocket.Chat from the product
  runtime, but Storybook still carries a Rocket.Chat/DDP WebSocket mock and an
  obsolete backup configuration with Rocket.Chat providers.
- **Goal:** Keep the entire active frontend repository aligned with the
  Matrix-only target: ORISO frontend, ORISO-controlled MatrixRTC / Element Call,
  and LiveKit.
- **Acceptance criteria:**
    - [x] Storybook contains no Rocket.Chat providers, credentials, identifiers,
          or DDP protocol behavior.
    - [x] The obsolete Storybook backup file is removed.
    - [x] The Matrix-only frontend contract scans Storybook and prevents
          reintroduction.
    - [x] Unit tests, script lint, style lint, and production build pass.
- **Constraints / non-goals:** Preserve the generic LiveService realtime mock;
  no product UI change, deployment, merge, or deployed-runtime claim.
- **Affected area:** `.storybook/preview.tsx`,
  `.storybook/preview.tsx.sb7.bak`,
  `src/matrixOnlyLegacyArtifacts.test.ts`.
- **Open questions:** None.
