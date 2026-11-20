# Chat access settings — visual evidence

BEFORE images are actual Dev484 screenshots for the synthetic Lisa test actor. AFTER images are controlled local Storybook fixtures of the production message/dialog components. They do not prove a merged/deployed full conversation or live backend event.

| Artifact                                                                                                           | State                                      | Environment / scope         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------------- |
| [01-before-enquiry-desktop-1440-de-dev.png](01-before-enquiry-desktop-1440-de-dev.png)                             | FAIL, outside-chat entry before acceptance | Dev484, Lisa,1440x900,de    |
| [02-before-accepted-mobile-390-de-dev.png](02-before-accepted-mobile-390-de-dev.png)                               | FAIL, chat clipped by extra column         | Dev484, Lisa231,390x844,de  |
| [03-after-acceptance-desktop-1440-de.png](03-after-acceptance-desktop-1440-de.png)                                 | PASS component layout                      | local Storybook,1440x900,de |
| [04-after-acceptance-tablet-820-de.png](04-after-acceptance-tablet-820-de.png)                                     | PASS component layout                      | local Storybook,820x1180,de |
| [05-after-acceptance-mobile-390-de.png](05-after-acceptance-mobile-390-de.png)                                     | PASS component layout                      | local Storybook,390x844,de  |
| [06-after-acceptance-mobile-390-en.png](06-after-acceptance-mobile-390-en.png)                                     | PASS component layout                      | local Storybook,390x844,en  |
| [07-after-acceptance-mobile-320-fr.png](07-after-acceptance-mobile-320-fr.png)                                     | PASS component layout                      | local Storybook,320x844,fr  |
| [08-after-takeover-desktop-1440-de.png](08-after-takeover-desktop-1440-de.png)                                     | PASS component layout                      | local Storybook,1440x900,de |
| [09-after-takeover-desktop-1440-de-dialog.png](09-after-takeover-desktop-1440-de-dialog.png)                       | PASS layout / keyboard focus return        | local Storybook,1440x900,de |
| [10-after-takeover-tablet-820-de.png](10-after-takeover-tablet-820-de.png)                                         | PASS component layout                      | local Storybook,820x1180,de |
| [11-after-takeover-tablet-820-de-dialog.png](11-after-takeover-tablet-820-de-dialog.png)                           | PASS layout / keyboard focus return        | local Storybook,820x1180,de |
| [12-after-takeover-mobile-390-de.png](12-after-takeover-mobile-390-de.png)                                         | PASS component layout                      | local Storybook,390x844,de  |
| [13-after-takeover-mobile-390-de-dialog.png](13-after-takeover-mobile-390-de-dialog.png)                           | PASS layout / keyboard focus return        | local Storybook,390x844,de  |
| [14-after-takeover-mobile-390-en.png](14-after-takeover-mobile-390-en.png)                                         | PASS component layout                      | local Storybook,390x844,en  |
| [15-after-takeover-mobile-390-en-dialog.png](15-after-takeover-mobile-390-en-dialog.png)                           | PASS layout / keyboard focus return        | local Storybook,390x844,en  |
| [16-after-takeover-mobile-320-fr.png](16-after-takeover-mobile-320-fr.png)                                         | PASS component layout                      | local Storybook,320x844,fr  |
| [17-after-takeover-mobile-320-fr-dialog.png](17-after-takeover-mobile-320-fr-dialog.png)                           | PASS layout / keyboard focus return        | local Storybook,320x844,fr  |
| [18-after-co-access-desktop-1440-de.png](18-after-co-access-desktop-1440-de.png)                                   | PASS component layout                      | local Storybook,1440x900,de |
| [19-after-co-access-tablet-820-de.png](19-after-co-access-tablet-820-de.png)                                       | PASS component layout                      | local Storybook,820x1180,de |
| [20-after-co-access-mobile-390-de.png](20-after-co-access-mobile-390-de.png)                                       | PASS component layout                      | local Storybook,390x844,de  |
| [21-after-co-access-mobile-390-en.png](21-after-co-access-mobile-390-en.png)                                       | PASS component layout                      | local Storybook,390x844,en  |
| [22-after-co-access-mobile-320-fr.png](22-after-co-access-mobile-320-fr.png)                                       | PASS component layout                      | local Storybook,320x844,fr  |
| [23-after-takeover-label-stress-mobile-320-ru.png](23-after-takeover-label-stress-mobile-320-ru.png)               | PASS component layout                      | local Storybook,320x844,ru  |
| [24-after-takeover-label-stress-mobile-320-ru-dialog.png](24-after-takeover-label-stress-mobile-320-ru-dialog.png) | PASS layout / keyboard focus return        | local Storybook,320x844,ru  |
| [25-after-takeover-label-stress-mobile-412-ru.png](25-after-takeover-label-stress-mobile-412-ru.png)               | PASS component layout                      | local Storybook,412x844,ru  |
| [26-after-takeover-label-stress-mobile-412-ru-dialog.png](26-after-takeover-label-stress-mobile-412-ru-dialog.png) | PASS layout / keyboard focus return        | local Storybook,412x844,ru  |

The standalone screenshot runner loads the story iframe directly and explicitly sets the browser viewport to 820 × 1180 for tablet captures. The Storybook manager preset is 834px; it does not control these iframe captures. The filenames and table report the measured capture viewport, confirmed in visual-receipt-final.json.

All images were captured after CSS animations finished and visually inspected. Dialog bodies scroll normally at 320px. Existing German grant-message descriptions remain unchanged when UI locale switches to English/French/Russian.

Actual keyboard/save/readback fixture: initially false → Space → scoped PUT and confirmed GET → close/reopen reads true. Dialog accessible name is present; focus returns to its exact opener. Final axe dialog scan reports 0 violations and one incomplete color-contrast check; this is not a full screen-reader or WCAG certification.

Missing/incorrect acceptance metadata, other roles/modality, pending-request consent and stale loading remain covered by meaningful unit regressions. Human reviewer checkboxes remain unchecked.
