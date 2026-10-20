# Call v2 — the super plan

**Goal.** Make a real call, in the new design, without building a second
Element Call beside the one we have.

**Decisions already taken by the product owner** (2026-10-16):

1. The design components **move into the fork**. `oriso-elementcall` becomes
   the single home of Hain, Felder, Einzelgespräch, Atmosphäre, Notizen and
   the view switcher. ORISO-Frontend keeps only what the chat itself needs.
2. The new design **replaces everything, video included**. A camera feed is
   painted into the same shapes the animals use; there is no second look.
3. Delivery is **two pull requests under one epic issue** — one against
   `oriso-frontend:dev`, one against `oriso-elementcall:main`.

Everything below follows from those three.

---

## 1. What is actually there today

### 1.1 The fork (`oriso-elementcall`, Element Call 2.0.8 local / 2.0.11 remote)

The in-call tree is `src/room/InCallView.tsx`. It renders a `Grid`
(`src/grid/Grid.tsx`) with a `Tile` component and a `CallLayout`.

| Concern | Where | Note |
| --- | --- | --- |
| Tile face (avatar, video, name, hand) | `src/tile/MediaView.tsx` | **Shared by both tile kinds.** The single best seam. |
| Tile renderer swap | `Tile` useMemo in `InCallView.tsx` (~583–625) | Passed as `Tile` to `Grid`, so it covers *every* layout. |
| Layouts | `src/grid/{GridLayout,OneOnOneLayout,SpotlightLandscape,SpotlightPortrait,SpotlightExpanded}.tsx` | Each exports a `make…Layout` returning `CallLayout`. |
| Layout registry | `layouts` map in `InCallView.tsx` (~628–641) | |
| Layout selection | `layoutMedia$` in `src/state/CallViewModel/CallViewModel.ts` (~1068–1130) | A `switch (windowMode)`. |
| User's layout choice | `src/state/CallViewModel/LayoutSwitch.ts`, `GridMode = "grid" \| "spotlight"` | **Binary.** Three ORISO views do not fit without widening this. |
| Controls | `src/button/Button.tsx` wrappers + the `buttons` array in `InCallView.tsx` (~709–770) | |
| Theme | Compound tokens; `src/oriso-theme.css` | **Generated** by ORISO-Frontend's `scripts/generate-call-theme.ts`. Hand edits are reverted by a drift test. |
| Boundary guard | `src/matryoshkaBoundary.test.ts` | Asserts `GroupCallView`/`InCallView` use only standard Widget API actions. **The redesign must stay inside that.** |

### 1.2 ORISO-Frontend

- **`GroupCallWidget` is the only Element Call surface**, despite its name.
  `CallManager` sets `usesElementCall: true` unconditionally, so every
  outgoing call goes there.
- `FloatingCallWidget` (724 lines) is the **legacy 1:1 path** and largely
  dead: it returns `null` for Element Call, and its outgoing branch can
  never run. `FloatingCallWidget.OLD.tsx` and `.PROFESSIONAL.tsx` are
  imported nowhere.
- `MatrixCallView` is a second legacy 1:1 UI on the route
  `/videoanruf/:roomId/:type` — a duplicate of `FloatingCallWidget` with a
  different surface.
- The iframe has exactly one seam: `useElementCallWidget.ts` builds the URL
  in `prepare()` and wires postMessage in `attachIframe()`; the only
  `<iframe>` is in `GroupCallWidget.tsx`.
- The call stage tree I built (`src/components/call/{stages,atmosphere,atoms,engine,notes,stage}`)
  has **zero production importers**. Stories and tests only.

### 1.3 Two defects found on the way, both real

- **The timeline "Beitreten" button does not join.** `useJoinVideoCall`
  opens `/videoanruf/<room>/<video|voice>` without `answer=true`, so
  `MatrixCallView` **starts a new legacy call** instead of joining the
  running Element Call. This is precisely the "ich sehe dass die anderen
  drin sind und gehe rein" case.
- **The timeline entry may be unreachable.** `VideoChatDetails` renders only
  for `messageType === VIDEOCALL`, and no frontend code produces that alias
  message. Whether the backend emits it is unverified and must be checked
  before we build on it.

---

## 2. The pivotal problem: identity across the boundary

The design's first rule is that identity is **inherited, never derived** —
the same animal, background and ink a person has everywhere else in ORISO.

What we found:

- `generateAvatarForUser(userId)` (`src/utils/anonName/engine.ts:286`)
  derives animal, `bg` and `iconColor` **deterministically from the user
  id**. A pure, dependency-free module.
- But `chosenAvatarOf` (`src/utils/avatarChoice.ts`) shows the real source
  is **stored metadata** — `avatarKind` (`ICON` / `INITIALS` / `PICTURE`)
  and `avatarId` — delivered by the **userservice backend**, not Matrix.
  Counsellors pick a motif; that choice is not derivable from anything the
  fork can see.
- The fork today receives avatars only as **Matrix member avatars** via
  MSC4039 `download_file`. That is a bitmap, and it is not the same thing.

So the fork cannot compute the right identity, and re-deriving it would be
exactly the "you define it in the call" mistake we were told to avoid.

**Three candidate transports** (this is the one architectural decision left):

