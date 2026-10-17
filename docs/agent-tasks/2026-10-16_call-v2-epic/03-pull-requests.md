# Call v2 — the two pull requests and the epic

**All three are open.**

| what                                     | where                  |
| ---------------------------------------- | ---------------------- |
| Epic                                     | `ORISO-Frontend#1774`  |
| Fork — the design                        | `ORISO-ElementCall#83` |
| Host — consolidation, presence, identity | `ORISO-Frontend#1775`  |

Land the fork first: the host's new state event is inert until something
reads it, while the fork without the host shows initials.

**One thing a human has to finish.** `ORISO-ElementCall#83` has **no
reviewers requested** — the permission layer in this session refused that
call against that repository, while the identical call succeeded on
`#1775`. The delivery rules say a pull request without requested reviewers
is not open for review, so that one needs `hasanbarisgok`, `Shirloin` and
`shazia-k` added by hand.

An earlier version of this file said AGENTS.md requires confirmation
before a pull request goes up. It does not: it says delivery _ends_ at a
pull request open with evidence, a reviewer test plan and reviewers
requested, and it forbids only merging.

The bodies below are what was posted.

Branches, ready and pushed-pending:

| repository          | branch               | base   | commits                                                    |
| ------------------- | -------------------- | ------ | ---------------------------------------------------------- |
| `oriso-frontend`    | `feat/call-engine`   | `dev`  | the call stage work, plus #1394, #1390 and #1395 merged in |
| `oriso-elementcall` | `feat/oriso-call-v2` | `main` | 6                                                          |

The two are useless apart: the host publishes the identity the fork reads,
and the fork draws the design the host embeds. They should land together,
fork first — the host's new state event is inert until something reads it,
while the fork without the host shows initials.

---

## PR 1 — `oriso-elementcall:feat/oriso-call-v2` → `main`

**Title:** The ORISO call design, through the one seam the fork has

**Body:**

Element Call renders every tile in every layout through `MediaView`. This
branch branches there: with an ORISO identity the tile is a form in the
person's own colour carrying their own animal, and the camera, when it is
on, is cropped into that same form. Without one it renders upstream's
rectangle, byte for byte. One tile implementation, not two — the lobby,
the standalone build and every existing test keep working, and there is no
second call UI to drift.

### What is here

- **The engine, ported verbatim** with the tests that pin it: `packShapes`,
  `organicSpots`, `splitCells`, `ownShape`, `seeded`, the Felder ordering
  rule, the Einzelgespräch's share and bow, the speaking halo, the lift
  that scales with a shape. The tests assert golden values, so a port that
  merely looked right fails them — which is what happened the first time
  these were reimplemented from their prose description.
- **Two layouts join the registry**, three stay upstream's. The grove and
  the fields are one layout because they differ only in where the slots go;
  the Einzelgespräch gives both halves the SAME box and cuts them with one
  curve, which is what makes them read as one body rather than two shapes
  that meet.
- **The identity is inherited, never derived.** There is no animal set in
  this repository. The artwork is fetched from the host that embedded the
  call and painted in the ink the host published. A member who published
  nothing gets **initials**, not an animal derived from their user id —
  that would look like success and be the one thing the handoff forbids.
- **The living backdrop**, `pond.js` ported verbatim, behind the whole
  call and announced to nobody.
- **The view switcher** replaces `LayoutToggle`: a 44px rail of 36px
  buttons where only the active entry spells out its name, which is also
  what makes it survive greyscale and a colour-blind reader.
- **Upstream's black gradient ring is suppressed** on an ORISO tile.
  ORISO's own override of it never worked: it targeted global
  `.tile.speaking` while the tile emits hashed CSS module names, and
  upstream's rule carries `!important` where ORISO's did not.

### How the two awkward pieces travel

The form reaches the tile through a **subscription store**, not React
state: `useUpdateLayout` bumps a generation on every render of a layout,
`Grid` re-renders on that, and a context change re-renders the layout
straight through `Grid`'s `memo`. React stopped the first version with
"Maximum update depth exceeded". Identities use `useState` plus an equality
check rather than `useRoomState`, for the same class of reason — that
hook's `getSnapshot` must return a stable value and this mapping builds a
Map.

