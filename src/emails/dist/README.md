# Send-ready e-mail templates

Generated — do not edit by hand. Run `npm run emails:build` after changing
anything under `src/emails/`.

Layout: `<dialect>/<tone>/<id>.<ext>`.

| Dialect | Consumer | Placeholder | Files |
| --- | --- | --- | --- |
| `plain/` | UserService direct-SMTP senders (plain string replacement) | `{{name}}` | `.html` / `.txt` |
| `thymeleaf/` | MailService | `[[${name}]]` | `.html` / `.txt` |
| `freemarker/` | Keycloak e-mail theme | `${(name!'')?html}` | `.html.ftl` / `.txt.ftl` |

Tones: de-sie, de-du, en.

Both MIME parts are generated from one content model, so the plain-text twin
cannot drift from the HTML, and all three dialects come from one renderer, so a
dialect cannot disagree with what Storybook shows.

## What each mail needs

| Occasion | Audience | Placeholders |
| --- | --- | --- |
| `neue-nachricht` | asker | `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `willkommen` | asker | `{{username}}` `{{loginUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `passwort-zuruecksetzen` | asker | `{{expiryHours}}` `{{resetUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `termin` | asker | `{{appointmentDate}}` `{{appointmentTime}}` `{{appointmentType}}` `{{locationName}}` `{{locationAddress}}` `{{appointmentUrl}}` `{{mapUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `beraterin-kontakt` | asker | `{{consultantName}}` `{{consultantPhone}}` `{{consultantHours}}` `{{consultantEmail}}` `{{bookingUrl}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `anfrage-zugewiesen` | consultant | `{{requestTopic}}` `{{requestPostcode}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `systemhinweis` | asker | `{{maintenanceDate}}` `{{maintenanceStart}}` `{{maintenanceEnd}}` `{{statusUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |

Brand placeholders (`platformName`, `primaryColor`, `accentColor`,
`logoUrl`, `orgName`, `orgAddress`, `contactLine`) appear in every mail and
are omitted from the table.

## How a downstream repository picks this up

See `docs/architecture/adr-020-email-template-distribution.md`. In short: this directory
is the published artefact, consumed as a build input rather than copied by hand,
and a template change is reviewed as a diff in this repository before it reaches
any service.
