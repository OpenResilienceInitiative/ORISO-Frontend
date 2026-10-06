# Practice area (Übungsbereich): visual evidence for FE#1622

Captured from Storybook with Playwright (Chromium, German UI, 1440 px unless noted). They show layout, copy and states. They do not show behaviour: what stays off the network and out of the browser storage is covered by tests (below), not by any picture.

| Image                                              | Story (`Organisms/...`)                   | What it shows                                                                                                        |
| -------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `01-after-banner-running`                          | PracticeBanner, Running                   | flow name, "Schritt 3 von 6" (value set by the story, not a real run), note, Restart, End                            |
| `02-after-banner-moved-with-arrow-keys`            | PracticeBanner, Moved with the arrow keys | banner 64 px lower after Shift+Down; focus ring on the handle                                                        |
| `03-after-banner-restart-requested`                | PracticeBanner, Restart                   | after "Neu starten" the stage shows the tour host got `restart consultant-practice-accept`                           |
| `04-after-banner-ended`                            | PracticeBanner, End practice              | banner gone after "Übung beenden"                                                                                    |
| `05-after-cards-not-started-desktop`               | PracticeCards, Not started                | two cards with "Übung" badge, status and start button                                                                |
| `06-after-cards-completed-and-interrupted-desktop` | PracticeCards, Completed and interrupted  | "Abgeschlossen" offers "Noch einmal üben"; an interrupted flow offers a fresh start, no "continue"                   |
| `07-after-cards-supervision-hidden-desktop`        | PracticeCards, Supervision switched off   | the supervision card is absent, not greyed out                                                                       |
| `08-after-cards-phone-hint-390`                    | PracticeCards, Phone hint                 | start disabled with "Bitte üben Sie am Computer." at 390 px (the second card scrolls sideways)                       |
| `09-after-help-page-practice-cards-desktop`        | HelpTours, Practice cards on              | Profile, Hilfe: the tour cards and the "Übungsbereich" section below them (1440 × 1250)                              |
| `10-after-flow-enquiry-list`                       | PracticeFlow stage, step 2 of 6           | real list holds only the practice enquiry (badge "Übung", invented asker); banner and tooltip                        |
| `11-after-flow-accepted-case`                      | PracticeFlow stage, step 4 of 6           | accepted case with Erstantwort and the asker's first message under the tooltip                                       |
| `12-after-flow-scripted-answer`                    | PracticeFlow stage, step 6 of 6           | the typed reply and the scripted answer in the chat and the list row                                                 |
| `13-finding-banner-over-supervisor-add-1440`       | PracticeFlow stage, supervision step 1    | a finding, not a proof: at 1280 and 1440 px the banner covers the "+" the step asks to click; at 1920 px it does not |

10 to 12: the story "Accept an enquiry" plays the whole walk and ends on the Help page, so a Playwright script drove the same stage (a scratch copy without `play`, not committed) and stopped at each moment. In 13 the banner can be moved with its handle; the T2 spec does that and reports the finding.

Covered by tests instead (not visible here): no write except the tutorial-progress PUT (`networkGuard.test.ts`, `PracticeFlow.integration.test.tsx`), no storage write, practice ids never real, no real data in practice views, calls and attachments off (`src/practice/*.test.ts*`). The end-to-end proof against Dev is `playwright/practice-network-guard.smoke.spec.ts` (see `src/practice/README.md`, "Proof on Dev"); it has not been run against a live environment. Only German was captured; other languages are covered by the i18n tests.
