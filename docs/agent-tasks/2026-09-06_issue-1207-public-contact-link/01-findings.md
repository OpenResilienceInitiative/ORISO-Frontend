# Issue #1207 — Public contact link: findings and recommendation

**Type:** analysis only. No production code is changed by this task.
**Job (from the annotated report):** _"Analyse why is the public link needed, look please into the
latest ADRs and what epic hold this functionality back."_
**Report headline:** _"PRIO LOW: hide open link contact link"_.

---

## 1. Short answer

| Question                               | Answer                                                                                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why is the public link needed?         | It is the counsellor half of **F12 — QR code & direct link to a counsellor** (epic #181). A counsellor hands one link or QR to a client instead of walking them through zip code and centre selection.                       |
| Why a _named_ link on top of the UUID? | Legibility and trust. The UUID link is printed on cards, posters and QR codes and pasted into e-mail; `?cid=anna-beispiel` survives that context, `?cid=aadc0ecf-c048-4bfc-857d-8c9b2e425500` does not.                      |
| Which ADR decides it?                  | **None.** ADR-014 decides the `cid`/`aid`/`tid` parameters and topic-before-consent. No ADR in the 001–023 series mentions a counsellor slug, an approval step, or a reserved-name list. The slug is shipped but ungoverned. |
| Which epic holds it back?              | **#181 [QDL] QR Code & Direct Link.** QDL-01 (#182) is closed, which is why the block is visible today. QDL-02…QDL-07 (#183–#188) are all open, so the link does not yet deliver the landing experience the epic promises.   |
| Hide it?                               | **No.** Hiding fails the platform's own test in ADR-010. See section 6.                                                                                                                                                      |

---

## 2. What actually ships today

The archaeology comment is right that this is live UI, and the loop is more complete than the
product docs suggest. All three tiers exist:

**Counsellor side — ORISO-Frontend**

- `src/components/profile/ConsultantInformation.tsx:263` renders the _Öffentlicher Kontakt-Link_
  card; `:287` the editable name; `:298` the status line.
- `:186–197` derive the status text from `publicSlugStatus` plus `pendingPublicSlug`. Note the
  fallback: "pending" is shown only when **both** fields are present, and otherwise the card falls
  through to "active" (if `publicSlug` is set) or "empty". Both fields are optional in
  `UserDataInterface` and in the generated contract, so a `PENDING` status arriving without
  `pendingPublicSlug` would silently render as active or empty. A latent display bug, not a
  blocker for this decision.
- `:226` picks the identifier for the shared link: `userData.publicSlug || userData.userId`.
- `:339` and `:365` build the copied link and the QR payload from the same value:
  `${settings.urls.registration}?cid=${consultantIdentifier}`.
- `:26` validates with `/^[a-z]+(-[a-z]+)*$/`.

**Admin side — ORISO-Admin** (this is the part ORISO-Docs does not describe)

- `src/pages/users/Edit/index.tsx:544` renders a _Public contact link_ card on the counsellor edit
  page, `:566` an alert carrying the same four states, and `:573–585` the **Approve link name** /
  **Reject link name** buttons, shown only while a pending name exists.
- Approve writes the pending name into `publicSlug`; reject sets `rejectPendingPublicSlug`.

**Backend — ORISO-UserService**

- `PublicSlugStatus.java`, `ReservedPublicSlug.java` (a `reserved_public_slug` table with
  `slug`, `reason`, `active`, audit columns), plus `publicSlug` on `Consultant`, the repository,
  `ConsultantDataProvider` and the DTO mappers.
- `api/userservice.yaml:823` — `GET /users/consultants/{consultantId}`, `operationId:
getConsultantPublicData`, marked **`[Authorization: none]`**, and the parameter is documented as
  _"Consultant UUID or active public slug"_.

**So the approval loop is real and closed.** Counsellor requests → admin approves or rejects →
the approved name replaces the UUID in the copied link and the QR code. The hint string
_"Neue Namen werden erst nach Freigabe durch eine Administration aktiv"_ is accurate.

---

## 3. What the ADRs say — and do not say

The word _slug_, in the sense of a counsellor vanity name, appears in **no ADR** in the 001–023
series. What exists is adjacent, not governing:

| ADR                                                                         | Relation to this feature                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-014** (shared legal text, multi-topic agencies, topic before consent) | The closest thing to a governing decision. Lines 74–79 fix the invariant that agency + topic must be settled before consent on _every_ registration path, "normal flow and all QDL direct links (`cid`/`aid`/`tid`)", and name the QDL epic. It decides the **parameter**, never the **value format**. A slug is just a different value in `cid`, so ADR-014 neither blesses nor forbids it. |
| **ADR-002** (silent room membership, confidentiality curtain)               | Line 149: counsellor accounts are provisioned through `ConsultantDisplayNameResolver`, "which never uses the real name (US#929)". The platform has an accepted position that a counsellor's real name is not the identifier clients see inside a room.                                                                                                                                       |
| **ADR-010** (per-tenant appearance allowlist)                               | Line 28 states the panel-wide rule `oriso-design-rule-disable-not-hide` **and its only sanctioned exception**. This is the test to apply here.                                                                                                                                                                                                                                               |
| **ADR-020** (scheduled calls)                                               | Line 45: "use one entry composition for QR, copied links, registered users, and guests". Different feature, same direction of travel — one entry surface for QR and copied links.                                                                                                                                                                                                            |
| **ADR-021 / ADR-022**                                                       | Consent gates survive every direct link; nothing in the slug changes that.                                                                                                                                                                                                                                                                                                                   |
| **ADR-023**                                                                 | Träger governance, platform-to-Träger only. The help-seeker "does not appear in this ADR". Does not reach this.                                                                                                                                                                                                                                                                              |

**Conclusion: the decision is not architecturally constrained.** No ADR forbids the slug and none
mandates it. That also means nobody has written down who owns the namespace, who may approve, or
whether a real name is allowed in it — which is the actual documentation gap, not the UI.

---

## 4. The epic that holds it back

**#181 — [QDL] QR Code & Direct Link — UAT (F12 + F13). Open.**

The epic body records that the mechanism already existed and that **the share UI in the profile was
deliberately commented out** in `main`: `// TEMPORARILY HIDDEN — Restore by uncommenting`. Its own
open questions list asks: _"Why is the share UI 'TEMPORARILY HIDDEN' — plain restore vs.
flag-gated?"_

Sub-issue status:

| Task                                                              | Issue | State                 |
| ----------------------------------------------------------------- | ----- | --------------------- |
| QDL-01 Restore the share UI in the profile                        | #182  | **Closed** 2026-07-29 |
| QDL-02 Counsellor link → topic pop-up → direct chat               | #183  | Open                  |
| QDL-03 Centre link → centre-scoped, topic-only inquiry            | #184  | Open                  |
| QDL-04 Direct-link fallbacks (counsellor inactive, centre closed) | #185  | Open                  |
| QDL-05 Backend: assign the `cid` session + expose active state    | #186  | Open                  |
| QDL-06 Admin panel: surface the centre QR + link                  | #187  | Open                  |
| QDL-07 Backend: centre availability signal                        | #188  | Open                  |

**Correction to the epic body.** #181 was written 2026-06-17 and is stale on this point. Verified
against the current code, a `?cid=` link already performs most of QDL-02:

- `registrationSteps.ts:117–137` — once the counsellor resolves, the **zipcode** and
  **agency-selection** steps are dropped outright, and **topic-selection** is dropped as well when
  a topic is preselected or the counsellor has exactly one topic.
- `RegistrationProvider.tsx:247–258` — the counsellor's agency is injected as the direct-link
  agency and `DIRECT_LINK_POSTCODE` stands in for the zip code.
- `Registration.tsx:490–492` — the registration payload carries `consultantId`, but only when the
  counsellor is not `absent`, so a rudimentary form of the QDL-04 absence guard already exists.

So the counsellor **is** preselected and the centre step **is** skipped today. What genuinely
remains open is the rest: the topic step presented as a pop-up in the ADR-014 order, landing the
client directly in the chat, the full inactive-counsellor and closed-centre fallbacks, and the
QDL-05 backend work that assigns the `cid` session and exposes active/inactive state.

The feature is therefore further along than the epic implies, and the gap is the landing
experience rather than the link itself. Anyone reading only #181 would conclude the link does
nothing useful yet, which is no longer true — a plausible source of the "hide it" instinct.

Note that #182's _"Ask first — confirm why the block is TEMPORARILY HIDDEN, plain restore vs.
flag-gated restore"_ was never answered on the issue. The block was restored unflagged. #1207 is
that unanswered question coming back.

---

## 5. Risks worth deciding on (independent of hide/keep)

**5.1 A guessable slug turns a public endpoint into a counsellor directory.** This is the one
finding that could justify restricting the feature, and no ADR covers it.
`GET /service/users/consultants/{id}` is `[Authorization: none]` and returns `firstName`,
`lastName`, `displayName`, `username`, `isSupervisor` and the full agency list (name, city,
postcode, street, phone). Exposing that to someone holding a counsellor's link is deliberate — the
client should see who they are contacting. The slug does not add a field; it changes
**guessability**. A randomly generated UUID is not practically enumerable, assuming the service
issues random identifiers rather than predictable ones. `vorname-nachname` is trivially guessable. With named slugs the same
endpoint answers "does this person counsel here, and at which centre" for any name someone cares to
try, including the supervisor flag. Note the placeholder shipped in the admin panel is literally
`max-mustermann` / `max-musterfrau`, so real names are the expected input.

This sits uneasily beside ADR-002's position that the real name is never the client-facing
identifier, without strictly contradicting it — ADR-002 governs the room, this is registration.
It deserves an explicit decision rather than an inherited default.

**5.2 The pattern rejects German names.** Both validators use `/^[a-z]+(-[a-z]+)*$/` — frontend
`ConsultantInformation.tsx:26`, admin `Edit/index.tsx:551`. No digits, no umlauts, no `ß`. A
counsellor named Müller or Schröder cannot use their own name; they must know to type `mueller`.
The hint says only "lowercase letters and hyphens", which does not explain the rejection. Minor,
but this is a German-language product.

**5.3 The approval flow is undocumented.** It is fully built across Admin and UserService, yet
ORISO-Docs describes only agency live-chat link generation and disabling. There is no record of
which role approves, what the criteria are, what belongs in `reserved_public_slug`, or the expected
turnaround. A counsellor sees "wartet auf Freigabe" with no way to know who is waiting on what.

---

## 6. Recommendation — keep it visible, do not hide it

**Apply the platform's own test.** ADR-010 line 28 defines when hiding is legitimate: the
`disable, don't hide` rule "governs settings a role is entitled to see but not change"; hiding is
the deliberate exception reserved for "a platform-granted capability a non-allowlisted Träger has
no entitlement to and should not be aware of".

A counsellor is unambiguously entitled to their own contact link. It is roadmap functionality
(F12), the backend persists it, and an admin surface exists to approve it. It is not a capability
they should be unaware of. **Hiding therefore fails the ADR-010 test.** The parallel precedent is
the media scanner: `kdg-epic-media-scanner.md:146–148` says that until the feature is live, the
cards should be "disable[d] … with an explanatory hint, or annotate[d] as 'prepared — not yet
active' (design rule: disable, don't hide)".

