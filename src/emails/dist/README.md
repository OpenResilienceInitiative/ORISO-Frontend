# Send-ready e-mail templates

Generated — do not edit by hand. Run `npm run emails:build` after changing
anything under `src/emails/`.

Layout: `<tone>/<id>.html` and `<tone>/<id>.txt`.

Tones: de-sie, de-du, en.
Occasions: neue-nachricht, willkommen, passwort-zuruecksetzen, termin, beraterin-kontakt, anfrage-zugewiesen, systemhinweis.

Both MIME parts are generated from one content model, so the plain-text twin
cannot drift from the HTML. Placeholders use `{{mustache}}` syntax; see
`src/emails/index.ts` for the full list and `Email/Foundations → Catalogue` in
Storybook for which mail needs which.
