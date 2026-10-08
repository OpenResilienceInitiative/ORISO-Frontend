# System-message inventory and approved consent icons

Local Storybook, German, baseline `3cb8552a`, follow-up issue 1659.
The before/after pairs show the same production opt-in card and its optional
M3 dialog at 390×844, 820×1180 and 1440×900. They demonstrate supplied artwork,
heading and responsive rendering, not server persistence or Dev deployment.
Mobile dialog content scrolls within the M3 surface.

The inventory screenshot shows the common Storybook category. Explicit meta IDs
preserve old scenario URLs. Device-only regression stories are retained with the
`device-regression` tag rather than removing existing tests and links.

Meaningful browser verification: the optional dialog exposes “Wann hilfreich”,
remains optional, closes with focus returned, and uses the same maintained component
at every viewport. Existing consent interactions and encryption/security notices
were run in Chromium (66 tests across 10 files). The first red run failed on the
old heading; the updated real-locale story then passed.

Real Dev chat verification and refreshed GitHub issue/PR evidence are delivery
steps owned by the integration task, not claimed by these local screenshots.