The reporter's instinct is still worth honouring, though the correction in section 4 changes what
it points at. The block does not overpromise — it says nothing at all about what the link does, so
a counsellor cannot tell whether sharing it is useful yet, and a reader who checks the epic is told
the landing flow is unbuilt when most of it now works. **Fix the silence, not the visibility.**

**Option A — keep visible, make the promise honest (recommended).**
Leave the slug request and approval flow exactly as they are, and add one line stating what the
link verifiably does today: it opens registration with the zip-code and centre steps already
resolved for this counsellor. Do **not** promise that the client lands in a chat with them — that
is the `cid` session assignment in QDL-05 (#186) and it is still open. Copy-only change, no logic,
no migration. It keeps the shipped backend and admin work and does not reopen a question #182
already settled.

**Option B — disable with a hint while #181 is open.**
Grey out the name input behind a tenant flag, keep the card and its explanation visible, using the
`LiveChatAvailability.tsx:58–80` disabled-plus-explanation pattern. This is the literal reading of
`disable, don't hide` and matches the media-scanner precedent. Choose this only if the enumeration
question in 5.1 is judged a real exposure — it is the correct shape for "prepared, not yet
approved for use". Costs a flag and leaves counsellors with a visibly inert control.

**Option C — hide or remove. Not recommended.**
Fails the ADR-010 test, discards working frontend, admin and backend code, silently reverts QDL-01,
and leaves `reserved_public_slug` and the approval endpoints orphaned. If the feature genuinely
should not exist, that is a removal decision for the epic, not a CSS-level hide.

**Recommended: A, plus two follow-ups that are not UI work at all.**

1. **Decide the real-name question (5.1)** and record it. Either accept enumerability as the price
   of a shareable link, or require slugs to avoid full real names and add rate limiting on
   `getConsultantPublicData`. This is the decision that actually matters and it belongs to product.
2. **Write the missing ADR** — an amendment to ADR-014 or a new ADR covering the slug namespace,
   the approving role, reserved names, and the real-name position. Right now a shipped, public,
   tenant-wide identifier namespace has no decision record.

Also worth folding into #181 rather than here: allow `ae/oe/ue/ss` guidance or accept digits in the
pattern (5.2), and document the approval flow in ORISO-Docs (5.3).

---

## 7. What this task deliberately did not do

No production code, no i18n and no styling was changed. Job 4 of the issue — implement the
decision — stays blocked on the product call between options A and B, which is Frank's to make.
Once that call is recorded, the implementation is small and belongs in a follow-up branch.
