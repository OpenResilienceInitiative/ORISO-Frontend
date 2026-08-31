# Problem brief — #1154 i18n consistency

- **Source**: [ORISO-Frontend#1154](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1154). Takeover after [#1227](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1227) — signup still mixed-language.
- **Problem**: Advice seekers who pick French, Russian, Tigrinya (or expect Ukrainian) still see German/English on registration, navigation, and counselling topics. Repo catalogues for `fr`/`ru`/`ti`/`tr` are complete; production still mixes languages.
- **Goal**: Selected UI language stays consistent on the advice-seeker path, especially signup, without one oversized PR.

## Acceptance criteria

- [ ] Weblate overlay cannot replace a complete bundled catalogue key with a stale English/German value.
- [ ] Registration preselected-topic summary uses the same locale-aware helper as the topic list.
- [ ] Registration chrome (`t(key, 'German…')` defaultValues) no longer bypasses `fallbackLng`.
- [ ] Scan + slice list is on #1154 as sub-issues; each slice has its own PR.
- [ ] `npm run test:unit` (touched tests), `lint:scripts` pass on each PR.

## Constraints / non-goals

- Do not dump all remaining copy into one PR.
- Agency names stay API proper nouns.
- Ukrainian (`uk`) is not in `supportedLngs` — follow-up, not this stack.
- Träger consent body language is AgencyService content, not this repo.

## Affected area

`src/i18n.ts`, `src/utils/`, `src/components/registration/` (header, zipcode, consent, preselection).

## Toolchain

`npm run test:unit` · `npm run lint:scripts` · `npm run lint:style` · `npm run build` (Node 22.12.0).

## Open questions

None blocking. Ukrainian and API age-option labels are follow-up sub-issues.
