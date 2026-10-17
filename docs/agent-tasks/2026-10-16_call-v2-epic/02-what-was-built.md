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