`Grid` itself is untouched. The layouts place invisible slots and `Grid`
springs the real tiles into them, so the motion, the dragging and the
spotlight all keep working.

### Evidence

**Verified: local only.** No Pre-Dev deploy, no E2E against a server.

- `yarn lint:types`, `yarn lint:eslint`, `yarn lint:knip` and `yarn build`
  all pass. **All three lint checks were failing on `main` before this
  branch** — 7 type errors and 4 eslint errors in `src/`, from dependency
  drift and from ORISO's own earlier edits. They are fixed in two commits
  of their own.
- 568 tests pass, up from 421. The **19 failures are the ones `main`
  already had**, unchanged: React-useId and compound-web hash drift in
  committed snapshots, plus two behaviour tests. `vitest -u` was tried and
  reverted — it also deletes the Element logo, the "Element Call Home" link
  and react-router's `data-discover` from those snapshots, which are
  structural changes nobody has reviewed.
- Ten plates shot in Chromium and **measured**, not just looked at:
  `scripts/shootOrisoStage.mjs`. It checks nine distinct blob radii at nine
  people, no plain circles, the speaker's halo in their own colour and not
  black, 22px field corners with no lean and no sphere shading, two halves
  sharing one box with two clips and no lift of their own, a 44px rail of
  36px buttons with exactly one word on it, and a backdrop canvas that
  really exists.
- Video in an organic shape, measured: 16.7 ms median and 33.4 ms p95 in a
  grove blob and in a clip path, identical to plain square frames, on a
  software rasteriser. `scripts/measureVideoInShape.mjs`.

### Reviewer test plan

1. `yarn install && yarn lint && yarn build` — all green.
2. `ORISO_ARTWORK_DIR=<oriso-frontend>/public/static/anon-animals npx vite --config harness/vite.harness.config.ts`,
   then `node scripts/shootOrisoStage.mjs`. Ten plates in `_shots/`, and
   the script fails loudly if a handoff number stops holding.
3. Open `http://127.0.0.1:6007/harness/orisoStage.html` and look at the
   grove at nine people. Every shape should be a different lopsided form
   with its own lean; round bubbles mean the engine was rewritten.
4. With the host branch deployed: start a group call and confirm each
   person's animal and circle colour match the chat beside it.

### Not in this branch, deliberately

The notepad. Its feature is that nothing it holds ever leaves the device,
and that claim is weaker behind a second boundary — it lives in the host.

---

## PR 2 — `oriso-frontend:feat/call-engine` → `dev`

**Title:** Call v2 — the stage, live presence, and who the call is told you are

**Body:**

The host half of Call v2. It consolidates the four prior pull requests
under #780, adds the one thing none of them had, and tells the call who
everybody is.

### What is here

- **#1394, #1390 and #1395 merged**, in that order. #1361 is **not**
  merged: 131 files, 58 of them conflicted, and its lifecycle core is
  superseded by #1395's.
- **Live presence.** Both prior pull requests built attendance as a union
  that is only ever added to, so somebody who joined, spoke and left stayed
  on the card as if they were still waiting — and #1395 removed the "in the
  call" label outright. The lifecycle message now carries `present` beside
  `participants`: replaced on every membership change, emptied when the
  call ends. A running card answers "who is in there", an ended one "who
  was". Both are true and they are different questions.
- **Identity across the boundary.** Each client publishes its own identity
  as `org.oriso.call.identity`, keyed by its user id. Not the MatrixRTC
  membership, which was the plan until it was tried:
  `MembershipManager.makeMyMembership` is `protected` and built from a
  fixed literal. The widget may **receive** the event and may **not** send
  it — one that could write this could write somebody else's.
- **The notepad**, docked beside the call surface, counsellor-only.
- **A cross-repository contract test.** The record crosses between two
  repositories tested separately, which is the shape of problem where both
  suites stay green and the thing still does not work. It caught a real
  break on its first run.
- 1022 lines of call widget that nothing imported are gone.

### Consequences a reviewer should know

Live presence makes a membership change a **real** timeline update where
the identical payload used to be deduped away. A call now sends one more
edit per join and per leave. That is the feature working.

