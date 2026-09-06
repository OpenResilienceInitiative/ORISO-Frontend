# Job 2 — the browser never offers to save the password

**DEBUG 2 (from the screenshot):** _"client password in browser edge was saved but the browser
did not asked the client to save the password"_

## Root cause

The registration form contract was never the problem. Verified on `dev`:

| What the browser needs                         | State                                                         |
| ---------------------------------------------- | ------------------------------------------------------------- |
| A real `<form>` with a submit handler          | Present — `Registration.tsx:644`                              |
| A submit-type button                           | Present — the register button is `type="submit"` when enabled |
| `autocomplete="username"`                      | Present — `AccountData.tsx:598`                               |
| `autocomplete="new-password"`                  | Present — `AccountData.tsx:675` and `:737`                    |
| A completed submission the browser can observe | **Missing**                                                   |

The last row is the defect. Commit `69e5a231` ("feat: show handover in split stage + **replace
hard reload with client-side nav**", 30 Aug 2026) changed the post-registration redirect from

```ts
window.location.assign(path); // document navigation
```

to

```ts
options.navigate(path); // same-document react-router hop
```

`handleSubmit` calls `e.preventDefault()` and registration goes out as an XHR, so the document
navigation was the only signal telling the browser the submission had succeeded. Once it became a
same-document hop, the submission stayed unconfirmed and no engine offered to save the
credentials. This matches the issue's own diagnosis: _"browsers only offer to save on
recognizable form submission"_.

Two candidates were ruled out along the way:

- `clearAccountDataDraft()` only nulls a module-level variable (`accountDataDraft.ts:33`); it does
  not blank the live inputs before unmount.
- The register button is not an `onClick` handler bypassing submit — it is a genuine
  `type="submit"` inside the form.

## The fix, and why not the obvious one

The obvious fix is `navigator.credentials.store`. **It was deliberately rejected.**
`playwright/credential-saving.crossbrowser.spec.ts` records the decision from #825: the Credential
Management API is Chromium-only, and adopting it _"silently stops working for Safari and Firefox
users while continuing to look correct in a Chromium-based review — the single most likely way
this regresses."_ Issue #1208 asks only for Chromium, but a Chromium-only patch would walk straight
into the trap that spec exists to prevent.

So the fix restores the condition every engine needs: the post-registration hop is a document
navigation again.

```ts
redirectToApp(getPostRegistrationGroupChatId(location.search), { sessionId });
```

`redirectToApp` already falls back to `window.location.assign` when no `navigate` is supplied
(`autoLogin.ts:218`), so this is a one-argument change plus a comment explaining why re-adding
`navigate` would silently break the prompt.

**The welcome animation is unaffected.** `AuthenticatedApp.tsx:83` reads
`POST_REGISTRATION_LOADER_KEY` from `sessionStorage`, which survives a document load.

## Trade-off the client should weigh

`69e5a231` removed that reload so the #1219 stage handover would flow seamlessly into the app.
Restoring the document navigation reintroduces a brief page load at the very end of registration.
That is the price of a save prompt that works in Safari and Firefox as well as Edge. If the
seamless hop matters more than cross-browser credential saving, the alternative is the
Chromium-only API — but that contradicts #825 and should be an explicit decision, not a default.

**Login has the same regression.** The same commit changed `Login.tsx:169` and `:272` to
`redirectToApp(gcid, { navigate })`, so the save prompt is likely missing on sign-in too. That is
outside this issue's scope (job 2 says "during registration") and is left for the client to
schedule.

## Verification

- `autoLogin.test.ts` gains a regression test asserting the document-navigation fallback, named
  and commented for #1208.
- The native save prompt is browser chrome and cannot be asserted by any driver — the same
  limitation `credential-saving.crossbrowser.spec.ts` documents for #825. **Manual check required:**
  register a fresh asker in Chrome or Edge and confirm the save-password bubble appears. I did not
  run this myself: it needs a real registration against a live backend, which creates an account.
