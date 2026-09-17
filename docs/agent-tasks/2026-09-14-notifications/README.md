# Atomic notification feed read state

Owner for completion and publication: **Shazia (@shazia-k)**.
Refs https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/779 (partial delivery; does not close the issue).

## What is included

Moves feed items and unread count into one reducer so repeated mark-read actions cannot decrement the count twice.

Base: `dev@31dac29bb8a840f94a94cd9c13de74877de1061b`.
Source: retained `fix/call-lifecycle-timeline-780@aebc29ca` plus its local changes, transferred into this independent dev-based branch. No local source-directory dependency is required. See `SOURCE-FILES.sha256` for the complete package inventory. Foreign IconCatalog changes were excluded.

## Start here

Use Node 22 (the package's current engine requirement). From this checkout:

```bash
npm ci --legacy-peer-deps
npx vitest run --project unit src/globalState/provider/NotificationsProvider.test.tsx
```

Full repository gates:

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
```

## Still open

This fixes only local feed/read state. Appointment event production and transport integration are not provided by this patch.

Keep this PR draft until integration and required checks are resolved. No merge or deployment is part of this handoff. Shazia should review the source, complete the explicitly missing behavior, rerun local tests, then decide when to request final review. Local tests, independent review, deployment, browser proof and mail receipt are separate evidence states.

## Evidence

Fresh per-branch verification is recorded in `VERIFICATION.md`. Earlier retained-source test counts are not presented as fresh results. Dependency cache was copied locally only after verifying package-lock SHA-256 equality; the install command above is the portable setup.
