# Call v2 — what was built, and what was deliberately not

Written after the work, against what the plan said. Where the plan was
wrong, this says so rather than quietly agreeing with itself.

---

## The three decisions, as they turned out

**1. The design components move into the fork.** Mostly. The arrangements,
the form, the engine, the palette, the backdrop and the view switcher are
in `oriso-elementcall` now. The **notepad is not**, and that is a change of
plan with a reason: its whole feature is that nothing it holds ever leaves
the device, and its test proves that against fetch, XHR, both storages and
`sendBeacon`. Inside the iframe the same claim would have to be re-made
against the widget transport, and the panel would have to carry copies of
five ORISO icons and the composer's menu with it. It is docked beside the
call surface in the host, which is where the handoff draws it.

**2. The new design replaces everything, video included.** Built, and
measured rather than assumed — see §4.

**3. Two pull requests under one epic.** Prepared; see `03-pull-requests.md`.

---

## 1. What the plan got wrong

### The identity transport does not fit in the MatrixRTC membership

The plan recommended option A: each client publishes its identity in its
`org.matrix.msc3401.call.member` state event. That is not implementable
without patching matrix-js-sdk. `MembershipManager.makeMyMembership` is
`protected` and builds its content from a fixed object literal, and
`joinRoomSession` constructs the manager internally — there is no
`joinConfig` hook for an extra field.

**What was built instead:** a dedicated room state event,
`org.oriso.call.identity`, state key the user id, written by each person's
own client in ORISO and read by the fork. It costs one small state event
per person per room — written once, not once per call — and it needs no
new capability class: the widget contract already allows reading room
state, and the event is added to `receiveState` and deliberately **not** to
`sendState`. A widget that could write this could write somebody else's,
and the whole rule is that the call does not decide who anybody is.

### The join path is already fixed, and the remaining defect is unreachable

`useJoinVideoCall` really does open `/videoanruf/<room>/<type>` in a new
tab, landing on the legacy `MatrixCallView`, which starts a new call. But
its only caller renders the button behind `isVideoActive`, and **no
production code passes that prop** — only stories do. The button never
appears.

The live path is #1395's `CallTimelineMessage`, which joins in place
through `callManager.joinExistingCall`: it confirms the call against the
backend, joins the media room, checks that the MatrixRTC session actually
has memberships, and only then opens the widget. That is the correct
behaviour and it already existed. No third join path was built.

---

## 2. What the plan got right, and what came of it

### Live presence was the missing piece, and it was a small change

Both prior pull requests built attendance as a union that is only ever
added to. The lifecycle message now carries `present` beside
`participants`: replaced on every membership change, emptied when the call
ends. A running card answers "who is in there", an ended one "who was".

One consequence worth stating: a membership change is now a real update
where the identical payload used to be deduped away, so a call sends one
more timeline edit per join and per leave. That is the feature working, and
it moved a count in `CallManager.timeline.test.ts` from two to three.

### The fork's speaking indicator was dead twice over, and is now gone

`src/index.css` targeted global `.tile.speaking`; the tile emits hashed CSS
module names, so the selector could never match, and upstream's rule
carries `!important` where ORISO's did not. A speaking tile rendered
upstream's black gradient ring — "the system marked her red", which the
handoff rejects by name. In the ORISO tile both `speaking` and `handRaised`
classes are now suppressed outright and the indicator is the person's own
colour blooming, from `haloFor`.

---

## 3. The seam, and why there is only one

`MediaView` is shared by every tile in every layout. With an ORISO identity
it renders a form in the person's colour carrying their own animal, and the
camera cropped into that same form; without one it renders upstream's
rectangle, unchanged. One component serves both, so the lobby, the
standalone build and every existing test keep working and there is no
second call UI to drift.

The layouts place invisible slots; `Grid` measures them and springs the
real tiles into position, so the motion, the dragging and the spotlight all
keep working. `Grid` itself is untouched.

Two things are carried on channels that are worth knowing about:

- **The form** reaches the tile through a subscription store, not React
  state. State deadlocks: `useUpdateLayout` bumps a generation on every
  render of a layout, `Grid` re-renders on that, and a context change
  re-renders the layout straight through `Grid`'s `memo`. React stopped the
  first version with "Maximum update depth exceeded".
- **The identities** are read with `useState` plus an equality check rather
  than `useRoomState`, because that hook's `getSnapshot` must return a
  stable value and this mapping builds a Map. Same class of failure.

The view choice is deliberately **not** folded into `GridMode`. That setting
answers whether one thing is big, and auto-switches to spotlight on a screen
share or a phone in landscape; widening it to three values makes that rule
ambiguous across six working files. Kreis and Kacheln are both grid mode
with a different arrangement.

---

## 4. Video in an organic shape: measured

Six live frames, same stage, six seconds each, software rasterisation
(the pessimistic case for compositing a clip path):

| arrangement                                                 | median  | p95     | worst   |
| ----------------------------------------------------------- | ------- | ------- | ------- |
| plain squares (control)                                     | 16.7 ms | 33.4 ms | 50.1 ms |
| grove blob (radius + lean + counter-rotation + cover scale) | 16.7 ms | 33.4 ms | 50.1 ms |
| Einzelgespräch clip path                                    | 16.7 ms | 33.4 ms | 33.5 ms |

Shaping a live frame costs nothing measurable. Reproducible:
`scripts/measureVideoInShape.mjs` in the fork. The caveat is real: the
streams are canvas captures, so this bounds **compositing** and not decode,
and a real call adds decode on top equally in all three arrangements.

---

## 5. What the pictures found that no test did

The visual harness (`harness/orisoStage.tsx` plus
`scripts/shootOrisoStage.mjs`) shoots ten plates in Chromium and then
measures them. On its first run it found three defects, none of which any
test saw:

1. **The artwork loader rejected every real ORISO animal.** It checked
   `startsWith("<svg")`; the files begin `<?xml version="1.0"?>`. The unit
   test agreed with the bug, because its fixture also began `<svg`.
2. **Both halves of the Einzelgespräch sized their animal off the whole
   circle**, so one was clipped at the seam and the other ran off the rim.
3. **The sphere shading was on everything**, which made the rectangular
   fields read as glossy plastic buttons. It belongs to bodies — the grove's
   blobs and the circle — not to surfaces.

A fourth was found by the cross-repository contract test on its first run:
the fork re-derived initials it had been given, turning a counsellor's "SP"
into "S". Neither repository's own suite could have seen it.

---

## 6. Deliberately not built

Each of these is a decision for the product owner, not an omission.

- **The `scheduled` state** from #1361, and the calendar action and
  notification-centre entries behind it. Verified rather than assumed: in
  #1361 itself `scheduled` appears only in the type, the parser and the
  serialiser — `git grep` over that branch finds nothing that ever
  constructs a message with it. It is a schema written for a producer that
  was never built, so the UI would be dead code by construction.
- **The call notification emails** from #1361. `dev` already carries 126
  `anruf-*` templates with different content; which set ships is a product
  decision, not a merge.
- **`participant_count`** in the payload. It duplicates
  `participants.length`, and a count that can disagree with the list it
  counts is worse than no count. (`actor_user_id` **was** built — it is the
  one field from #1361 carrying information nothing else does, and the card
  now says who started the call, by the name the room knows them under. A
  raw Matrix id is never shown: on a counselling platform that is the
  identifier the pseudonym exists to keep out of sight.)
