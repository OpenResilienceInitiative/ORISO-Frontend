# Transactional e-mail kit

22 occasions, seven language/tone variants, two MIME parts — built from one
atomic component set and previewed in Storybook under `Email/`.

```
kit/        atoms → molecules → organisms → document, plus the two renderers
content/    the copy, one file per variant, plus the translation manifest and ledger
preview/    Storybook-only harnesses (iframe preview, inbox line, token sheet)
stories/    Email/Foundations, Email/Atoms, Email/Molecules, Email/Organisms, Email/Pages
scripts/    buildEmails.mts — emits dist/; syncEmailTranslations.mts — stamps the manifest
dist/       generated, committed: emails/<tone>/<id>.{html,txt}
```

## Why this is separate from the app component library

Same design language, completely different rendering rules. E-mail clients
cannot read CSS custom properties, so no token can be a variable at runtime —
every colour and size is inlined as a literal. Layout is tables. There is no
JavaScript, and no webfont is loaded.

Everything is therefore prefixed `email…` and lives under `Email/` in Storybook,
so the two libraries can never be mistaken for each other.

## Working on it

```bash
npm run storybook          # preview every atom, molecule, organism and page
npm run emails:build       # regenerate dist/
npm run emails:sync        # re-stamp the translation manifest, list unsigned claims
```

`dist/` is committed on purpose: after changing an atom, `git diff` shows every
mail that atom touches. That diff is the review surface.

## Languages

German is the source. Everything else is a derivative, and the rules that keep
it from rotting are in **ADR-022**; the short version:

| Variant | Copy from | Send-ready |
| --- | --- | --- |
| `de-sie` | source | yes |
| `de-du` | human (tone variant) | yes |
| `en` | human | yes |
| `fr` `ru` `ti` `tr` | machine | **not yet** |

- **Changing a German string costs five translations.** The manifest records
  what each translation was made from; the test suite recomputes it. A German
  edit without its translations turns the build red, and `emails:sync` refuses
  to re-stamp it (`--force` if the edit genuinely does not reach a language).
- **A machine-translated variant produces no files.** It renders in Storybook —
  `Email/Foundations → Translations` and every page story — but nothing under
  `dist/`, no Keycloak bundle, no MailService template, until the strings that
  make a *claim* have a signature in `content/translationReview.json`.
- **A claim is:** the encryption promise (`assurance`, on every mail), the two
  privacy paragraphs, and the DPA mail in full. The list is
  `EMAIL_PROTECTED_EXTRA` in `content/emailCatalogue.ts` — about 18 strings per
  language, not 22 mails.
- `de@informal` is a **tone**, not a language. Whether the four new languages
  need a second tone is a separate decision (ORISO-Frontend#1065).

## Rules the copy has to keep

- **Anonymity.** A mail to an asker names no message content, no person and no
  counselling centre. The two exceptions — `termin` and `beraterin-kontakt` —
  are allowed only because the recipient triggered them. `anfrage-zugewiesen`
  goes to a counsellor, not an asker.
- **One action per mail.** The button is the action; anything else is a text
  link at lower weight.
- **The subject and preheader are the risky part.** They show up on a lock
  screen. Neither may reveal the topic.
- **The encryption promise closes every card.** The mail is the one part of the
  product that is not encrypted and not behind a login, so that is exactly where
  the promise has to be restated.
- **"Träger"**, never "Mandant".

## Mobile

The `<style>` block in `emailDocument` is the only non-inline CSS, and exists
only for the `max-width:620px` media query. Clients that strip it (the Gmail
Android app on non-Gmail accounts, most notably) fall back to the desktop table
layout, which still renders — the media query only ever improves narrow
viewports, it is never load-bearing.

Below the breakpoint it releases the fixed 600px column, trims the canvas
padding, stretches the CTA to the full column, stacks the data panel's
label/value pairs, and lets the footer links wrap. Panel values and the footer
contact line additionally get `word-break:break-word`, because e-mail addresses
and street names are unbreakable tokens wide enough to force horizontal
scrolling at 320px.

Every page has `Phone (375px)` and `Narrow phone (320px)` stories. Check those
before changing spacing.
