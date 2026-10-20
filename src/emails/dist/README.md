# Generated e-mail templates

Generated — do not edit by hand. Run `npm run emails:build` after changing
anything under `src/emails/`.

Layout: `<dialect>/<tone>/<id>.<ext>`.

| Dialect       | Consumer                                                   | Placeholder         | Files                    |
| ------------- | ---------------------------------------------------------- | ------------------- | ------------------------ |
| `plain/`      | UserService direct-SMTP senders (plain string replacement) | `{{name}}`          | `.html` / `.txt`         |
| `thymeleaf/`  | MailService                                                | `[[${name}]]`       | `.html` / `.txt`         |
| `freemarker/` | Keycloak e-mail theme                                      | `${(name!'')?html}` | `.html.ftl` / `.txt.ftl` |

Variants in this directory: de-sie, de-du, en, fr, ru, ti, tr.

**Pending human language review: fr, ru, ti, tr.** These variants
are built now. Legal, encryption and anonymity wording has not been approved
by a native speaker; inspect `content/translationReview.json` before claiming
otherwise.

Both MIME parts are generated from one content model, so the plain-text twin
cannot drift from the HTML, and all three dialects come from one renderer, so a
dialect cannot disagree with what Storybook shows.

## What each mail needs

| Occasion                                  | Audience   | Placeholders                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `neue-nachricht`                          | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                             |
| `neue-nachricht-beratung`                 | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                             |
| `willkommen`                              | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{username}}` `{{loginUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                |
| `passwort-zuruecksetzen`                  | asker      | `{{expiryHours}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{resetUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                                    |
| `termin`                                  | asker      | `{{appointmentDate}}` `{{appointmentTime}}` `{{appointmentType}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{locationName}}` `{{locationAddress}}` `{{appointmentUrl}}` `{{mapUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}` |
| `selbsthilfe-termin-bestaetigt-teilnahme` | asker      | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-verschoben-teilnahme` | asker      | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-abgesagt-teilnahme`   | asker      | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-erinnerung-teilnahme` | asker      | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-bestaetigt-beratung`  | consultant | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-verschoben-beratung`  | consultant | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-abgesagt-beratung`    | consultant | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `selbsthilfe-termin-erinnerung-beratung`  | consultant | `{{appointmentDate}}` `{{appointmentTime}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{appointmentUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                             |
| `beraterin-kontakt`                       | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{consultantName}}` `{{consultantPhone}}` `{{consultantHours}}` `{{consultantEmail}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                      |
| `anfrage-zugewiesen`                      | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestTopic}}` `{{requestPostcode}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                            |
| `systemhinweis`                           | asker      | `{{maintenanceDate}}` `{{maintenanceStart}}` `{{maintenanceEnd}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{statusUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                            |
| `neue-anfrage`                            | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestTopic}}` `{{requestPostcode}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                            |
| `direkte-anfrage`                         | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestTopic}}` `{{requestReceivedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                  |
| `tagesuebersicht`                         | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{openRequestCount}}` `{{oldestRequestAge}}` `{{digestGeneratedAt}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                       |
| `einsicht-angefragt`                      | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                                                    |
| `uebergabe-angefragt`                     | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                                                    |
| `uebergabe-bestaetigt`                    | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{requestUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                             |
| `rueckmeldung`                            | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{messageUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                             |
| `mitteilung`                              | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{messageHeadline}}` `{{messageBody}}` `{{loginUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                       |
| `konto-einrichten`                        | admin      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{inviteExpiresAt}}` `{{setupUrl}}` `{{offeringName}}` `{{operatorName}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                          |
| `anmeldelink`                             | asker      | `{{expiryMinutes}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{loginUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                                  |
| `einmalcode`                              | asker      | `{{expiryMinutes}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{otpCode}}` `{{loginUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                    |
| `email-geaendert`                         | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{username}}` `{{appUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                                                         |
| `einladung-traeger`                       | admin      | `{{tenantName}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{inviteExpiresAt}}` `{{inviteUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                              |
| `einladung-fachkraft`                     | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{agencyName}}` `{{inviteExpiresAt}}` `{{inviteUrl}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                                                                                              |
| `avv-unterschrift`                        | admin      | `{{tenantName}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{dpaProvidedAt}}` `{{dpaExpiresAt}}` `{{dpaUrl}}` `{{tenantNameDative}}` `{{offeringName}}` `{{operatorName}}` `{{privacyUrl}}` `{{imprintUrl}}`                                                   |
| `einladung-freitext`                      | admin      | `{{subject}}` `{{preheader}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{bodyHtml}}` `{{ctaBlock}}` `{{assuranceBlock}}` `{{offeringName}}` `{{operatorName}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{footerNote}}`                                             |
| `team-aenderung`                          | consultant | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{teamChangeStatement}}` `{{caseReference}}` `{{teamChangedAt}}` `{{appUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                               |
| `smtp-test`                               | admin      | `{{smtpHost}}` `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{smtpFrom}}` `{{sentAt}}` `{{appUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                      |
| `anruf-erinnerung`                        | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{callUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                                |
| `anruf-einladung`                         | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{callUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                                |
| `anruf-verpasst`                          | asker      | `{{logoHeaderClass}}` `{{logoWordmarkClass}}` `{{callUrl}}` `{{settingsUrl}}` `{{privacyUrl}}` `{{imprintUrl}}` `{{unsubscribeUrl}}`                                                                                                                                |

Brand placeholders (`platformName`, `primaryColor`, `accentColor`,
`logoUrl`, `orgName`, `orgAddress`, `contactLine`) appear in every mail and
are omitted from the table. So is `logoCell` in the plain dialect: the
consumer expands it to the logo image cell when a logo URL is configured, and
to nothing when it is blank.

## How a downstream repository picks this up

See `docs/architecture/adr-020-email-template-distribution.md`. In short: this directory
is the published artefact, consumed as a build input rather than copied by hand,
and a template change is reviewed as a diff in this repository before it reaches
any service.
