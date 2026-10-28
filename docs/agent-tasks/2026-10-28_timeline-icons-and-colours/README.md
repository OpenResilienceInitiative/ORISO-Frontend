# Approved timeline icons and colours

Parent: [1865](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1865).
Owning package: [1871](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1871).

## Scope

Use the user-approved existing thread, outline-message and scheduled-calendar assets in the shared descriptor mapping. Keep the white calendar check visible in the actual row and detail CSS. Catalogue the supplied placeholder without assigning it to an event; its original library provenance is unverified. Preserve the existing selected Full/unselected Outline request pairing. Missing state variants and the account-deletion assignment remain open design work.

The user supplied [Figma App.Oriso7574:39299](https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7574-39299) as the authoritative timeline colour reference on2026-10-28. High-fidelity child7574:39661, variables and screenshot determine the states; existing runtime event glyphs remain dynamic.

- Normal rows: gray group surface, white outlined icon circles, neutral title/glyph/connector.
- Selected row: white surface, primary border/circle/connector, on-primary glyph, on-primary-fixed title, neutral timestamp.
- Shared NotificationsCenter stylesheet owns the states. No per-event colour overrides.
- The existing theme recipe is retained. Its secondary-container computes#656e79; the static fallback/Figma value is#646d78. Do not change all tenant colours to remove that small existing difference.
- Accessibility deviation: small Figma muted text#646d78 gives4.27:1 ongray#eae7e8. Normal supporting text/timestamps use existing on-surface-variant#444748 (7.63:1). Selected white cards use secondary-container (5.25:1 for the Figma value).

Add the missing canonical on-tertiary-fixed role from the stable slateT10 palette, plus the defaultSCSS token and existing Figma golden contract. No other theme values change.

## Verification

Browser regression failed first on the old thread shape, then on calendar check paint. Palette assertions failed on the old circle outline; the new token golden failed before the role was emitted. Focused real-browser approved-icon/palette and catalogue stories pass with accessibility auditing enabled. Tests cover actual asset shapes, row/selected/detail check contrast, normal/selected semantic colours, hover and menu border.

Broader Storybook sweep:10passed/5failed across15stories. Failures are incomplete contrast audits and duplicate SVG IDs in existing masks, including the display-filter dialog and all-events example. No rules were disabled and this is not a claim that the entire Storybook gate is green.

Final gate:838unit files/14524tests passed (1file/8tests skipped); script/style lint, app build and Storybook typecheck pass onNode24.15.0 (package engines22). The role guard caught a surface token used for a border; reusing the existing white token corrected it and the full suite passed again. Current commit, screenshots and durable evidence links are recorded in the owning issue/PR. Verified locally only; human review, merge and Dev acceptance are separate.

Phone timeline captures retain existing horizontal clipping in the story fixture (root528px at390px viewport). They are INFORMATIONAL; the asset catalogue passes320/412px overflow checks. This package does not claim responsive layout repair.

## Boundaries

This package does not implement the unmatched optional password popup, alter authentication, assign the placeholder to account deletion, or replace all filled icons. The current timeline layout, copy and routing remain the existing application behavior; this applies the approved colours to those real states rather than introducing static Figma sample events.
