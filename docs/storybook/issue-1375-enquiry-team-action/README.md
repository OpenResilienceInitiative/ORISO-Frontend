# Enquiry team action: visual evidence

Scope: when an enquiry has no main reply composer, offer a labelled secondary-colour team-discussion button beside the primary acceptance action. Preserve the original icon launcher where a main composer exists, and preserve the existing panel permission/open/close logic.

- `01-before-user-tablet.png`: screenshot supplied by Frank on 16 September 2026. It shows the previous detached grey icon launcher above the acceptance action. The unreadable historical message is unrelated to this visual change and is not claimed repaired.
- After images are captured from the actual application rendered by the existing Cypress enquiry scenario with local HTTP/Matrix fixtures. They prove layout and interaction at their stated viewport, not deployment, real-account permissions or encryption recovery.

Reviewer check: close the automatic team panel, open it with “Teambesprechung öffnen”, then close it again. Both actions should remain visible without overlap on desktop and at mobile width. Before acceptance there is still no counsellor reply composer to the client.

- `02-after-desktop-1440.png`: actual app with local fixtures, 1440 × 1000. Both actions share the same row and height; recovery banners intentionally remain visible from the fixture.

Validation: seven enquiry integration tests, TypeScript, ESLint and scoped Stylelint pass. Cypress verifies the labelled action, equal button heights, desktop row alignment, mobile stacking and open/close behaviour. Encryption-backup notices in these fixture screenshots do not establish a live recovery failure or fix.

- `03-after-mobile-390.png`: actual app with local fixtures, 390 × 844. The secondary action wraps beneath acceptance and remains fully visible.

## Right-aligned follow-up

The user requested a right-aligned desktop action group and a visible arrow indicating that the team action opens the neighbouring panel. The mobile layout remains centered and stacked.

- `04-after-desktop-right-1440.png`: updated desktop, 1440 × 1000; action group aligned right with 32px footer inset, secondary action ends in a right arrow.
- `05-after-mobile-arrow-390.png`: updated mobile, 390 × 844; both actions remain centered and stacked with the arrow visible.

The same local-fixture evidence boundary applies. Cypress checks right inset, desktop shared row, mobile stacking/centering and the visible arrow in addition to the existing panel open/close flow.

## Supplied SVG follow-up

The final arrow uses the exact `arrow_right_24px.svg` supplied by Frank, tinted with the button's foreground colour. It replaces the Unicode arrow without changing panel behaviour or desktop/mobile alignment.

The CI failures from the preceding comfort change also exposed an unsupported `--m3-secondary-hover` reference and a redundant informal German translation. The button now uses the supported secondary token and the informal catalogue inherits the shared German label. These corrections preserve the intended appearance.

Validation for this follow-up: 37 i18n and 55 theme-contract tests pass, as does scoped lint. The new desktop/mobile browser proof remains pending; the first desktop attempt timed out during a local rebuild. Images 04/05 show the preceding Unicode-arrow version and must not be treated as evidence for this SVG change.
