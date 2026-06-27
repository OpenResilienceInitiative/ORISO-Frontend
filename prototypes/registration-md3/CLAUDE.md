# CLAUDE.md — ORISO topic-selection prototype

## How Frank likes to work here (important)

Propose → show it **visually** → then proceed. Build the smallest coherent slice,
run it / screenshot it so Frank can react to something real, and end with a short
check-back question on direction before expanding scope. He explicitly values that
I _don't_ "just do things" and batch many speculative changes — small reviewable
increments with a visual checkpoint are "genau die richtige Portion". Asking a good
clarifying question is a feature, not friction.

## What this is

A standalone sandbox to test the _feel_ of a Material 3 collapsible-list topic
picker for the ORISO registration flow. Same stack as `ORISO-Frontend`
(React + MUI v5 + react-i18next) so `TopicSelection.tsx` lifts into production.

Run: `npm install && npm run dev` → http://localhost:5173 · `npm run build` to type-check.

## Conventions / decisions

- **Material 3 via MUI v5** — `Accordion` (built-in `Collapse` animation), `List`,
  `Radio`. No hand-rolled animations.
- **Colour:** hero = classic Caritas CI red (`#CC1E1C` family, see `theme.ts` `md3.heroGradient`)
  with a subtle mouse-tracked white sheen; primary action = a slightly muted red `#A4262E`.
  M3 surface/secondary tokens come from Figma node `7642-31346`.
- **Category order is deliberate** (colour harmony, warm→cool, greens grouped last):
  Familie → Alter → Soziales → Gesundheit → Migration. Don't reorder without reason.
- **Partner logos** live in `public/logos/` as the **native brand SVGs** (caritas =
  red box, SKM = white box, Malteser = red+white shield, rest white) — NOT recoloured.
  Layout per Figma node `7642:36404`: two **bottom-aligned, centered** rows, logos at
  **55px** (Raphaelswerk **64px**), row-1 gap 32px / row-2 gap 26px. The caritas red box
  reads against the **dark bottom** of the hero gradient — keep logos low in the hero.
- **Layfinal chrome:** sticky top bar + sticky icon stepper (only the list scrolls),
  static footer with a deletable selection **chip** (the ✕ clears the step's value).

## Registration steps (5-step flow)

1. **Fokus wählen** (topic) · 2. **Postleitzahl** · 3. **Beratungsstelle** (consulting center) ·
2. **Registrieren** · 5. **Anfrage stellen** (message composer; the animated send/preload is
   ORISO-Frontend issue #256).

Each step is its own component: `TopicSelection`, `PostcodeStep`, `ConsultingCenterStep`,
`RegisterStep`, plus an inline message step in `App.tsx`. All values are **controlled in
`App.tsx`** and kept **in memory only** so sensitive counselling/registration context is not
left behind in browser storage on reload. The stepper is **clickable** up to
the highest step reached (`maxStep` prop → `onStepClick`); the "Schritt X von Y" text was
dropped (the visual stepper conveys it). Per-step next-button label via `nextLabel`
(Weiter / Registrieren / Anfrage senden). `RegisterStep` exports `isRegisterValid` + a
`RegisterValues` type — App uses them for the Continue gate.

Stepper rules: completed connectors solid, upcoming connectors **dotted**; on mobile the
row scrolls horizontally but the **current step is always kept in the viewport**.

Linear-flow intent: removing an earlier step's chip jumps back to that step
(can't keep a later value once an earlier one is empty). Implemented: `App.tsx` holds
`step` state; step 1 = `TopicSelection`, step 2 = `PostcodeStep`. The topic chip's ✕
(`clearSelection`) sets `selected=null` AND `step=1`. Each step renders its own
`<StepHeading/>` (title/subtitle live in the steps, not the layout).

Backend topic identity = the **slug**, never the placement id (`<categoryId>/<slug>`).
A topic under several categories shares one slug, so the selection resolves to one
unique backend topic regardless of which category card it came from (`App.submittedTopicId`).

Mobile selection chip is centered. The **desktop footer is a CSS grid**
`auto minmax(0,1fr) auto` (back | chip | next): the middle column shrinks reliably so
the chip **truncates (…)** instead of pushing Weiter/Далее off-screen. (A `flex:1`
middle does NOT shrink on overflow — its flex-basis is 0, so use grid `minmax(0,1fr)`.)
Topic icons are **64px** rounded
squares (12px); the **last** icon in each category uses `12px 12px 12px 32px` so its
bottom-left echoes the card's rounded corner. Category icons are **52px** with a 2px
`#1B1B1C` ring. Hero sheen
**drifts** toward the cursor (rAF lerp, factor 0.06) with a white core + warm coral
halo for punch — tune opacity/factor in `RegistrationLayout`.

## Layout model (don't regress — this caused real mobile bugs)

The content column is a **CSS grid**: `gridTemplateRows: 'auto minmax(0,1fr) auto'`
with `height: 100dvh; overflow: hidden`. Header group = row 1, scrolling list =
row 2 (`minmax(0,1fr)` so it can shrink below content and scroll internally),
footer = row 3 (always pinned/visible). Do NOT go back to a flex column with
`flex:1` on the scroller — without a _definite_ height the scroller grows to its
content on mobile, pushing the footer off-screen (`overflow:hidden` then clips it)
and killing scroll. The footer is "total wichtig" and must always be visible.

Testing caveat: the Playwright/headless Chrome here **clamps its window to ~585px**
and CDP `setDeviceMetricsOverride` doesn't truly reflow below that, so true ~390px
phone width can't be rendered in-tool — verify real mobile on an actual device.
Also: never `npm run dev | head` — the pipe SIGPIPE-kills Vite when head exits.
