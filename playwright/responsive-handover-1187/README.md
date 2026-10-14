# Protected request-form responsive regression (#1187)

This local public fixture mounts the real SessionsZone routing and production shell styles. It uses fictional case data and the existing curtain playground; it cannot reveal real conversations or submit requests.

Run from the repository root with Node 22:

```bash
npx playwright test --config playwright/responsive-handover-1187/playwright.config.mts --reporter=line
```

The config starts a local Storybook on port 6218, or reuses the server already there. Tests cover German, English and French at 320×568, 390×844, 820×1180 and 1440×900. They walk from the intro to the selected reason and explanation, assert the form fits the active pane, use a real mouse wheel to reach the request control, then scroll back to the protection notice. Request submission is covered by the existing curtain/API integration tests and is not exercised here.

Do not replace normal pointer scrolling with `locator.click()` on the offscreen request control: Playwright would scroll an `overflow: hidden` ancestor automatically and hide the original defect. Actual Dev and backend acceptance remain separate.
