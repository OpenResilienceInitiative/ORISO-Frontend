# Add To Calendar (`.ics` export)

## Summary

- Replace the hand-rolled, string-parsing iCalendar generation behind the
  "Add to calendar" action with a pure, unit-tested helper.
- The old code produced invalid `VEVENT` output (missing `UID`/`DTSTAMP`,
  broken `DURATION`, unescaped text, a malformed `data:` URI, deprecated
  `escape()`), and re-parsed already-formatted, locale-dependent display
  strings.
- Success: a valid `.ics` file downloads from both entry points (appointment
  chat messages and the bookings list), with correct start/end, escaping and
  timezone handling, covered by unit tests.

## Current State

- `src/components/downloadICSFile/downloadICSFile.tsx` builds ICS text by
  concatenation and parses display strings such as `"14:00 - 15:00"`.
- `src/utils/downloadICSFile.ts` is a near-duplicate download helper.
- Two entry points render `DownloadICSFile`:
    - `src/components/message/Appointment.tsx` (has raw ISO date + duration in
      minutes).
    - `src/containers/bookings/components/Event/event.tsx` (only had display
      strings; `transformBookingData` discarded the raw `startTime`/`endTime`).
- No calendar dependency and no unit-test runner were wired up (vitest was a
  declared dependency with a broken `test:unit` script and no config).

## Proposed Changes

- Add `src/utils/appointmentIcs.ts`: a pure `buildAppointmentIcs()` that takes
  raw timestamps (`Date` / ISO string / epoch ms), a title and optional
  description/location/uid, and returns RFC 5545 output — `UID`, `DTSTAMP`,
  UTC `DTSTART`/`DTEND`, RFC 5545 §3.3.11 text escaping, and 75-octet line
  folding. No framework/DOM imports so it is unit-testable in isolation.
- Fix `src/utils/downloadICSFile.ts`: `Blob` download, `text/calendar;
charset=utf-8`, filename sanitization (drops the deprecated `escape()` and
  the malformed `data:` URI).
- Rework `DownloadICSFile` to accept structured props and delegate to the
  helper; remove the string parsing.
- Carry raw `startTime`/`endTime` through `BookingEventUiInterface` and
  `transformBookingData` so the bookings entry point exports real timestamps.
- Wire vitest: `vitest.config.ts` + a working `test:unit` script.

## Testing

- `npm run test:unit` — unit tests for `buildAppointmentIcs` (envelope,
  UTC timestamps, duration vs. explicit end, escaping, folding, uid
  generation, validation errors).
- `tsc --noEmit` passes project-wide.
- Component/e2e coverage stays in Cypress (`cypress/e2e/appointments.cy.ts`).

## Risks / Assumptions

- Assumes `Appointment` message `date` and booking `startTime`/`endTime` are
  parseable by `new Date()` (already relied upon elsewhere in the app).
- `DTSTART`/`DTEND` are emitted as UTC instants; calendar clients localize.
- The download helper still relies on the browser `Blob`/anchor pattern;
  mobile Safari behavior is improved over the old `data:` URI but not
  separately e2e-tested here.

## Acceptance Checklist

- [x] Implementation approach is clear
- [x] Affected areas are identified
- [x] Testing expectations are explicit
- [x] Risks and assumptions are documented
- [x] Another engineer could implement this without inventing missing decisions
