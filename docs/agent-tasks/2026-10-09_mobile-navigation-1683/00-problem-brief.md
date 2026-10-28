# #1683 mobile navigation

At 375 px, the build identity overlaps the bottom navigation labels. The navigation deliberately scrolls horizontally; every route and action must remain reachable.

Acceptance: version is clear of the bottom bar; scrollport stays inside 375 px; scrolling exposes language and logout; keyboard logout works; desktop rail remains unchanged. Verify locally in Storybook using production navigation and shell styles.
