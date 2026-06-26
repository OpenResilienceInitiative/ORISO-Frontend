# ORISO · Registration Topic Selection — Material 3 prototype

A standalone sandbox to test the _feel_ of a Material 3 collapsible-list topic picker
for the ORISO registration flow (5 steps: topic → postcode → center → register → message).

Built on the **same stack as `ORISO-Frontend`** (React + MUI v5 + react-i18next) so the
`<TopicSelection />` component lifts straight into production.

## Run

```bash
cd prototypes/registration-md3
npm install
npm run dev      # → http://localhost:5173
npm run build    # type-check (tsc) + production build
```

## What it demonstrates

- **Real Material 3 component, not hand-rolled.** Categories are MUI `Accordion`s, so the
  open/close uses MUI's built-in `Collapse` motion — the standard Material expand animation.
- **Collapsible parent categories** that open/close independently (several can be open at
  once, matching the Figma).
- **Single selection across all categories** (radio semantics) with a **sticky footer**:
  `Zurück` / `Weiter`, where `Weiter` only enables once a topic is chosen and is **always
  visible** — no scrolling to find it.
- A **✓ badge** on a collapsed category that holds the current selection, plus a
  "Ausgewählt: …" summary in the footer.
- **Sensitive values stay in memory only.** Topic, postcode, registration data and the
  free-text request reset on reload instead of being persisted in browser storage.
- **Reworked layout** per feedback: toned-down (muted, lower-chroma) Caritas-red hero,
  compact `REGISTRIERUNG` label + segmented stepper, roomier top bar for language + login,
  left-anchored content.
- **Responsive:** two-pane on desktop, single column + slim brand bar on mobile.
- **6 languages** via react-i18next: `DE` + `EN` fully translated (chrome + categories +
  topic titles + descriptions); `TR` / `AR` / `UK` / `RU` ship chrome + category & topic
  titles, with descriptions falling back through i18next. **Arabic switches the whole UI to
  RTL.**

## Key files

| File                                    | Purpose                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `src/components/TopicSelection.tsx`     | **The reusable MD3 component** — drop into ORISO-Frontend                       |
| `src/components/RegistrationLayout.tsx` | Page shell: hero, stepper header, sticky footer                                 |
| `src/components/LanguageSwitcher.tsx`   | Globe menu, 6 languages, RTL-aware                                              |
| `src/data/topics.ts`                    | Category/topic catalogue (would come from the topic/ConsultingType API in prod) |
| `src/locales/*.json`                    | Translations                                                                    |
| `src/theme.ts`                          | Muted-M3 MUI theme — toned Caritas red + Figma M3 tokens                        |
| `public/icons/`                         | The 29 icons (5 category + 24 topic), copied from the icon set                  |

## Lifting `TopicSelection` into ORISO-Frontend

It is presentation-only and fully controlled (`value` + `onChange`). It uses only
`@mui/material` + `react-i18next`, both already in `@onlineberatung/onlineberatung-frontend`.
To productionise:

1. Replace the static `CATEGORIES` import with the topic / `ConsultingType` API response.
2. Move the `category.*` / `topic.*` keys into the existing i18next resources.
3. Reuse the existing theme (or merge the muted-M3 roles from `theme.ts`).

## Recent iteration

- **Classic Caritas-CI red** hero gradient (`#CC1E1C` family) with a subtle, mouse-tracked
  white sheen; the red panel widens on large screens (`clamp(340px, 42vw, 720px)`).
- **Real partner logos** as a white-monochrome block (Caritas / SKM / Malteser were
  recoloured to white-on-transparent variants in `public/logos/`).
- **Icon stepper** (`RegistrationStepper.tsx`): Thema · Ort · Konto · Fertig, sticky on top.
- **Deletable selection chip** in the footer — the ✕ clears the step's value.
- Categories reordered for colour harmony: Familie → Alter → Soziales → Gesundheit → Migration.

## Known limitations / next steps

- **Top bar + stepper are sticky; only the list scrolls.** The multi-step _linear jump-back_
  (deleting an earlier step's chip should return you to that step) is wired conceptually —
  on this single step the ✕ just clears the selection.
- **Stepper labels** (`reg.stepNames.*`) and step icons are a first pass — confirm the real
  step names/order for the full registration flow.
- **RTL** covers layout mirroring + text direction. For pixel-perfect RTL paddings, add
  `stylis-plugin-rtl` + an Emotion RTL cache (one-time wiring).
- `TR/AR/UK/RU` descriptions are fallback English — wire your translation source for the rest.

Figma reference: App.Oriso · node `7642-31346`.
