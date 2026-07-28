## Verified facts

- Consultant Live Chat in `NavigationBar` was gated with `fromL` (900px+) and CSS `display: none` below `$fromLarge`, which hid it on mobile/tablet.
- Language switcher used the same desktop-only CSS hide under `.app__wrapper` figma nav rules.

## General rules

- Figma consultant mobile bottom bar should scroll the full row (routes + Live Chat + language + logout), not pin logout alone while hiding actions.

## Open failures

## Lessons learned

- “Pinned logout + scroll routes” on mobile made Live Chat/language unreachable once they were added to the bottom group; prefer one scroll container for the whole bar on small screens.

## Last session

- 2026-07-20: Exposed Live Chat + language on mobile/tablet; made `.navigation__itemContainer` smoothly scroll horizontally including logout. Story `RuntimeConsultantMobile` updated. Lint/tsc clean for touched TS.