| | How | Cost | Risk |
| --- | --- | --- | --- |
| **A** | Each client publishes its own identity in its **MatrixRTC membership** (`org.matrix.msc3401.call.member`) | Small. The widget already *sends* that state event for its own key and already *receives* it for everyone. No new capability. | Membership event grows; needs a schema agreed with the backend/other clients. |
| **B** | Pass a **roster** over the widget API from ORISO | Medium | `matryoshkaBoundary.test.ts` forbids non-standard actions; would need a sanctioned channel. |
| **C** | ORISO publishes the animal as the **Matrix member avatar** | Small on the fork side | Loses `bg`/`iconColor` as data, loses recolouring, and the SVG becomes a bitmap. Breaks the design. |

**Recommendation: A.** Identity travels with the membership, each client
publishes only its own, and the fork reads what it is given rather than
deriving anything. `generateAvatarForUser` stays as the *fallback* for a
member that published nothing, never as the primary source.

---

## 3. The work, in order

### Phase 0 — Make the truth visible (no behaviour change)

**0.1 — open.** Verify the backend emits `VIDEOCALL` alias messages. If not,
the timeline entry is dead code and the join path needs a different
trigger. *Blocked here: ORISO-UserService returns 403 for this session.*

**0.2 — VERIFIED, and it is worse than suspected.** The fork's ORISO
override of the speaking indicator is dead, for two independent reasons:

```
src/index.css:127   .tile.speaking::before { background: var(--video-tile-background) }
src/index.css:132   .tile.speaking        { outline-color: var(--video-tile-background) }

src/tile/GridTile.tsx:160          [styles.speaking]: showSpeaking   ← CSS module
vite.config.ts                     no css.modules.generateScopedName ← hashed names
```

1. The override uses **global** class names; the tile emits **hashed**
   module names. The selector can never match.
2. Even if it did, upstream wins anyway:
   `GridTile.module.css:30` sets
   `outline: … solid var(--cpd-color-bg-canvas-default) !important`,
   and ORISO's rule carries no `!important`.

So a speaking tile today renders **upstream's black gradient ring**
(`GridTile.module.css:34, background: #000`) — the exact "the system marked
her red" treatment the design rejects, and the opposite of the own-colour
halo the handoff specifies. Fixing this is not a tidy-up; it is part of
2.3.

**0.3 — VERIFIED, low severity.** The drift is exactly four tokens the
generator does not emit — `--cpd-color-text-primary-alpha` and
`--cpd-color-text-secondary-alpha`, light and dark — plus one lost comment.
**Nothing in the fork reads them** (`grep` over `src/`, excluding the
generated file, returns nothing). They are dead CSS that will silently
vanish on the next regeneration. Delete them rather than teaching the
generator.

### Phase 1 — Consolidate the prior call work (ORISO-Frontend)

*Sequencing from the PR assessment — see `01-pr-assessment.md`.*
In scope: #1361 (closed, 131 files), #1395, #1394, #1390, all under #780.

### Phase 2 — Move the design into the fork

2.1 Port the pure engine first: `engine/layout.ts` (packShapes,
    organicSpots, splitCells, seeded), `stages/felder.ts`,
    `stages/einzelgespraech.ts`, `halo.ts`, `avatarLift.ts`. No React, no
    DOM — these port verbatim with their tests.
2.2 Port `pond.js` and the `Atmosphere` wrapper. Already verbatim; it moves
    as-is, with its loop-rule tests.
2.3 Replace the tile face: `MediaView` renders the ORISO shape — animal (or
    **video, cropped to the same shape**) with the name capsule, the lift
    and the speaking halo.
2.4 Add three `CallLayout` modules — Hain, Felder, Einzelgespräch — beside
    the existing ones, register them in the `layouts` map, and select them
    in `layoutMedia$`.
2.5 Widen `GridMode` beyond binary and replace `LayoutToggle` with the
    ORISO `ViewSwitcher` (44px rail, 36px buttons, the measured numbers).
2.6 Port the Gesprächsnotizen panel, docked, with its privacy test intact.

### Phase 3 — Identity transport

3.1 Agree the membership schema (decision in §2).
3.2 Publish from ORISO, read in the fork, fall back to
    `generateAvatarForUser` only when nothing was published.
3.3 Test: two participants, one counsellor with a chosen motif, one
    anonymous seeker — both must look exactly as they do in the chat.

### Phase 4 — Delete the duplicates

Only after the new path works end to end:
`FloatingCallWidget.OLD.tsx`, `.PROFESSIONAL.tsx`, and — pending a decision
— the legacy 1:1 pair (`FloatingCallWidget` + `MatrixCallView`), plus the
`startRoomCall` / `GroupChatHeader` split and the two avatar stacks.

### Phase 5 — Ship

Two PRs against an epic issue, with the hard gate on both:
`test:unit`, `lint:scripts`, `lint:style`, `build`.

---

## 4. Risks, stated plainly

- **Phase 2.3 is the whole redesign in one component.** `MediaView` is
  shared by every tile in every layout; getting it wrong breaks all of them
  at once. It also means the blast radius is one file, which is the good
  half of the same fact.
- **Video in organic shapes is unproven.** The handoff shows video tiles in
  the Felder; it does not show video in a Hain blob or in a bowed half. A
  `clip-path` on a live video element at 30fps is a performance question,
  not just a visual one. This needs a measured spike before 2.4.
- **Widening `GridMode`** touches auto-switching behaviour (screen share
  forces spotlight today). Three views make that rule ambiguous.
- **The matryoshka boundary test** will fail the moment the redesign reaches
  for a non-standard widget action. Identity transport must respect it —
  which is the main argument for option A.
- **Two repos, one feature.** Until both PRs land, neither is useful alone.
