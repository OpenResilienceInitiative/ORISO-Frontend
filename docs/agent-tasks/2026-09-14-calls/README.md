# Call lifecycle and timeline

Owner for completion and publication: **Shazia (@shazia-k)**.
Refs https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/780 (partial delivery; does not close the issue).

## What is included

Retained call runtime repairs and durable timeline rendering, using the shared system-message presentation. Preserves the current dev team-channel and recovery changes.

Base: `dev@31dac29bb8a840f94a94cd9c13de74877de1061b`.
Source: retained `fix/call-lifecycle-timeline-780@aebc29ca` plus its local changes, transferred into this independent dev-based branch. No local source-directory dependency is required. See `SOURCE-FILES.sha256` for the complete package inventory. Foreign IconCatalog changes were excluded.

## Start here

Use Node 22 (the package's current engine requirement). From this checkout:

```bash
npm ci --legacy-peer-deps
npx vitest run --project unit src/api/apiCallState.test.ts src/components/message/CallTimelineMessage.test.tsx src/components/message/CallTimelineSystemMessage.test.tsx src/components/message/MessageItemComponent.callLifecycle.test.tsx src/components/message/useCallTimelineState.test.tsx src/services/CallManager.timeline.test.ts src/services/CallManager.startRace.test.ts src/utils/callLifecycleMessage.test.ts
```

Full repository gates:

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
```

## Still open

Companion backend Draft PR: https://github.com/OpenResilienceInitiative/ORISO-UserService/pull/1153. Check its current CI and remaining-work section before integrating; this link is not a merge or readiness claim.

Requires the companion UserService call-lifecycle handoff for server-authoritative call state. Real two-account calls, reload/rejoin, media and browser screenshots remain unverified.

Existing open PRs checked on 2026-09-14: PR 1350 (`5f0b17d7`) changes the iframe host hook and is not copied here. PR 1389 (`b531cb2e`) also touches `MessageItemComponent.tsx`: preserve its enquiry-team message context when integrating both. Neither open PR is represented as merged or included in this branch.

Keep this PR draft until integration and required checks are resolved. No merge or deployment is part of this handoff. Shazia should review the source, complete the explicitly missing behavior, rerun local tests, then decide when to request final review. Local tests, independent review, deployment, browser proof and mail receipt are separate evidence states.

## Evidence

Fresh per-branch verification is recorded in `VERIFICATION.md`. Earlier retained-source test counts are not presented as fresh results. Dependency cache was copied locally only after verifying package-lock SHA-256 equality; the install command above is the portable setup.
