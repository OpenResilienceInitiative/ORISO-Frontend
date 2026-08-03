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
| `neue-anfrage` | consultant | `{{requestTopic}}` `{{requestPostcode}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `direkte-anfrage` | consultant | `{{requestTopic}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `tagesuebersicht` | consultant | `{{openRequestCount}}` `{{oldestRequestAge}}` `{{digestGeneratedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `uebergabe-angefragt` | consultant | `{{fromConsultantName}}` `{{caseReference}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `uebergabe-bestaetigt` | consultant | `{{toConsultantName}}` `{{caseReference}}` `{{handoverAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `rueckmeldung` | consultant | `{{caseReference}}` `{{requestReceivedAt}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `mitteilung` | asker | `{{messageSubject}}` `{{messagePreview}}` `{{messageHeadline}}` `{{messageBody}}` `{{loginUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `anmeldelink` | asker | `{{expiryMinutes}}` `{{loginUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `einmalcode` | asker | `{{expiryMinutes}}` `{{otpCode}}` `{{loginUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `email-geaendert` | asker | `{{username}}` `{{appUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `einladung-traeger` | admin | `{{tenantName}}` `{{inviteExpiresAt}}` `{{inviteUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `einladung-fachkraft` | consultant | `{{agencyName}}` `{{inviteExpiresAt}}` `{{inviteUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `avv-unterschrift` | admin | `{{tenantName}}` `{{senderName}}` `{{dpaProvidedAt}}` `{{dpaUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` |
| `team-aenderung` | consultant | `{{teamChangeStatement}}` `{{agencyName}}` `{{teamChangedAt}}` `{{appUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `smtp-test` | admin | `{{smtpHost}}` `{{smtpFrom}}` `{{sentAt}}` `{{appUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |

Brand placeholders (`platformName`, `primaryColor`, `accentColor`,
`logoUrl`, `orgName`, `orgAddress`, `contactLine`) appear in every mail and
are omitted from the table.

## How a downstream repository picks this up

See `docs/architecture/adr-020-email-template-distribution.md`. In short: this directory
is the published artefact, consumed as a build input rather than copied by hand,
and a template change is reviewed as a diff in this repository before it reaches
any service.
