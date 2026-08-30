# Spike — remaining raw chrome after #1242

## Current behavior

Slices 1–12 dropped one-language `t()` fallbacks. Catalogues for `de`/`en`/`fr`/`ru`/`ti`/`tr` are complete vs German. Production call/form primitives never called `t()`.

## Root cause / gap

Raw JSX / default props / `alert()` / `window.prompt()`, not missing JSON. `leftoversI18n` / `remainingChromeI18n` only listed known files — not a full `src/` walk.

## Approach

Same leftover pattern: source-scan test first, then `t('key')` with no string fallback, keys in every UI locale. Reuse `message.submit.toolbar.*` and `message.thread.*`. New `calls.*` + `form.*`. Extract SessionMenu / GroupChatHeader media-error copy into one helper so the strings are not duplicated.

Skip `legal.modal.*` for dialog defaults — those keys are legal-specific; user asked for `form.dialog.*`.

## Files likely to change

- `src/components/call/FloatingCallWidget.tsx`, `GroupCallWidget.tsx`
- `src/components/matrixCall/MatrixCallView.tsx`, `src/components/videoCall/VideoCall.tsx`
- `src/services/CallManager.ts`, `src/components/sessionMenu/SessionMenu.tsx`, `src/components/sessionHeader/GroupChatHeader/index.tsx`
- `src/components/modal/OrisoDialog.tsx`, `src/components/form/Oriso{Calendar,DatePicker,TimePicker,Select}.tsx`
- `TipTapComposer.tsx`, `EmojiPickerPopup.tsx`, `ThreadListPanel.tsx`
- `DepartmentLegalSection.tsx`, booking iframe titles, `UIVersionToggle.tsx` (config `alert`)
- `src/resources/i18n/{de,en,fr,ru,ti,tr}/common.json`
- `src/components/call/callsFormsI18n.test.ts` (new)

Dead (skip): `FloatingCallWidget.OLD.tsx`, `*.PROFESSIONAL.tsx`. IncomingVideoCall already keyed.

## Risks

- OrisoDialog / form defaults: resolve `t()` in the body (hooks), not default-arg literals.
- Do not strip i18n option objects (`returnObjects`, `lng`, interpolation).
- `i18n.test.ts`: fr/ru/ti/tr missing budget 0; no English parked in those catalogues; no redundant informal overlay.
- KeyBackupRecoveryPrompt mocks OrisoDialog — no update needed.

## Test strategy

Red-green source scan modelled on `remainingChromeI18n.test.ts`. Catalogue presence asserts for `calls.*` / `form.*`. Update any `t: (key, fallback) => fallback` mocks. Then `i18n.test.ts` + `test:unit` + `lint:scripts`.
