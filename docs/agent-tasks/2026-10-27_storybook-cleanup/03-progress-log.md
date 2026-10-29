# Progress

### Iteration 1 — pass

- Target: remove the duplicate create-chat card while retaining toolbar creation.
- Evidence: real-browser play check failed on `.createChatItem` in the original
  composition, then passed after the unused card/source/story/styles were removed.
- Verify: focused `SessionListColumn` story, 1 passed, 4 deselected.
- Retired password stories were removed as explicitly requested; the active
  reset-email route was preserved. No equivalent redesigned recovery dialog was
  found; a reporter reference remains open.

### Iteration 2 — pass for layout; accessibility gate remains open

- Target: desktop vertical navigation and full-width mobile navigation.
- Evidence: new mobile geometry check failed with 85px navigation against a
  375px viewport. Shared required app scope and responsive composition fix it.
- Independent review found global story style selectors could collide in Docs;
  inline per-instance CSS variables now prevent that collision. The independent
  reviewer rechecked the correction and returned COVERED.
- Accessibility/fixture failures also occur on the original navigation stories;
  no audit suppression or live API workaround is part of this change.

### Repository checks

- Full unit suite: 838 files / 14,523 tests passed; 1 file / 8 tests skipped.
- Script lint including TypeScript: passed.
- Style lint: passed.
- App build and deployment-host guard: passed, existing build warnings retained.
- Storybook typecheck: passed.
- Local Storybook index: retired entries absent; retained creation/navigation
  story IDs and linked canonical variants present.

Full icon and unused-story inventory is in `icon-and-legacy-audit.md`.

### Follow-up — find the existing password module in the component library

- The user approved the interactive proposal but asked to reuse the existing
  frontend module and retire the old Storybook reference.
- Hosted Dev confirms the existing AccountSetupGate renders PasswordReset's
  dialog variant with current/new/repeat password and a required second-factor
  step. The optional SaveCredentialsCard currently opens security settings.
- Move the real gate into `Components/Dialog/Account setup`, preserving all
  `organisms-accountsetupgate--*` IDs and nine existing examples. Its Docs link
  the canonical optional credentials-message story and explain their different
  runtime contracts. No authentication behavior changes.
- The optional two-field popup remains unmatched after source/local/history
  archaeology. This reclassification does not claim that integration is done.
- All nine gate stories fail the same accessibility/fixture gates both before
  and after this metadata change. Keep those failures visible.

## 2026-10-28 — correct the misleading chat in our own evidence

- Source resolved to PR1867's screenshots; asking Frank for another URL was unnecessary.
- Confirmed stale handwritten chat in the old desktop baseline and mobile wrapping
  introduced into view by the responsive story shell. Navigation-only validation
  missed the chat fidelity problem.
- Replaced duplicated renderer/fallback with production header,timeline,composer
  and ChatStage composition. Added regression assertions and a repeatable capture script.
- Local unit/lint/build/typecheck and independent review pass; strict Storybook
  accessibility remains red. Keep the draft review boundary and no deployment claim.
