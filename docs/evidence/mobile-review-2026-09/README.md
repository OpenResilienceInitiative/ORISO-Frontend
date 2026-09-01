# Mobile review evidence — 2026-09-01

Annotated screenshots from Frank's mobile review session on `predev.oriso.org`
(iPhone / Safari, 2026-09-01, 11:12–11:46). Stored here so the issues that cite
them keep working links; this branch carries **evidence only** and is never
merged.

Annotation legend used in these images: **red frame or scribble** marks the
defect, **green frame or circle** marks the correct reference to match.

| File | Issue | What it shows |
| --- | --- | --- |
| `1115-search-indicator.jpg` | [#1115](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1115) | Chat header, case not yet accepted. Green box = the grey squircle (correct). Red X = the black circle with the magnet loader. |
| `1190-consent-thema-token.png` | [#1190](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1190) | Registration step 4/4. The consent sentence renders `{{Thema}}` literally; `{{legal_links}}` resolved correctly. |
| `1248-01-fullscreen-button.png` | [#1248](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1248) | Green circle = the maximise (↗) control being pressed. Context shot. |
| `1248-02-fullscreen-cut-off.jpg` | [#1248](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1248) | The result: the maximised composer is sized to the layout viewport, so the send button and the text sit outside what the keyboard leaves visible. |
| `1249-composer-stuck.png` | [#1249](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1249) | After a few maximise/restore cycles nothing but reopening the box responds. Text `hffh` typed. |
| `1250-toolbar-menu-clipped.png` | [#1250](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1250) | The ⋮ overflow menu opens downward from a toolbar near the bottom edge; `Strikethrough` is already cut off. |
| `1252-voice-recording-thread.png` | [#1252](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1252) | Voice recording in a **thread reply** ("Reply in thread", "● Recording… 0:03"). Also the **correct reference** for #1253/#1254: the same message renders properly here. |
| `1253-message-torn.png` | [#1253](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1253) | The sent message renders with bubble, `11:43` and `✓✓` but **no body**. Red scribble marks the broken region. Compare with `1252-…` one minute later. |
| `1255-01-email-save-failed.png` | [#1255](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1255) | "Enter e-mail address" dialog: inline error *"Saving failed. Please try again."* and the envelope icon drawn on top of the typed value. |
| `1255-02-email-card.png` | [#1255](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1255) | The card that opens that dialog: "Benachrichtigung per E-Mail" / "E-Mail-Adresse angeben". |

All content is test data on the pre-dev environment (pseudonym "lion marlowe",
message "test quack", agency "bla3"). No production data, no real help-seeker.

Note: the version string `v2.0.3` visible in some shots is a frozen banner and
does **not** identify the build — see ORISO-Helm#330.
