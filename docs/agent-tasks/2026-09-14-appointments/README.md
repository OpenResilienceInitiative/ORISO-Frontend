# Appointment message boundary corrections

Owner for completion and publication: **Shazia (@shazia-k)**.
Refs https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/477 (partial delivery; does not close the issue).

## What is included

Validates appointment payloads and date/time rendering at the existing message-card boundary. This is not a booking implementation.

Base: `dev@31dac29bb8a840f94a94cd9c13de74877de1061b`.
Source: retained `fix/call-lifecycle-timeline-780@aebc29ca` plus its local changes, transferred into this independent dev-based branch. No local source-directory dependency is required. See `SOURCE-FILES.sha256` for the complete package inventory. Foreign IconCatalog changes were excluded.

## Start here

Use Node 22 (the package's current engine requirement). From this checkout:

```bash
npm ci --legacy-peer-deps
npx vitest run --project unit src/components/message/Appointment.test.tsx src/components/message/Appointment.timezone.test.tsx
TZ=Europe/Berlin npx vitest run --project unit src/components/message/Appointment.timezone.test.tsx
TZ=UTC npx vitest run --project unit src/components/message/Appointment.timezone.test.tsx
```

Full repository gates:

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
```

## Still open

Booking implementation is explicitly deferred. Backend appointment event/update contract remains separate. Browser and cross-timezone acceptance remain open.

The appointment renderer source can enter review after current checks pass. Backend booking and real browser acceptance remain open. No merge or deployment is part of this handoff. Shazia should review this partial slice and complete the missing integration acceptance. Local tests, independent review, deployment, browser proof and mail receipt are separate evidence states.

## Evidence

Fresh per-branch verification is recorded in `VERIFICATION.md`. Earlier retained-source test counts are not presented as fresh results. Dependency cache was copied locally only after verifying package-lock SHA-256 equality; the install command above is the portable setup.

## Fresh Dev reintegration — 2026-10-06

Merged Dev `9ec1b655c6973d26d7fbc0bc5a319fe26793a9c6`. Appointment payloads must identify an ISO instant using UTC Z or an explicit offset; timezone-free dates are rejected without guessing the sender’s timezone. Current frontend alias fixtures use Z/toISOString; the legacy apiAppointmentServiceSet helper has no callers. The backend appointment schema documents ISO8601UTC. Valid Z and offset inputs retain their exact calendar payload and render correctly across UTC/Berlin, summer/winter and DST transitions. Backend writer and real deployed acceptance remain separate.