The jsdom polyfills gained a 2D canvas stub. Without it `getContext('2d')`
returns null, and anything that then draws throws from a module body or a
`connectedCallback` — an unhandled error that collapses a whole test file.
It was taking down the group-call harness through lottie and producing the
pond.js noise this suite has been carrying.

### Evidence

**Verified: local only.**

- `npm run test:unit`: 12985 pass, 8 skipped, 0 fail.
- `npm run lint:scripts`, `npm run lint:style`, `npm run build`: clean.
- `node scripts/shootCallStages.mjs`: 38 plates, every geometry and
  contrast check holding.
- The paired contract test in `oriso-elementcall` pins the same fixtures
  from the other side.

### Reviewer test plan

1. `npm ci && npm run test:unit && npm run lint && npm run build`.
2. Start a group call with two accounts. The timeline card should show
   **only the people currently in the call**, and somebody who leaves
   should disappear from it within one membership change.
3. End the call. The card should switch to the attendance list and show
   everybody who was ever there.
4. **Durable, not just live.** Reload the page with the ended card on
   screen: it must come back with the same state, duration and attendance,
   because it is a room message rather than browser state. Then open the
   same conversation as somebody who was **not** in the call — a
   supervisor with access, or the other account — and check the card reads
   the same there. This is the whole point of #780, and the part that a
   single-browser session cannot show.
5. **A missed call.** Start a call and hang up before the other side
   answers. The card must read **missed**, with no duration — not "ended"
   with the ringing time, which is what it used to do. Leave an unanswered
   group call the same way: it must not sit at "running" with a Join button
   that answers `unavailable`.
6. With the fork branch deployed: check that each person's animal and
   circle colour in the call match the chat beside it, and that a
   counsellor with a chosen motif shows the motif on the tenant's brand
   colour rather than an animal. Check this for a participant who did
   **not** create the call room — that is the case the power-level grant in
   `createElementCallRoom` exists for, and the case that was silently
   falling back to initials.

Steps 4, 5 and 6 need two accounts and a deployed fork; none of them can be
reached from this container, and #780 should not be called covered until
somebody has run them and written down what happened.

### Not in this branch, deliberately

The `scheduled` state, the calendar action and the notification-centre
entries from #1361: no producer exists on either side, so the UI would be
dead code. The call notification emails: `dev` already carries 126
`anruf-*` templates with different content, and which set ships is a
product decision. The legacy 1:1 pair: still mounted, and removing it needs
the new path verified end to end first.

---

## The epic issue

**Title:** Call v2 — the dynamic call views, end to end

**Body:**

Closes the design handoff "Dynamische Call-Ansichten" and consolidates the
call work that has been sitting in four pull requests under #780.

The goal, in the owner's words: _"ich will am Ende im neuen Design
telefonieren können"_, without building a second Element Call beside the
one we have.

**Two pull requests, which are useless apart:**

- `oriso-elementcall` — the design, through `MediaView`, the one seam the
  fork has.
- `oriso-frontend` — the consolidation, live presence, and the identity
  the call is told.

Land the fork first: the host's new state event is inert until something
reads it, while the fork without the host shows initials.

**Supersedes:** #1361 (closed; core superseded by #1395, remainder listed
as open questions below).
**Includes:** #1394, #1390, #1395.

**Decisions taken by the product owner (2026-10-16):** the design
components move into the fork; the new design replaces everything, video
included; delivery is two pull requests under one epic.

**Still open, and each one changes what gets built:**

1. Does Call v2 want the **scheduled** state at all? It has no producer on
   either side today, and it carries the calendar action and the
   notification-centre entries behind it.
2. Do the **call notification emails** from #1361 belong here, against the
   126 `anruf-*` templates already on `dev`?
3. The handoff's **"Kacheln" icon draws a house**. The fork uses Compound's
   grid icon in the meantime.
4. **Hain overlap at 2, 3, 5 and 6 people.** The packer is the prototype's
   own and the shapes genuinely abut — that is the design, and it is worth
   looking at the screenshots before it ships.
5. **Middle truncation for phones**: five names still truncate on
   `Hain-Handy`.
6. A **tenant setting for the backdrop**. The preset reaches the fork on
   the URL, but there is nothing to put there yet, so every call gets the
   handoff's default.
