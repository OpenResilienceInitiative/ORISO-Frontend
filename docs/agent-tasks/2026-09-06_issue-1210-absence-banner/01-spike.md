# 01 — Spike (#1210)

## Banner (asker view)

- `src/components/messageSubmitInterface/MessageSubmitInfo.tsx` renders `.messageSubmitInfoWrapper` (headline + message, info/error) for `INFO_TYPES.ABSENT` / `ARCHIVED` / send + attachment errors (`messageSubmitInterfaceComponent.tsx` ~811–834, 1963–1976, 3628).
- `messageSubmitInfo.styles.scss` (legacy Caritas, frozen v7.2): `$dark-grey` full-width strip, centred text, `$light-grey` type, no M3 tokens, no landmark/live region. PR #1313 only made it visible (composer card no longer absolute).
- Reference patterns in the same composer: reply preview (`surface-container` + primary accent bar + 6px radius) and edit preview (`surface-container-high`, 8px radius, `on-surface-variant` label) in `messageSubmitInterface.styles.scss` 2032–2159; composer dock `--composer-max-width: 895px`, centred; mobile navigator `position:absolute; top:-48px` with a 54px `margin-bottom` reservation on the edit bar (2165–2172).
- Story: `Components/Message/MessageSubmitInterface › Asker — counsellor is absent` with a play assertion that the banner sits above the composer.

## Dialog (counsellor "Willkommen zurück!")

- `src/components/app/AbsenceHandler.tsx`: mount-once effect (`[init]`) reads `userData.absent` from `UserDataContext`; rendered in `Routing.tsx` 107–110 only when `hasUserAuthority(CONSULTANT_DEFAULT, userData)`.
- `logout.ts`: clears cookies + web storage, then `window.location.href = toEntry` after **1000 ms**; `UserDataContext` is never reset (`UserDataProvider` has no clear path), so for that second the tree keeps the previous user's `userData`.
- No test/story for `AbsenceHandler`.
- **In-app path found:** `AuthenticatedApp` returns `<Navigate to="/login" replace />` when bootstrap fails (line ~302) — an in-SPA hop to the login route while the global `UserDataProvider` (`globalState/state.tsx`) keeps the previous user's data; `PasswordReset` also calls `logout(false, …)`. The mount-once effect then trusts whatever the context holds.
- **Not reproduced end-to-end** (needs asker credentials). For the dialog to appear after an _asker_ sign-out, consultant `userData` must be present in the context at that moment; the code offers no path for that in a plain asker session. The only plausible in-code path is the 1 s window during logout of a _consultant_ (the tree stays mounted with consultant data) — but the handler is already mounted then and fires only once per mount, so no new dialog. Needs a live reproduction (counsellor sets absence → sign out → sign in as asker → sign out → observe) before any change; a blind context reset on logout risks null dereferences across the still-mounted tree.

## Encryption correlation

- Archaeology: key-backup gap (#1033 via #1178), not absence. Out of scope here.
