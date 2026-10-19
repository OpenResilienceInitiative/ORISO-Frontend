# Issue #1208 — Initial enquiry: follow-ups do not fire; no save-password prompt

**Branch:** `claude/1208/enquiry-followups-password-prompt` (from `upstream/dev` @ `501959f3`)
**Report headline:** _"PRIO URGENT: Erstanfrage sendet"_

## Jobs as written on the annotated screenshot

- **DEBUG 1** — _"client request did not fire correctly after initial request, the system prompts
  on dev, including the emails it did before."_
- **DEBUG 2** — _"client password in browser edge was saved but the browser did not asked the
  client to save the password"_

The screenshot shows an asker on `dev.oriso.org/sessions/user/view/session/34` (v2.0.3) in the
_Anfragephase_. The room contains only the asker's own "hallo" message — no first-steps system
prompts. Raw `[[align:left]]<p>hallo</p>[[/align]]` tokens are visible in the list preview; the
issue states those are tracked in #1191 and are **out of scope here**.

## Acceptance (from the issue)

- [ ] First enquiry produces first-steps system messages and the notification email again
- [ ] Browsers offer to save the password during registration
- [ ] E2E covers the follow-up chain

## Scope note

Job 1 concerns the post-enquiry producer chain (`request.new` → notifications → Carimat
first-steps → email). The issue itself names #851 (pre-created Matrix room bypassing
`request.new`) as the prime suspect, which points at ORISO-UserService rather than this repo.
Job 2 is frontend and is fixed here.
