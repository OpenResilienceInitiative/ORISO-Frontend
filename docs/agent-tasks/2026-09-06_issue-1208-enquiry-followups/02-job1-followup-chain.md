# Job 1 — the post-enquiry follow-ups no longer fire

**DEBUG 1 (from the screenshot):** _"client request did not fire correctly after initial request,
the system prompts on dev, including the emails it did before."_

**Result: this is not a frontend bug.** The producer and the renderer in this repo are both correct
and pinned by tests. The break is in ORISO-UserService and ORISO-Helm. Nothing in ORISO-Frontend
can restore either symptom, so no production code is changed for job 1 on this branch.

---

## 1. The chain, end to end

`POST /users/sessions/{id}/enquiry/new` → `UserController:246` →
`UserRegistrationControllerDelegate:177` → `CreateEnquiryMessageFacade.createEnquiryMessage:55`.

All three follow-ups fire from one method, `createMatrixEnquiryMessage:70–99`, in order:

| Step                       | Line  | Produces                                                  |
| -------------------------- | ----- | --------------------------------------------------------- |
| `updateMatrixSession`      | `:91` | sets `status = NEW`, `enquiryMessageDate = now`           |
| `sendEnquiryNotifications` | `:92` | the counsellor e-mail, then `request.new`                 |
| `postErstantwort`          | `:93` | the Carimat first-steps event + `first_response.received` |

There is no message broker involved. `request.new` is a row in `event_notification`.

## 2. The issue's prime suspect is already fixed

The issue names #851 — the pre-created Matrix room bypassing `request.new`. That regression was
real and it was in **this** repo, not the backend:

- **Broke it:** `d365867a` (2026-07-08) added `hasMatrixRoom` to `isAskerEnquirySubmission` with
  `!hasMatrixRoom` as a condition. Once registration pre-created the room, the composer classified
  the _first_ message as a follow-up, sent it straight through Matrix, and never called the enquiry
  endpoint — so the e-mail, `request.new` and the Erstantwort all died silently.
- **Fixed it:** `a246151d` (2026-08-01) replaced that with
  `hasEnquiryMessage: Boolean(activeSession.item?.messageDate)`.

I verified `a246151d` is an ancestor of `upstream/dev` and shipped in v2.0.2 onward, so it is in the
v2.0.3 the screenshot shows. `hasMatrixRoom` no longer appears anywhere in the enquiry transport.

The current guard is sound, and I confirmed the reason independently: `messageDate` maps from
`session.enquiryMessageDate` (`SessionMapper:72`), and `setEnquiryMessageDate` is called from
exactly one place — `CreateEnquiryMessageFacade:290`. The pre-created holding room
(`AgencyPreAssignmentRoomService:110`) sets only `matrixRoomId`, so it cannot pre-arm the guard.

The behaviour is pinned by `messageEncryptionMode.test.ts`, which already covers the exact case:
_"classifies the first message as an enquiry even when registration pre-created a Matrix room"_ and
_"dispatches the first message to the enquiry endpoint exactly once even with a Matrix room"_.

## 3. What is actually broken

### (a) The mail service is configured but never deployed — verified

`ORISO-Helm/templates/userservice/userservice-configmap-env.yaml` sets

```
MAIL_SERVICE_API_URL:       "http://mailservice.{{ .Release.Namespace }}:8080"
MAIL_SERVICE_API_MAILS_SEND:"http://mailservice.{{ .Release.Namespace }}:8080/mails/send"
```

but **there is no mailservice in the chart** — no `templates/mailservice/`, no subchart. Those two
lines are the only occurrences of the string in the whole repository, and `templates/` contains
admin, agencyservice, consultingtypeservice, element-call, frontend, keycloak, matrix, nginx,
tenantservice and userservice, and nothing else.

`MailService.sendEmailNotification` catches and swallows every exception, so the userservice logs a
warning and carries on. **On its own this fully explains the missing e-mails.**

### (b) A nullable Boolean is unboxed in the notification path — verified

`CreateEnquiryMessageFacade:159`

```java
if (session.getIsConsultantDirectlySet()) {
```

