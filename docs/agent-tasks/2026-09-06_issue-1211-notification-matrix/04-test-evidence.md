# #1211 — Test evidence

## The bug, reproduced before fixing it

Two tests were added to `src/utils/notificationHelpers.test.ts` describing what
the user-visible behaviour should be. Against the unfixed gate they failed:

```
× honours an opt-in that came from the settings store
  → expected [] to have a length of 1 but got +0
× lets the settings store turn notifications back off
  → expected [ { title: 'Hallo', …(1) } ] to have a length of +0 but got 1
```

The first is the reported defect: a user opts in through the only notifications
panel they can reach, and nothing is ever delivered.

After the fix, all 13 in that file pass.

## Two pre-existing tests were passing for the wrong reason

`persistent banner mode sets requireInteraction` and `banner channel off for the
event row suppresses the OS popup` both opted in by writing
`localStorage.BROWSER_NOTIFICATIONS` directly, bypassing
`saveBrowserNotificationsSettings`. Once the gate stopped reading localStorage,
the first failed and the second would have passed vacuously — it would have been
stopped by the opt-in gate before ever reaching the banner gate it claims to
test. Both now opt in through the real writer.

## Commands

| Command                                                           | Result                     |
| ----------------------------------------------------------------- | -------------------------- |
| `vitest run --project unit src/utils/notificationHelpers.test.ts` | 13 passed                  |
| `vitest run --project unit src/utils/notificationSettings`        | 59 passed (with the above) |
| `vitest run --project unit` (full)                                | 4044 passed, 3 failed      |
| `npm run lint:scripts` (`eslint src --max-warnings=0 && tsc`)     | clean                      |

### About those 3 full-suite failures

They are pre-existing on `dev` and unrelated to this change. Verified by
stashing every change in this branch and re-running the same three files on
clean `dev`, where they fail identically:

- `src/utils/noCaritasLegacy.test.ts` — partner marks / tenant-controlled list
- `src/components/animatedIllustration/AnimatedIllustration.test.tsx` — "is the
  only component that talks to lottie-react"
- `src/utils/theme/callTheme.test.ts` — checked-in artefact vs engine

Worth its own ticket; `dev` is red on them today.

## Live state captured from a signed-in consultant session

Read out of a real session (consultant "Bruno Banks", local dev against
`dev.oriso.org`) before the fix:

```json
{
	"permission": "denied",
	"legacyKey": null,
	"browserNotifications": { "enabled": false, "showMessagePreview": false }
}
```

`legacyKey: null` is root cause B in the wild — the key the gate read had never
been written, because the panel that writes it is not routed while
`enableNewNotifications` is on.

The same read-out shows every `sound` at `"none"` across all three areas, with
`call` the only `"ring"` — root cause A, matching the code defaults exactly.

## What is NOT verified here

The per-event live column of the matrix (job 2: trigger each event on Pre-Dev
with two accounts and record in-app / sound / email) has **not** been executed.
The local environment reached the API but the session needed for two-account
event triggering was not available in this run, and email delivery cannot be
observed from the frontend at all.

The matrix in [01-spike.md](01-spike.md) is therefore derived from the code and
marked as such. The reviewer test plan on the PR walks each row so the observed
column can be filled in on Pre-Dev.
