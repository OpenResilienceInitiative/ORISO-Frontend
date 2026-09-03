# Spike — #1154 remaining gaps

## Current behavior

- i18next + chained backends: localStorage → Weblate fetch → bundled JSON (`src/i18n.ts`). Fallback locale is `de`.
- Bundled UI locales: `de`, `de@informal`, `en`, `fr`, `ru`, `ti`, `tr` (`config.ts` `supportedLngs`). **No `uk/` bundle.**
- PRs already merged: [#1164](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1164) consultingTypes per locale, [#1170](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1170) fr/ru/ti/tr backfill, [#1227](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1227) topic catalogue + Weblate empty-vs-absent gate.
- Topic list uses `getRegistrationTopicDisplay()` (`registrationDesign.ts:752`). Preselected topic does **not** (`PreselectedTopic.tsx:45` → API `titles.long`).
- Weblate parse does `_.merge(bundle, weblate)` (`i18n.ts:209-212`) so Weblate **overwrites** the complete repo catalogues.

## Root cause / gap

Signup still mixed after #1227 because:

1. **Weblate wins on conflict** — a partial/stale Weblate file (English placeholders, German source) replaces bundled French/Russian/Tigrinya.
2. **Preselected topic** always shows backend German titles.
3. **German `defaultValue`s** on header, compact stepper, zipcode, consent — visible whenever a key is missing or emptied.
4. Age/state option **labels come from ConsultingTypeService** (German). Out of this stack.
5. **Ukrainian is not a UI locale** — only a spoken-language label.

## Approach

Small stacked PRs, independent files where possible. Prefer **bundle over Weblate on key conflict**; Weblate still fills keys the bundle lacks. Do not re-translate 3000 keys.

## Files likely to change

| Path                                                                | Intent                             |
| ------------------------------------------------------------------- | ---------------------------------- |
| `src/utils/mergeWeblateCatalogue.ts`                                | Bundle-wins merge helper           |
| `src/i18n.ts`                                                       | Use helper in FetchBackend `parse` |
| `src/components/registration/preselectionBox/PreselectedTopic.tsx`  | Use `getRegistrationTopicDisplay`  |
| Registration header / CompactStepRow / ZipcodeInput / consent files | Drop German defaultValues          |

## Risks

- Weblate-only languages with no bundle still work (`bundle` empty).
- Cache: proxy disables translation cache by default; if enabled, old merges linger until TTL.

## Test strategy

- New unit tests for merge helper (conflict, gap-fill, empty Weblate).
- PreselectedTopic render: French catalogue title beats German API title.
- Header/zipcode/consent: `t(key)` without German defaultValue; missing key follows `fallbackLng`.