`Session:175` declares `private Boolean isConsultantDirectlySet;`. Two other call sites guard it
properly — `AgencyPreAssignmentRoomService:142` and `Messenger:175` both use
`Boolean.TRUE.equals(...)`. This one does not.

Why it matters: a null unboxes to a `NullPointerException`, which is **not** caught by
`createEnquiryMessage`'s `catch (CreateEnquiryException)` at `:64`. The request 500s _after_
`:91` already persisted `enquiryMessageDate`. The result is no e-mail, no `request.new` and no
Erstantwort **together**, and every retry then hits the 409 in
`checkIfEnquiryMessageIsAlreadyWrittenForSession`. That single-fault-kills-all-three shape matches
the report better than anything else found.

The column is `nullable = false` with a default, and the normal registration path writes `false`
(`SessionService:242`), so this needs a legacy or alternate-path row to fire. It is a latent defect
either way and the one-line fix is to match the other two call sites.

### (c) Erstantwort silent-skip points

Every failure in `postErstantwort` is log-and-continue: a blank room id, an unavailable token, a
Matrix error, and a blanket `catch (RuntimeException)` at `:217`. `buildFirstResponseBody`
returning null also returns silently. So a broken Erstantwort produces no user-visible signal at
all — which is consistent with "it just stopped".

Worth checking on dev: the Erstantwort is posted as a **plaintext** `m.room.message` while the
frontend requires that room to be end-to-end encrypted (`assertMatrixRoomEncrypted` in the
composer). If the room is encrypted, a plaintext post may be rejected or unrenderable.

### (d) A `@Transactional` annotation has drifted onto the wrong method

In `EventNotificationService`, the javadoc at `:175–184` describes
`createNewClientRequestNotifications`, but the `@Transactional` at `:185` is followed by a _second_
javadoc and therefore annotates `createFirstResponseNotification` at `:205` instead.
`createNewClientRequestNotifications` at `:249` is the only event producer in that class without
it. Saves still succeed through Spring Data's own repository transaction, so this is not a proven
break — but it is unambiguous evidence of a bad merge in the `request.new` producer and should be
tidied.

## 4. How to confirm in five minutes

On dev, for the session in the screenshot:

```sql
SELECT enquiry_message_date, is_consultant_directly_set FROM session WHERE id = 34;
```

- `enquiry_message_date` **NULL** → the endpoint never completed. Look for a 500 before
  `updateMatrixSession`.
- `enquiry_message_date` **set** → the endpoint ran and the break is downstream, i.e. the missing
  mailservice and the Erstantwort post.

Log lines to grep in the userservice:

```
Could not post the Erstantwort for session 34
CreateEnquiryMessageFacade error
MailServiceHelper error
```

## 5. Where the fixes belong

| Finding                      | Repo              | Shape of fix                                                |
| ---------------------------- | ----------------- | ----------------------------------------------------------- |
| (a) mailservice absent       | ORISO-Helm        | deploy the service, or point the URLs at the real one       |
| (b) nullable unboxing        | ORISO-UserService | `Boolean.TRUE.equals(session.getIsConsultantDirectlySet())` |
| (c) silent Erstantwort skips | ORISO-UserService | raise the log level and decide plaintext vs encrypted       |
| (d) `@Transactional` drift   | ORISO-UserService | move the annotation back onto its method                    |

## 6. The E2E acceptance item

_"E2E covers the follow-up chain"_ cannot be satisfied from this repo alone: the chain's observable
outputs are a database row and an e-mail, neither reachable from a browser test. The frontend half
— that a first asker message goes to the enquiry endpoint and a follow-up does not — is **already**
covered at unit level by `messageEncryptionMode.test.ts`, including the pre-created-room case that
caused #851. Adding a browser test that re-asserts the same branch would be duplication.

A genuine end-to-end check belongs in the backend test suite, asserting that one call to
`/enquiry/new` produces an `event_notification` row of type `request.new`, a `FIRST_RESPONSE`
Matrix event, and one queued mail. I have left the acceptance box unticked rather than tick it with
a frontend test that does not cover the chain.
