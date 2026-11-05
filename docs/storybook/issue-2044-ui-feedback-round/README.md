# Issue 2044: UI feedback round (Dev review)

Captured from Storybook (before = merge base `dd6e2c309`, after = PR branch). Chromium, device scale factor 2-3.

| Image | What it proves | What it does not prove |
| --- | --- | --- |
| `01-before` / `02-after-drafts-chip-toolbar` | The Drafts chip (4th, count 2) loses the grey inner box. | - |
| `03-before` / `04-after-drafts-row-timeline-filter` | The "Entwuerfe" row in the timeline filter dialog uses the same plain dashed glyph. | The "Draft saved" timeline entry itself (no story). |
| `05-before` / `06-after-badge-count-phone-390` | Count text colour on the mobile nav badge. The story theme already has a white on-error, so the tenant colours measured on Dev (`--m3-error: #f00e83`, `--m3-on-error: #3e001d`) were set on the nav wrapper for both shots. | That a real tenant produces these values (measured on dev.oriso.org, not reproduced in Storybook). |
| `07-before` / `08-after-two-direct-links-desktop-1370` | Exactly two tiles share the row equally (before: 1 + double-width). Story `Wired (mocked API) / Overview with links`. | - |
| `09-after-team-icon-button` | The new icon button (story `Team discussion / Icon button`; the ring is the focus from the story's play test). | The click inside a real list row and Enter/Space handling: covered by unit tests, not by this image. There is no "before" story for the old text chip. |

Not covered by images (unit tests only, needs a live Dev build): composer fullscreen inside the Drafts iframe, including the 900px breakpoint crossing.