- **The legacy 1:1 pair** (`FloatingCallWidget` and `MatrixCallView`), and
  this is now settled with evidence rather than deferred. It is
  **reachable**: `matrixLiveEventBridge` decides `isElementCall` from
  `isElementOrGroupCallInvite(content)`, and for a plain `m.call.invite`
  without ORISO's marker it calls `receiveCall` _without_
  `usesElementCall`, which defaults to `false` — so
  `FloatingCallWidget`'s `return null` guard does not fire and the legacy
  UI renders. Removing it would break receiving a call from any peer that
  has not moved to MatrixRTC. The two files nothing imported at all
  (`.OLD.tsx`, `.PROFESSIONAL.tsx`, 1022 lines) are gone.
  _(The tenant setting for the backdrop **was** built in the end:
  `appConfig.calls.atmosphere`, passed on the widget URL when a centre sets
  one and left off entirely when it does not — an empty parameter is not the
  same as no parameter, and only the second falls back to the default.)_

---

## 7. Open questions — four answered, two left

**Answered, with evidence:**

**4. Hain overlap** was measured rather than eyeballed
(`scripts/measureHainOverlap.mjs` in the fork). Overlap as a share of the
_smaller_ shape's area, which is the one at risk of disappearing:

| people | silent | one speaks |
| ------ | ------ | ---------- |
| 3      | 10.6%  | 4.4%       |
| 4      | 2.8%   | 11.9%      |
| 5      | 2.0%   | 0.6%       |
| 6      | 0.6%   | 7.7%       |
| 9      | 0.7%   | 0.9%       |

The worst case — 20–25% at two people — is **unreachable**:
`layoutMedia$` reaches for `oneOnOneLayoutMedia$` first in grid mode and it
matches at exactly two media items, so two people get the Einzelgespräch
whichever view the switcher is on. At the counts the grove can actually be
shown at, the worst is 11.9% and most are under 3%. The shapes abut, which
is the design; they do not cover. The script holds 20% as a ceiling so
nobody has to look again.

**5. Middle truncation** is built. The head shrinks and ellipsises, the
tail never does, so "ruhiger Fuchs 432" keeps the number that tells two
foxes apart. Two spans and a flex rule — no measuring, no JavaScript, and
the tag's text content stays whole for a screen reader and a copy-paste.

**6. The backdrop setting** is built: `appConfig.calls.atmosphere`.

**Still open, and each is a judgement rather than a measurement:**

1. Does Call v2 want the **scheduled** state at all? (It has no producer —
   §6.)
2. Do the **call notification emails** belong in this epic?
3. The handoff's **"Kacheln" icon draws a house**. The fork uses Compound's
   grid icon; unlike the animals, the chrome icons are not inherited,
   because they are chrome rather than identity.
4. The **0.11 AA margin** on the 12px subtitle.

---

## 8. What the review round changed

Codex and CodeRabbit reviewed both pull requests. Every finding was traced
to a caller before it was touched; what follows is what held. The two that
mattered most would both have shipped a feature that silently did nothing.

### The call card never rendered in the conversation

`MessageItemComponent` draws the card only when the lifecycle record's
`roomRef` matches the item's `rid` — so a supervision call cannot surface in
the client timeline. The stamp that puts `rid` on an item was opt-in, and
only the two side rooms opted in. For the main timeline the guard therefore
compared a room id against `undefined`, which is never equal, and a call in
the conversation rendered as an ordinary message. Every test of the card
passed, because they all hand it `rid` directly.

The flag is gone: `formatRoomMessages` always stamps, so there is no
"forgot to opt in" state left to be in. `SessionStream.test.tsx` now drives
a lifecycle event through the stream that builds the items and asserts the
comparison the card is gated on can hold. It fails without the fix.

### Nobody but the call's creator could say who they are

`createElementCallRoom` sets `state_default: 100`, deliberately — without
it any joined participant could rewrite `m.room.join_rules` back to
`public` from inside the call. But the identity record is a state event
written by each person's **own** client, so the only participant whose
write the server accepted was the one who created the room. Everybody else
appeared in the call as initials: the exact outcome the handoff's first rule
exists to prevent.

`org.oriso.call.identity` now joins `org.matrix.msc3401.call.member` in the
power-level grant at PL 0. Safe, because the state key is the sender's user
id and the server already refuses anyone else's.

Two smaller faults in the same path: the state key came from
`useOwnAvatarUserId`, whose fallback is a userservice id that the server
would refuse outright — the key is now strictly `client.getUserId()`, while
the palette SEED stays the id the chat derives colours from. And the write
raced `joinRoom`; it now waits for the widget URL, which only exists after
the join has returned.

### The rest

| finding                                                                              | where                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `parentUrl` is the generic widget parameter, so any Element Web embed got the design | fork: new `orisoDesign` opt-in, set by the host |
| Speaking read as a snapshot — the seam never bowed, the grove never re-packed        | fork: both layouts subscribe                    |
| Shapes keyed by user id collided across two devices                                  | fork: keyed by the media's own id               |
| `GridTile` passed the filtered `showSpeaking`, so the one-on-one rim never showed    | fork: raw `speaking`                            |
| Stale shapes survived into upstream's spotlight                                      | fork: cleared on unmount                        |
| `position: relative` on the backdrop's siblings broke the sticky header and footer   | fork: `z-index: -1` in an isolated context      |
| Artwork URL concatenated onto a `parentUrl` that may carry a path                    | fork: resolved against its origin               |
| A published animal had no letters to show while its artwork loaded                   | fork: initials from the display name            |
| Fetched SVG went into `dangerouslySetInnerHTML` unexamined                           | fork: one pass removes anything that could run  |
| Transaction IDs were reused after a successful write, so a rejoin vanished           | host: released once the write lands             |
| `finish()` left every call of the session in memory                                  | host: the entry is dropped                      |
| A group call nobody joined stayed "running" for good                                 | host: `finishIfUnattended`                      |
| Each call card re-polled on every timeline refresh, and never stopped on `null`      | host: keyed on identity, stops when settled     |
| The notepad vanished below 1280px — the consultant's only one                        | host: keeps its rail, overlays when opened      |
| The start time used the browser locale, not the interface language                   | host: `i18n.language`, `de@informal` normalised |
| A copy gave a screen reader no confirmation                                          | host: a live region                             |
| `2026-02-30` passed validation and rendered as 2 March                               | host: real calendar days only                   |
| The roving tabindex never moved DOM focus                                            | both: focus follows the selection               |
| The video spike measured orphaned canvas loops, penalising the clip path             | fork: loops stopped between runs                |
| `shootCallStages.mjs` defaulted to one machine's Chromium path                       | host: Playwright's own unless told otherwise    |

