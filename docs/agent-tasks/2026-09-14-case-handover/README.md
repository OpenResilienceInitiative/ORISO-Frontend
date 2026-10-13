# Recipient-first Case Handover frontend

Owner for completion and publication: **Shazia (@shazia-k)**.
Refs https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1262 (partial delivery; does not close the issue).

## What is included

Transfers the retained sender, recipient offer gate, PULL/batch idempotency and request-scoped refresh code, including the existing Storybook SupervisorDialog presenter. Current dev session rail/recovery changes are preserved.

Base: `dev@31dac29bb8a840f94a94cd9c13de74877de1061b`.
Source: retained `fix/call-lifecycle-timeline-780@aebc29ca` plus its local changes, transferred into this independent dev-based branch. No local source-directory dependency is required. See `SOURCE-FILES.sha256` for the complete package inventory. Foreign IconCatalog changes were excluded.

## Start here

Use Node 22 (the package's current engine requirement). From this checkout:

```bash
npm ci --legacy-peer-deps
npx vitest run --project unit src/api/apiCaseHandover.test.ts src/components/askerInfo/AskerInfoAssign.test.tsx src/components/askerInfo/AskerInfoAssign.integration.test.tsx src/components/session/CaseHandoverOfferGate.test.tsx src/components/session/CaseHandoverCurtain.test.tsx src/components/session/SessionStream.test.tsx src/components/session/SessionView.test.tsx src/components/sessionsList/useCaseHandoverBatch.test.ts src/components/sessionsList/SessionsList.test.tsx
```

Full repository gates:

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
```

## Still open

Companion backend Draft PR: https://github.com/OpenResilienceInitiative/ORISO-UserService/pull/1151. Check its current CI and remaining-work section before integrating; this link is not a merge or readiness claim.

Requires the companion UserService recipient-offer/ownership handoff. PR 1148 is separate overlapping policy/co-access work: reconcile its final contract before integrating both. Effective per-reason policy, standing preference, co-access expiry/reclaim, audit and anonymous-choice decisions are not completed here. Browser and two-account acceptance remain deferred.

Keep this PR draft until integration and required checks are resolved. No merge or deployment is part of this handoff. Shazia should review the source, complete the explicitly missing behavior, rerun local tests, then decide when to request final review. Local tests, independent review, deployment, browser proof and mail receipt are separate evidence states.

## Evidence

Fresh per-branch verification is recorded in `VERIFICATION.md`. Earlier retained-source test counts are not presented as fresh results. Dependency cache was copied locally only after verifying package-lock SHA-256 equality; the install command above is the portable setup.