Two findings were **not** taken as written, and the pull request comments
say why: a sanitiser dependency (the pass does the job without diverging
from the host's own `AnimalAvatar`), and a 60-second invite timer for an
unanswered group call (the narrower `finishIfUnattended` covers the
reachable case without a timer nobody asked for).

---

## 9. The design on a phone

The second review round found that the integration reached only two of
upstream's layout entries. I first wrote that up as a scope gap for somebody
else to schedule, which was wrong: the handoff draws all three arrangements at
phone width — `Einzel-handy`, `Hain-Handy`, `Felder-Handy` — so phones were
part of the design this work was asked to finish, with no decision left for
anybody to make.

What was actually happening, read branch by branch out of `layoutMedia$`:

| window mode                  | people                        | layout               | the design?          |
| ---------------------------- | ----------------------------- | -------------------- | -------------------- |
| normal                       | 2                             | `one-on-one`         | yes                  |
| normal                       | 3+                            | `grid`               | yes                  |
| **narrow (phone, portrait)** | **2**                         | `spotlight-expanded` | **no**               |
| narrow                       | 3+ under the mobile threshold | `grid`               | yes                  |
| narrow                       | 3+ over it                    | `spotlight-portrait` | **no**               |
| flat (phone, landscape)      | any                           | spotlight layouts    | **no**               |
| pip                          | any                           | `pip`                | no, and correctly so |

So one advice seeker and one counsellor on a phone — the most common call this
platform has — saw upstream's rectangular tiles, with a view rail claiming
otherwise.

Three changes close it:

1. **The arrangement follows the call, not the window.** With the design on,
   the choice is made the same way at every size: by the grid mode and the
   number of people. Screen sharing is untouched, because
   `gridLayoutMedia$` puts a share in the spotlight slot and the grove renders
   that slot in its fixed layer exactly as upstream's grid does.
   Picture-in-picture stays upstream's — it is a thumbnail of a call happening
   elsewhere and the handoff draws nothing for it. The flag is a
   `CallViewModelOptions` field, not a `getUrlParams()` call inside the view
   model: a view model that reaches for `window.location` cannot be reasoned
   about from its arguments.

2. **The spotlight carries the person.** Landscape turning into spotlight mode
   is upstream's deliberate gesture — "flipping your phone into landscape is a
   quick way of maximising the spotlight tile" — and the spotlight is one of
   the three views ORISO's own rail offers, so it is the right arrangement
   there rather than a missing one. What was wrong is that its big tile was a
   black rectangle while the rail beside it showed everybody as a form.
   `SpotlightTile` now carries the identity for a person. No `TileShape` and
   none wanted: the spotlight is one form filling the stage. A shared screen is
   left alone — structurally, since the identity is attached in
   `SpotlightUserMediaItem` and a `ScreenShareViewModel` never goes through it.

3. **The rail cannot lie.** At exactly two people the stage is the
   Einzelgespräch whichever arrangement is selected, so Kreis and Kacheln were
   both no-ops: the radio moved and the stage did not. (The fact was written
   down in `measureHainOverlap.mjs` and used to rule out an unreachable overlap
   row; nobody asked what the control does in that state.) The rail now names
   the arrangement that is on and offers the one real alternative. Its default
   is still the handoff's three — the Einzelgespräch is not a fourth choice but
   the name of the one two people are already in.

A marble test walks all four window shapes beside the existing "layout reacts
to window size" test; the only difference between the two is the host asking
for the design.

### What is still not verified

No live call has been made against any of this, on a phone or anywhere else.
There is no homeserver, no LiveKit and no Docker daemon in this environment.
The reviewer plans on both pull requests list what needs two accounts and a
deployed fork, and a phone is now on that list.

## 10. Identity stopped travelling in the clear

Codex raised this on #1775 as P1, against `AGENTS.md:29` — "Preserve
Matrix/chat/draft privacy boundaries. Do not move plaintext previews or draft
contents into server-visible state." It was right on the fact, and I handled it
badly: I laid out four options with their costs and left the choice to the
product owner as a blocking question on the epic.

That was the wrong call. The owner's decision would have been whether to
_relax_ a rule this delivery is bound by; compliance is not a decision, it is
the default. And the option I had leaned towards was available all along once
its one real cost was solved. So it is implemented.

### The fact

Matrix room encryption covers message events, sent as `m.room.encrypted`. State
events are **not** encrypted — in an encrypted room exactly as in any other.
The call room is created with Megolm on (`buildMatrixRoomEncryptionInitialState`,
and `assertMatrixRoomEncrypted` before any write), and that did nothing for
`org.oriso.call.identity`, which was a state event. The homeserver, and every
server it federates to, could read and keep it.

### What was actually exposed, and what was not

Worth stating precisely, because the review's phrase — "identity data imported
from the user service" — is broader than what travelled:

- `bg` and `ink` for an advice seeker are `generateAvatarForUser(userId)`, a
  pure function of the Matrix user id the homeserver already has. It could
  compute them itself. Those fields exposed nothing.
- `file` for a seeker who never chose anything is that same derived default.
- `file` for a seeker who **did** choose an animal is a userservice-stored
  preference the server could not otherwise derive. That is a real leak.
- A counsellor's `initials` come from their display name, which is already in
  plaintext `m.room.member` state. The tenant brand pair is tenant-wide, not
  personal.

So the new exposure was narrow — an avatar preference, and letters already
visible elsewhere. Narrow is not nothing, on a platform whose promise is that
the counselling centre keeps no record of the person.

### The fix: an encrypted timeline event

`m.room.encrypted` genuinely is end-to-end encrypted, so the record moved from
room state to the call room's timeline. The server stores ciphertext.

Three properties of state had to be replaced, and each is why a piece of this
change exists:

1. **State is idempotent; a timeline event is not.** `publishCallIdentity` now
   keeps what it last sent per room, so a re-render does not put a second copy
   in the room.
2. **State is always current for whoever reads it next; a timeline event
   reaches whoever was listening.** The widget is fed live events and the call
   room's `history_visibility` is `joined`, so a late joiner is handed nothing.
   Everybody already in the call therefore re-announces when a new member
   appears, and the newcomer learns the room from the people in it. One small
   encrypted event per participant per join — for a counselling call, a
   handful.
3. **A state key had to be checked against the sender by hand.** It does not
   any more: the fork files each record under the event's **sender**, which a
   decrypted event attests. Forgery has nowhere to stand — a mischief-maker can
   only ever change their own face. The reader-side sender check added in the
   previous round is now structural.

### What that took

| Where                               | Change                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publishCallIdentity.ts`            | `sendEvent` instead of `sendStateEvent`; last-sent memo; `republishCallIdentity` for an arrival; **refuses to publish into an unencrypted room at all**                                                                                                                 |
| `GroupCallWidget.tsx`               | announces once, then re-announces on a `join` that is a genuine arrival — not a leave, not our own join echoing back, not another room                                                                                                                                  |
| `CallManager.ts`                    | `'m.room.encrypted': 0`. In an encrypted room the power-level check sees the **outer** type, so at 50 with `users_default: 0` only the call's creator could have sent one and everybody else would have shown initials. The per-type grant for the state event is gone. |
| `orisoWidgetCapabilities.ts` (host) | room events split into send and receive sets, as state already was. Identity is receive-only: a widget that could write one could write somebody else's.                                                                                                                |
| `useElementCallWidget.ts`           | the feed filter uses the **receive** set                                                                                                                                                                                                                                |
| `OrisoWidgetDriver.ts`              | timeline reads use the receive set; sends keep the narrow one                                                                                                                                                                                                           |
| fork `orisoWidgetCapabilities.ts`   | identity moves from `receiveState` to `receiveEvent`, still absent from `sendEvent`                                                                                                                                                                                     |
| fork `useOrisoIdentities.ts`        | reads the live timeline, keyed by sender, newest wins; follows `RoomEvent.Timeline` and `TimelineReset`                                                                                                                                                                 |

### The line that would have made all of it silent

`useElementCallWidget.ts` filtered the event feed by the set of types the
widget may **send**. With the transport changed and that line left alone, every
test would still have passed, the capability would have been granted, the host
would have sent the event — and it would have been dropped on the way into the
iframe, leaving every face in the call showing initials. It is the same shape of
bug as the four this epic has already found: green, and doing nothing.

It now has a test of its own, and that test was confirmed to fail against the
old filter before being kept.

### What this does not fix

The homeserver still sees who joined which call room and when, and the
anonymous pseudonym of everybody in it. Both are ordinary Matrix membership
state and predate this epic. What it no longer sees is which animal a person
chose.

### Verified

Local only, as everything in this epic: no homeserver, no LiveKit, no Docker.
The widget-boundary behaviour is covered against the real `GroupCallWidget` in
`groupCallHarness.test.tsx`, and `embedded.ts` in matrix-js-sdk was read to
confirm the production path — `onEvent` injects a fed event into the room's
live timeline and fires `RoomEvent.Timeline`, which is exactly what the fork
subscribes to.

## 11. A homeserver, and the blocker it found in ten minutes

Everything above was verified locally, which in this epic has meant unit tests,
Chromium screenshots with measurements, and reading the SDK. All of those can
only confirm that our code does what we told it to. The identity transport
rests on three assumptions about what **Synapse** does, and if any of them were
wrong the failure would be silent — the shape of bug this epic has already
produced five times.

So Synapse was installed (`pip install matrix-synapse` in a venv, 1.163.0,
bound to 127.0.0.1:8008) and the assumptions were checked against it:
`scripts/verifyCallRoomMatrixRules.mjs`. No LiveKit and no ORISO backend are
involved — these are plain client-server API calls, which is all the rules are.

### It found something nobody was looking for

**The call room could not be created at all on a current homeserver.**

`createElementCallRoom` passed `users: { [creator]: 100 }` in
`power_level_content_override`. From **room version 12** the creator holds
power implicitly and must **not** appear in `content.users`: Synapse rejects
the whole `createRoom` call with `M_UNKNOWN`, "Creator user ... must not appear
in content.users". Room version 12 is the **default** on a current Synapse.

The existing fallback did not help. It catches a failed restricted-join
creation and retries invite-only — with the same power levels, so both attempts
failed. Every group call would have fallen back into the counselling session
room, which is also where the identity events would then have gone.

Measured: accepted on room versions 10 and 11, refused on 12 and on this
server's default.

### And it corrected me while I fixed it

My first fix was a retry: attempt it with the creator named, and on that
specific rejection try again without. The comment I wrote for it said the entry
was still _required_ on room version 10, because
`power_level_content_override` "replaces the default content outright".

That is wrong, and the homeserver said so: with `users` omitted on room version
10, the creator could still write `m.room.name`, which needs level 100. The
override updates the default content **key by key**, and the default already
gives the creator 100. So the entry is simply never needed, on any version, and
the fix is to leave it out — no retry, no error-message matching, no extra
round trip. The retry is deleted.

I would not have found that by thinking about it; I had already thought about
it and reached the opposite conclusion.

### What else now holds against a real server

- **`m.room.encrypted` at 50 refuses an ordinary participant**, and at 0 allows
  them. That is the change in §10 shown to be both necessary and sufficient:
  with `users_default: 0`, the old level would have refused every identity but
  the call creator's.
- **A state event whose state key is another user's id is refused**, even with
  the event type granted at level 0. This was the forgery argument for the old
  transport, and I could not check it when I made it — `spec.matrix.org` is
  blocked from this container — so I argued it from memory and gave the reader
  its own sender check instead. It is now measured rather than remembered.
- **`history_visibility: joined` hides timeline events sent before a member
  joined.** This is the premise of the re-announce: a newcomer genuinely cannot
  read what was said before they arrived, so somebody has to repeat it.
- **The room state of a call room holds no identity record at all.**

17 checks, all holding. The script fails loudly and exits non-zero if any stops
holding, and it guards itself against drift: it reads `CallManager.ts` and fails
if the power levels it mirrors have changed.

### What this still is not

A call. There is no LiveKit and no ORISO backend here, so no media flows and
nobody logs in through Keycloak. What now has evidence is the Matrix layer
underneath the call — the room, its power levels, its history rules and the
transport the identity rides on. The reviewer plans still carry every step that
needs two accounts and a deployed fork.

## 12. The fourth review round, and the phone rail that was not there

Six findings, all six real. One of them was mine from the round before, and it
is the one worth leading with.

### The rail was hidden on exactly the phones it was added for

`@media (max-width: 660px) { .layout { display: none !important } }` — and the
new `ViewSwitcher` had been given `className={styles.layout}`. So on a portrait
phone the whole view rail was gone. One advice seeker and one counsellor on a
phone is the most common call this platform has, and they could not leave
whatever arrangement was stored. In the same change that routed phone window
modes through the ORISO arrangements, the only control for them was hidden.

**Nothing in this repository could see it.** jsdom applies no media queries and
stubs CSS-module class names, so `InCallView.oriso.test.tsx` renders the rail
and finds it present. The browser harness cannot see it either: it mounts
`ViewSwitcher` on its own rather than inside `InCallView`'s footer. The CSS rule
and the component were each correct; only their meeting was wrong.

The rail now has its own class and its own row when the footer reflows — a row
rather than a slice of the buttons', because below 660px the footer's areas
become `". buttons buttons buttons ."` with no `layout` column at all, and at
390px the call buttons already fill two thirds of that row. Upstream's toggle
stays hidden there, which is right: a two-way grid/spotlight switch is not worth
the width, while the handoff draws every arrangement at phone size.

And it has a test at the only level where the mistake is visible:
`InCallView.orisoRail.test.ts` reads the stylesheet. Reading CSS text is not how
one would normally test a component; it is there because this bug lives between
a rule and a class name. All three of its assertions fail against the previous
stylesheet — including one that exists only to stop the check passing by having
nothing to look at, which is the state the bug was in.

### The other five

| Finding | Verdict |
| --- | --- |
| Identities are not re-read after decryption | Half right, fixed anyway. In the embedded build the host decrypts *before* feeding the widget, so the clear type is what arrives — but that is an invariant of the other repository, and the standalone build with the flag has its own client where the sequence is exactly as reported. `useOrisoIdentities` now also listens for `MatrixEventEvent.Decrypted`, as `ReactionsReader` does. |
| Grove tiles intercept each other's pointer events | Right. The grove has no `clip-path` to put on the root — its shape is a border radius on the face — and `--hover-space-margin: 0` means forms are packed until they abut, overlapping by up to ~12%. The root is no longer a hit target and its children are, so the pointer lands on the form; handlers stay on the root because events still bubble. The Einzelgespräch keeps its clip, which already was not hit-testable. |
| The spotlight's form is an ellipse | Right, and mine. `.face` fills its tile, which the grove wants; with no shape the radius falls back to `50%`, so a 300×200 spotlight drew a 300×200 oval with the camera stretched into it. Fixed in `OrisoFace` rather than in `SpotlightTile`: "a form with no shape is a circle" is the invariant. |
| `move` closes over a stale `offer` | Right, and taken further. `offer` arrived as a fresh array literal each render, so `views` changed identity every render and the `useCallback` was memoising over something it could not see change — adding `offer` to the list would have made the memo a no-op while still looking like one. Both ends are memoised now and the `eslint-disable` is gone rather than extended. |
| A superseded timeline revision can be stored | Right. `apiCallState` answers by spreading the revision it was asked about, so a membership edit landing mid-request leaves the answer carrying the old attendance — and a terminal answer then stops the retries that could correct it. Now compared **by value**, not by object identity: identity changes on every message fetch, and comparing it would have restored the request storm `callKey` exists to prevent. |

Every one of the five has a test that was confirmed to fail against the code as
it stood before the fix.

## 13. The fifth round, where two of my own fixes turned out to do nothing

Three findings, all three mine from the round immediately before, and two of
them were fixes that had changed no behaviour at all while passing every test.

**The grove hit-target fix did nothing.** `.fg` — the chrome layer — is
`position: absolute` with a small inset, so it covers essentially the whole
tile. The rule I wrote, `… > * { pointer-events: auto }`, re-enabled it, which
handed the transparent square corners straight back to the pointer. The root
was non-hit-testable and the overlay on top of it was not. `.fg` now stays off
and its children are listed individually: the form, the name capsule, the
status glyphs (they carry tooltips, which need hover) and the options button —
all of which sit *inside* the form in this design, because
`--media-view-fg-inset` insets the chrome by the corner rather than by the
rectangle's padding.

**The Einzelgespräch chrome shift missed the button.** `{primaryButton}` is
rendered inside `.fg`, so `.media.oriso[data-oriso-half="true"] > button` never
matched. The capsule moved into its half and the button stayed at the shared
box's bottom-right, where the seam clips it away entirely — removing the tile's
only menu control, keyboard route included. The shift now moves the whole
chrome layer, which is one rule instead of a list and has nothing left to
forget.

**And the two-person rail still lied in spotlight mode.** `alone` read
`layout.type === "one-on-one"`, which answers the question only in grid mode:
pick the spotlight at two people and the layout becomes a spotlight, so the
rail decided it was no longer a two-person call and offered the grove and the
fields again — both of which land back on the Einzelgespräch. The state is now
derived from `orisoOneOnOne$` on the view model, straight off
`oneOnOneLayoutMedia$`, so it cannot drift from the real condition: exactly two
media items, one local and one remote. Not a count of people — a screen share
makes a third media item, and `participantCount === 2` would have been the same
lie in the other direction.

### The lesson, which is now a test

Two of these were selectors written for a DOM that was not the one there, and
**nothing in this repository could observe either**: jsdom applies no CSS, and
the browser harness mounts `OrisoFace` rather than `MediaView`. So the
stylesheet is now asserted directly — `MediaView.orisoCss.test.ts` beside
`InCallView.orisoRail.test.ts` — on three invariants: no `pointer-events: auto`
rule may use `> *` or name `.fg` as its subject, and exactly one rule may carry
the focus shift, naming `.fg` and never `> button`. All of them fail against the
previous stylesheet.

Writing that test caught a third mistake in passing: its first version read its
own explanatory comment as part of a selector, because the comment quotes the
`> *` it replaced. It strips comments before parsing now.

That is three rounds in a row where the defect was something that looked
finished and did nothing. The countermeasure that keeps working is the same
one: assert the thing at the level where it can actually be wrong, and check
the assertion fails before keeping it.

## 14. The sixth round, three P1s in the lifecycle

All four findings held. Three of them were in the consolidated lifecycle rather
than in the design, and one of them was documented on this branch as a hazard
while the code walked into it anyway.

### `missed` was being corrected back to `ended` by a server that cannot tell

`docs/agent-tasks/2026-09-14-calls/README.md`, on this branch:

> UserService PR1153 defines attendance as any observed Matrix membership; it
> does not prove two-person media.

The caller's own membership is published the moment their iframe opens, so an
unanswered outgoing call comes back from the backend as `ended` with the
ringing time as its duration. `apiCallState` accepted that — **permanently**,
because a terminal answer stops the retries. It is the mistake
`callLifecycleTracker` was fixed to stop making two rounds ago, re-imported
from the other side of the API.

A correction out of `missed` now needs the one piece of evidence only a real
peer produces: an attendee in `participantMatrixIds` who is not the card's
`actorUserId`. No ids is no evidence. A card with no actor accepts any
attendance, which is the tracker's own fallback.

**An existing test asserted the wrong behaviour and passed** — a response with
no `participantMatrixIds` at all, expected to become `ended`. Replaced by four
cases; two of them fail against the previous code. That is the fifth defect in
this epic of exactly that shape.

### Side-room call cards never received a single revision

Lifecycle folding ran on the main timeline only. The supervision and team
timelines had `applyMessageEdits`, which **filters out** every `m.replace`
rather than folding it — so a call started in a side room (and
`startSupervisionCall` does exactly that) sat at whatever it was first written
as: "running" after it had ended, with a Join button for a call nobody was in.

All three timelines now share one `prepareRoomMessages`, so there is no longer
a place where a new side timeline can be added with the shorter version by
accident — which is how this happened.

### Leaving a supervision call ended it for everybody

`startSupervisionCall` decides group mode from the side room's participant
count; the rejoin path had `Boolean(activeSession?.isGroup)`, which describes
the **client** session and is false for a supervision call inside a 1:1 one.
Rejoined as non-group, leaving takes `endCall` — a remote hangup and a
finalised lifecycle — while the other supervisors are still in the call.

`CallLifecycleMessage` carries an optional `isGroup` now, written by the
tracker from the `CallData` the starting side already resolved and validated on
the wire as a boolean. Carried rather than re-derived, because re-deriving is
what produced two disagreeing answers.

### And the newer running revision now wins

The fix in §12 compared `state`, which is too little: a membership edit leaves
both revisions `running` while attendance changes, so an accepted answer kept
winning with the live revision already in its props — and attendance-only edits
do not change `callKey`, so nothing re-read it before the next poll. It
compares the whole revision now, by value, via the same helper the superseded-
response guard uses.

Every one of the four has a test confirmed to fail against the code as it stood.

## 15. The seventh round: the phone routing's own consequences

Four findings, all four real, and three of them were consequences of the phone
routing itself — things that had been true only because the design used to hold
at one window size.

**The spotlight was landscape on a portrait phone.** The point of routing the
design through the view model is that the grove, the fields and the
Einzelgespräch are *ORISO's* and hold at every size. The spotlight is
upstream's, one of the three the rail offers, so it still has to respect the
window: `spotlight-landscape` reserves a 180px rail and 60px of padding, which
on a 390px phone leaves about 150px for the person being spotlit.
`orisoArrangement` is a function of the window mode now, and its spotlight
branch follows upstream's own mapping — expanded, portrait when narrow,
landscape otherwise. The grid branch is unchanged.

**A shared screen was cut off on a phone.** The fixed slot was 404×233,
upstream's size; upstream's grid can hard-code it because its narrow branch
hands a screen share to the portrait spotlight instead. The grove has no such
escape any more, and `.inRoom` hides horizontal overflow. It is
`min(404px, calc(100% - 2 * inset))` with the aspect ratio kept, so clamping
does not squash what is being shared.

**The Einzelgespräch chrome, on the third attempt.** Translating `.fg` was not
enough: it spans 84% of the *whole* box, so moving it carries a left-aligned
capsule and a right-aligned button the same distance — the left tile's button
went from about 92% to about 67%, still past the 50% seam, still clipped away.
The chrome is now *sized* to the half. The bounds follow exactly from `focusX`,
which the layout sets to the middle of the half it gave the tile
(`share / 2` and `share + (1 - share) / 2`), so the seam is at `2 * focusX` or
`2 * focusX - 1` and the 8% inset comes off the half's own width.

Three attempts at one rule, two of which looked right and did nothing. Every
one of the three failures was invisible to jsdom and to the screenshot harness.

**And a redaction found a second bug behind it.** `RoomEvent.Redaction` is
listened for now — but the test still failed, because **the newest record was
not winning**: `readIdentities` read each event as it walked and stored only
valid ones, so a redacted latest record (empty content, rejected) left the
*previous* valid record standing. Somebody who withdrew their animal kept it.
It collects the newest content per sender first and reads only that: the newest
thing a person said about themselves wins, including when it is nothing.

Each of the four has a test confirmed to fail against the code as it stood.

## 16. The eighth round: the re-announce was watching the wrong thing

Four findings, all four real. The first one matters most.

**Re-announcing watched room membership, and "in the call" is not "in the
room."** `useElementCallWidget` never leaves the Matrix room, so somebody who
closes the call surface and opens it again stays a joined room member the whole
time — only their `org.matrix.msc3401.call.member` membership goes away and
comes back. A listener on room membership never fired for them, nobody
re-announced, and the returning participant sat looking at initials where the
animals had been.

The set is the MatrixRTC session's senders now, recomputed on
`MembershipsChanged`, and an arrival is somebody entering it who was not in it a
moment ago — which makes a rejoin an arrival. Room membership stays as the
fallback for a client without `matrixRTC`, because losing the re-announce
silently is the failure this mechanism exists to prevent. The harness grew an
RTC session the test can drive, which is what makes the case checkable: our own
churn is not an arrival, somebody else joining is, staying is not, and leaving
and coming back is.

**A terminal answer froze the attendee list.** Once stored,
`hasAcceptedTerminal` stopped the reads and the stored value won for good — so
a membership edit arriving afterwards never reached the card. The selection is
now three ordered rules, each of which is a bug that was fixed: the stored
answer stands while the timeline agrees (by value, over the whole revision); a
newer *terminal* timeline revision wins; and a still-running timeline never
reopens a terminal answer — the only part of "a terminal answer always wins"
that was right.

**Overlapping publishes could duplicate.** `lastSent` is written when the send
resolves, so a second publish starting while the first is out would send again.
An in-flight promise per room is reused for an identical non-forced publish; a
*forced* one still sends, because that is the re-announce for a newcomer.

**And a test that asserted a call rather than an outcome.** Here the chain was
already closed by two tests — `callLifecycleTracker.test.ts` pins what
`finishIfUnattended` writes, this one pins that leaving reaches it — so the
reasoning is now a comment in the test rather than a duplicated client double.
That is the same two-ended argument the reviewer accepted earlier for
`SessionStream.test.tsx`.

## 17. And the ninth round: the other half of the circle

One finding, and it is the symmetric half of the circle fix in §12. That fix
centred the **face** in a square of the tile's smaller side and left the chrome
layer inset by 8% of the whole rectangle — so in an 800×450 spotlight the circle
begins at x=175 while the name capsule began near x=64, and the label floated
off the form it names.

The chrome is inset to the same square now, computed in `MediaView` beside the
face's own size so the two cannot drift apart, under a `data-oriso-circle`
marker so the grove and the fields — whose chrome should stay at 8% of their own
tile — are untouched.

The fix needed one thing the finding did not mention: the extended style object
was only applied when there was a clip path or a focus shift, so for the circle
case the new variables were computed and then dropped on the floor. The first
version of the test caught it, which is the only reason it was noticed.

### What nine rounds of this actually taught

Three rounds in a row ended with a fix of mine needing a follow-up on the other
side of the same geometry. The conclusion is not about any of those rules; it is
that the visual harness mounts `OrisoFace` rather than `MediaView`, so **none of
the tile's chrome is visible to any check in this repository** — not to jsdom,
which has no layout, and not to the plates, which never render it. Every one of
those defects was found by somebody reading the CSS against the DOM.

Two stylesheet tests now assert the invariants that can be stated as text, and
the reviewer plans ask for a 1:1 and a spotlight on a real screen, which is the
only place the rest of it can be seen.

## 18. The tenth round: the notepad was measuring the wrong box

One finding on the host, and it is the same class of mistake as §17 — a rule
written against the page when the thing it governs is a window inside the page.

Opening the Gesprächsnotizen panel makes it a 320px flex sibling of the call
iframe, and the only thing deciding whether to do that instead of laying it over
the stage was a **viewport** media query at 1280px. But the group call is a
floating window: its width is `stageSize`, which autofit scales to the screen
and which the counsellor then drags with the resize handles down to 280px. So a
1920px screen can hold a 300px-wide stage, the media query takes the
side-by-side branch, and the iframe is squeezed to a sliver — or the panel
overflows a shell with `overflow: hidden` and is clipped, which is the case
where the notepad stops being usable rather than merely cramped.

`GroupCallWidget` now publishes `data-narrow-stage` when the stage is narrower
than the panel plus the 280px minimum the resizer allows for the call, and the
overlay declarations moved into a `notes-over-stage` mixin that both triggers
share. The media query stays, because it is the right measure for the two shells
the stylesheet sizes itself: full screen and the mobile view both leave `style`
off the shell, so the component does not know its width there and cannot publish
the marker at all.

Both halves are tested, and the split matters:

  * The harness test asserts the marker — and was confirmed to fail without it.
  * A stylesheet test asserts the rule, because the marker alone does nothing
    and jsdom can see neither. It also pins that the collapsed rail is never
    moved and never hidden: `display: none` at a breakpoint was the original
    bug, and it left the consultant's only notepad with nothing to open.

That is now the third defect in this epic whose whole mechanism lived in CSS
this repository does not execute, and all three were found by a reviewer reading
the stylesheet. The countermeasure is the one above: when a fix is a rule rather
than a value, assert the rule as text.

## 19. The eleventh round: the halo had nowhere to go

One finding on the fork, and it is the third in a row about a box clipping
something it contains.

The speaking halo is three **outer** box shadows — a ring in the person's own
colour, a wide glow in the same colour, and a deeper drop that puts the form in
front of the others. Together they paint about 32px outside the form. The
spotlight's form had been sized to the full shorter side of its tile, so it
touched the tile's edges, and `SpotlightTile`'s `.contents` carries
`contain: strict` together with `overflow-y: hidden`. The halo was cut along
both short edges of a landscape spotlight and along all four of a square one —
most of what speaking looks like, on the one layout where there is nothing else
to tell you who is talking.

Relaxing the containment would not have fixed it. The `overflow-y: hidden` is
there for the spotlight's horizontal scroll-snap and clips whatever the
containment says, and `Grid` carries `contain: strict` as well.

So the form reserves the room instead. `shapelessFaceSide(width, height)` is the
shorter side less that room on each side, capped at 8% a side so a small tile
gives away at most a sixth of its form — past that the halo would be eating the
thing it is meant to light up, and a clipped halo is the lesser loss there.

Two details worth keeping:

  * **The room is computed from the halo's own numbers.** The three layers'
    geometry is named now rather than written into the template literal, and
    `HALO_ROOM_PX` is derived from those names. A test reads the reach back out
    of the string `haloFor` returns and asserts the constant covers it, so
    widening the glow cannot quietly outgrow the room again.
  * **One function, because two places need the number.** The face is sized to
    it and the chrome layer is inset to it. Computed twice they drift, and the
    drift is a name capsule floating off the form it names — which is the
    §17/§18 defect over again. The old `Math.min(targetWidth, targetHeight)`
    appeared in both files; now neither file has it.

The lift follows the form too, since it interpolates on size: it is judged
against the side actually drawn, not against the tile.

## 20. The twelfth round: two ways an identity goes missing

Both findings are about the same thing from opposite sides — an identity that is
**out of view** being treated as an identity that has been **withdrawn**.

### The live timeline is a window, not the room

`useOrisoIdentities` rebuilt its map from `getLiveTimeline().getEvents()`. A
limited sync throws that window away and hands over a fresh chunk, which need
not contain identity events that are still perfectly valid in the room's
history — and a long call pushes them out of the window anyway. So everybody who
had not published recently lost their animal, and a roomful of forms turned back
into stand-in letters until each client happened to announce itself again.

My own comment on the `TimelineReset` listener had the reasoning **backwards**:
it called that case "identities that are no longer in it". They are no longer in
the *window*. Nobody withdrew anything.

`readIdentities(room, known)` now reads the new chunk **on top of** what is
known rather than instead of it. The removal that stays is the one that is
somebody's own doing: a newest record that is unreadable — the redaction case —
and it is now an explicit `delete` rather than a skipped assignment, because
with the known identities seeded, skipping would have left the withdrawn record
standing and reintroduced the bug §15 fixed. Two tests, and they are different
in kind: the reset test fails against the old reader, and the
withdrawal-after-reset test guards the *fix* from undoing the earlier one.

### Reopening the same call was a no-op

`leaveCall` keeps the room — it only sets the state to `left` — so `callRoomId`
never changes, the room-keyed `forgetPublishedIdentity` cleanup does not fire,
and `lastSent` made the publish on reopening a no-op.

Everybody already in the call still holds the returner's first event, so the gap
is invisible to them. Somebody who joined while the returner was away does not:
`history_visibility` is `joined`, so they cannot read it from the room's
history, and the re-announce does not help — an arrival makes the *others*
resend their own identities, not the returner's. The newcomer went on seeing the
returner as initials.

The publish is forced on a new widget session now. Getting the signal right took
two attempts, and the first one is worth recording: I took a changed
`widget.url` to mean a new session, and it does not — `useElementCallWidget`
keeps its instance nonce in a `useRef` and the component stays mounted across a
leave, so a reopened surface gets a **byte-identical** URL. What actually
happens is `A -> null -> A`, because `shouldPrepareWidget` is false while the
state is `left`. So the comparison is against the previous value *including
null*, recorded before the effect's guard.

The test for it drives that real sequence rather than remounting, and that
matters: a remount runs the cleanup, which clears `lastSent`, so a
remount-based test passes against the unfixed code. It is the same vacuous-test
trap as the earlier rounds, caught this time before it was written down as
evidence — and the first version of the fix was caught by the test failing,
not by my reading it.

### And a P1 in the same round: a call that outlives its client

`callLifecycleTracker.begin()` captured the `MatrixClient` in a `const`, and a
**token refresh builds a new one for the same account** and tears the old one
down. Every guard in the tracker then compared against an object the service had
thrown away:

* the MatrixRTC membership listener hung off the dead client and never fired
  again, so attendance stopped updating;
* the mismatch cleanup that was supposed to catch this lived *inside* that
  listener, so it was never reached either;
* and on leaving, the terminal write found `isCurrentClient()` false and its
  retry chain stopped on the same check.

The durable card therefore stayed `running` for good — after something the user
can neither see nor avoid. That is the same class of defect as the missed-call
bug: a card stuck in a state the call is not in, with a Join button for a call
nobody is in.

The tracker follows the **account** now, not the object: `onClientChange` moves
the listeners and the writer to a replacement client with the same user id, and
drops the tracked call for a different user id or none — a logout, where nothing
left may write that card, and writing it as somebody else would be worse than
leaving it, since the card names an actor. `SessionStream` was already using
`onClientChange` for its room listeners; the tracker simply was not.

Two tests. The replacement-client one fails against the old binding
(`expected "spy" to be called 1 times, but got 0 times` — the ending never
written). The different-account one passes either way and is there to keep the
fix from writing a card as the wrong person.

## 21. The thirteenth round: two of mine, and one of them an hour old

Six findings. Two were defects **my own fixes in this review introduced**,
which is the part worth recording.

### The carry-over leaked across rooms

§20's fix seeds a room's read with what is already known, because absence from
the live timeline is not withdrawal. That is right *within one room* — and
`RoomPage` is a wildcard route, so SPA navigation can replace `room` without
remounting the hook. Somebody present in both rooms kept the animal they had in
the room just left, indefinitely, precisely because absence is no longer
treated as withdrawal. The fix for one bug created another an hour later.

`useOrisoIdentities` tracks which room the map in state describes and starts
from nothing when that changes. The carry-over flag is a *parameter* of the
update rather than a captured mutable: written inside the state updater, an
updater React may call twice would seed the second call from the room just
left.

The test is from the other side — same person, two rooms, two motifs, then a
third room that says nothing about them. It is the third assertion that catches
it: the leak only shows where the new room has nothing of its own to overwrite
with.

### Retrying an unanswered call was a dead end

`leaveCall` writes an unattended group call as `missed` and drops its tracker —
§13's fix. `startCall`'s reuse branch, which **predates this epic**, then
matched the retained `left` call and returned early. So the reopened surface
carried a terminal card, had no tracker, and published no new invitation; once
the original invite expired nothing could bring anybody in. A counsellor
retrying an unanswered call got a surface that could never ring.

The reuse branch exists for the call others are still in, where creating a
second dedicated room would strand them. It now also requires
`callLifecycleTracker.isTracking(callId)` — is the card still open — so a
finalised call falls through to a fresh start. The branch is old; the
interaction is ours.

### And four more

* **Orphan call rooms.** The startup-ownership check runs only *after*
  `createElementCallRoom` has created the room and invited the membership-reader
  account, so every superseded start left a persistent room naming a counselling
  session, never joined and never found again. It is left and forgotten now,
  best effort, and only on the path where no invitation was ever published.
* **The identity capability now follows the opt-in.** A plain Element Web
  embedding of this fork renders upstream's rectangles, so it has no use for
  identity records; it asked for them anyway. Nothing would be delivered in
  practice, since only the ORISO host publishes them — but that is an argument
  about what happens to be in the room, not about what the iframe may see. The
  parameter is required rather than defaulted, and the compiler duly found the
  one call site.
* **A test helper leaked its viewport** when `waitFor` rejected. Restored in a
  `finally`.
* **Step 11 of the reviewer plan said "one account"** and then asked somebody
  else to join. Split: the lifecycle half needs one, the attendance half two.

And one finding **declined**, with reasons on the thread: suppressing ORISO
identity in picture-in-picture. The invariant cited there is about arrangements,
not identity; it would partly undo the earlier spotlight fix, since PiP renders
through the same `SpotlightTile`; and for an anonymous advice seeker the form is
their only representation, so the fallback is the stand-in the design replaced.
The geometry was measured at every PiP size rather than assumed, and a test
records the decision so it can be overturned in one place.

## 22. The fourteenth round: the startup path pays for its edits

Both findings were in `CallManager`'s startup path — the place I had just been
changing — and **the full suite caught a third thing, which was my own fix from
the round before being wrong.**

### The gate I added broke the rejoin it was meant to protect

§21 stopped the reuse branch from reopening a call whose card had been
finalised, by asking `callLifecycleTracker.isTracking(callId)`. That question
cannot tell apart the two reasons a retained `left` call has no tracker:

* **we** started it and already wrote its card as `missed` — reopening it under
  the same id publishes nothing, so a fresh start is right;
* we never tracked it at all because **somebody else** started it. An incoming
  group call's card belongs to the caller, and its room may well still have
  people in it.

The gate refused both, so it broke the one case the branch exists for. A
pre-existing test said so in its name — *rejoins that same group-call room
instead of creating a new call* — and it failed. Not a test I wrote; the suite
earned its keep.

The call now carries `lifecycleFinalised`, set only when `leaveCall` actually
wrote the ending (`finishIfUnattended` reports whether it did). "Did we finish
this card" separates the two cases; "do we still know this call" does not.

### A pending start could be published by a different account

`teardownLocalSession` nulls the Matrix registry but does **not** clear
`pendingStart`, so the ownership check I added still read "this start is
current" after a sign-out. If another account was installed before the await
returned, `callLifecycleTracker.begin` and `sendGroupCallInvite` ran on *that*
account for a room the previous one created — on a shared browser where both
counsellors belong to the session room, the second could publish the first
one's pending call. In a counselling product that is a confidentiality fault,
not an inconvenience.

A pending start now records the account that asked for it, and
`stillOwnsStart` requires identity **and** the same account — a replacement
client for the same account is a token refresh and keeps going, matching how
the tracker follows the account rather than the object. The early
same-parameters dedupe also compares the account, so a stale pending start
cannot swallow another account's click.

I did not clear `pendingStart` from `logout.ts`. It would work, but it puts the
correctness in a place that has already been shown not to cover this; the check
reads the current truth where it is used.

### And the cleanup I added only covered one of two paths

Inside `createElementCallRoom`, three things can throw *after* `createRoom`
succeeded: `inviteSessionMembers` (which throws if any invite failed), the
membership-reader configuration check, and that invite itself. Each threw
before the room id was returned, so the caller's `elementCallRoomId` stayed
undefined and §21's cleanup could not run. Every retry left another **joined**
room carrying the plaintext call/source binding and a name that reads `Group
call for <session room>`.

Post-creation provisioning is now wrapped: discard, then rethrow. The caller's
cleanup covers a start that was *superseded*; this covers one that *failed*.

Also fixed: inserting that helper had orphaned `createElementCallRoom`'s doc
comment — the same comment-displacement mistake as §17's, caught this time by
reading the file rather than by a reviewer.

### And the account check went one place too far

The first version used `stillOwnsStart` in the startup `catch` as well, and a
pre-existing test caught that too, by name: *does not send an old invitation
through a replacement account after root acknowledgement*. After an account
change the error path returned **before** `endCall`, so the previous account's
dead call stayed on screen.

Two different questions live in that `catch`, and the check answers only one:

* a **newer start** owns the surface → leave it alone;
* a changed **account** → the surface is still this request's, and it is now a
  dead call belonging to an account that is gone. It must be cleared. What the
  new account does not get is an alert about the old one's failure.

`stillOwnsStart` is for "may I still publish", not for "should I clean up after
myself". That distinction is now written where the check is used.

### What these two rounds cost, stated plainly

Two commits in a row needed a follow-up, and **one of them went red in CI**:
`ad8c2deebb` broke *rejoins that same group-call room instead of creating a new
call*. Both breakages were invisible to the tests written for the fix and
visible to the pre-existing suite — the targeted test proves the new behaviour,
the old suite protects the behaviour already paid for.

The cause is procedural, not conceptual: those commits were pushed while the
full suite was still running, because an idle session is pressed to commit.
Running the gate to completion first is slower by one suite and would have cost
nothing; it is what the remaining work does.

## 23. Where both branches stand, and what is still unverified

**Gates, on the pushed heads.**

| | fork `ddf443a0` | host `81b3881f3` |
|---|---|---|
| types | clean in `src/` | `tsc` clean |
| eslint | clean, `--max-warnings 0` | clean, `--max-warnings 0` |
| stylelint | n/a | clean |
| prettier | no drift from this branch | n/a (not in the gate) |
| knip | clean | n/a |
| build | ✓ | ✓ |
| unit tests | 648 passed, 19 failed | 13014 passed, 0 failed |

The fork's 19 failures are **pre-existing**: nine files, identical on pristine
`main`, none of them under `src/oriso`, `src/grid` or `src/tile`. They were
measured on `main` rather than assumed.

**Also re-verified on this state, not inherited from an earlier round:**

* `scripts/verifyCallRoomMatrixRules.mjs` against a real Synapse — all 17
  checks held, including that a participant at level 0 may send
  `m.room.encrypted`, that they may not write another user's state key, that a
  newcomer cannot read an identity sent before they joined (which is why
  everybody re-announces), and that a call room's state holds no identity
  record at all.
* All ten harness plates re-shot in Chromium, every handoff measurement
  holding: the fields' artwork at 0.558–0.562 of the form against the handoff's
  0.560, the Einzelgespräch halves at 0.256 against 0.256.
* Every review thread on both pull requests — 40 and 40 — carries a reply.

**What cannot be verified from this container, and is therefore not claimed.**

A live call HAS now been made — four people, real media, the fork's own
design. See §24, which also says what that call could not reach: everything on
the host's side of the widget boundary, because there is no ORISO backend and
no Keycloak here. The host's reviewer plan stays unverified except for the
Matrix rules, and #780 should not be called covered until somebody has run
both plans against a deployment and written down what happened.

Three classes of defect found in this review are invisible to every check in
either repository, and all three are CSS: a rule hidden by a media query jsdom
does not apply, a hit target jsdom cannot test, and a shadow nothing here
paints. Stylesheet tests now pin what can be stated as text. The rest is a
reviewer with a browser.

## 24. The fifteenth round: the live call, which turned out to be possible

Every round before this one ended with the same sentence — no live call can be
made from here — and that sentence had never been tested. It was wrong.

There is no Docker daemon in this container, which is what I had been reading
as the boundary. But there is Go 1.24.7, there is cargo 1.94.1, and
`proxy.golang.org`, `index.crates.io` and `registry.npmjs.org` are all
reachable (GitHub release downloads are not, which is what made this look
closed). So the stack was built rather than pulled:

* **LiveKit 1.13.10**, built from the module cache — `go install` trips over
  the repository's `replace` directives, so the module zip was extracted and
  built in tree.
* **lk-jwt-service 0.9.0**, which is Rust, not Go, and builds with
  `cargo build --release` in about three minutes.
* **Synapse**, already here from §20's Matrix-rules work. It needed one change:
  MatrixRTC wants delayed events, and in Synapse 1.163 those are switched on by
  `max_event_delay_duration`, not by an `msc4140_enabled` flag.

Two things then had to be true that are not obvious:

* `lk-jwt-service` verifies an OpenID token against `https://<server
  name>:8448`, so a plain-HTTP Synapse needs a TLS terminator on the
  federation port and a hosts entry — and the service has to run **without**
  this container's `HTTPS_PROXY` in its environment, or reqwest sends the
  local connection through the agent proxy and it is reset.
* A call room needs `org.matrix.msc3401.call.member: 0` in its power levels.
  Without it every participant but the room's creator is refused when
  MatrixRTC writes their membership, and the call dies with "Connection lost"
  — which is live confirmation that the host's room provisioning
  (`CallManager.createElementCallRoom`) is load-bearing rather than decorative.

### What the call showed that nothing else could

`scripts/verifyLiveCall.mjs` in the fork makes the call and checks six things,
and fails loudly rather than producing a pretty screenshot of something wrong.
Against the local stack, all six hold:

1. Each person wears the colour and animal **their own client published** —
   `#165E83` with the otter, `#F0908D` with the fox, read back off the
   rendered tile rather than off the event.
2. Somebody who joins a call in progress sees the other two as their animals,
   not as initials.
3. The call room's state holds **no** identity: twelve state events, none of
   them `org.oriso.call.identity`.
4. The view rail is on screen at 390×844 with four people in the call, with
   all three views on it, and no form runs off the edge.
5. A form's square tile box does not swallow the clicks around it: every tile
   root computes `pointer-events: none`, and all four corners of each square
   fall through.
6. The spotlight still reserves exactly 32px for the halo on every side —
   `HALO_ROOM_PX`, measured against `SpotlightTile`'s clipping scroller, with
   the speaking ring and glow lit in the speaker's own colour.

A fourth person publishes nothing on purpose, and gets initials in their own
palette colour. That is the "we were not told" path, and it is as much part of
the design as the animals.

### Two things the attempt corrected about my own understanding

**The re-announce is not an optimisation; it is the whole mechanism.** The
widget client backfills `receiveState` only — `embedded.ts` reads room state
on start and has no path at all for timeline history. So an identity published
before somebody's call surface existed never reaches them, by construction,
and the host's `republishCallIdentity` on arrival is what makes a late joiner
possible rather than a nicety. The SPA shows the same thing from the other
side: a fresh client's sync window here was ten events, all of them MatrixRTC
membership, with the identity events already pushed out of it.

**A test can fail on correct behaviour.** My first version of check 5 asked
that "a click reaches the form you aimed at", and it reported half the points
missing. They were not missing: where two forms genuinely overlap, the one
painted on top rightly wins, and the sampling could not tell that apart from a
square box stealing the click. The property is about the box, not about which
form wins, and the check now says so.

Three findings in this round turned out, on measurement, not to be findings at
all: an artwork that looked clipped at the Einzelgespräch seam (both are 134px
and symmetric about the centre, 63px clear of it), a form that looked cut off
at the right edge of a phone (every tile measured fully inside, overflow 0),
and clicks that looked stolen by a neighbour (the page was reconnecting behind
a backdrop that correctly takes pointer events). Eyeballing a screenshot
produced three false alarms in one session; each was settled by reading the
numbers back out of the browser.

### What this still does not cover

Everything on the host's side of the widget boundary. The call above runs the
fork in standalone mode against Synapse directly, because the ORISO frontend
needs a backend and a Keycloak that are not here. So the matryoshka transport,
the notepad, the timeline card and the lifecycle all remain for a reviewer
with a deployment, exactly as the host's plan lists them.
