# Protected wizard public responsive regression (#1187 / PR #1721)

The public fixture mounts the actual SessionsZone routes and production authenticated/session/list styles with fictional case data. It preserves the protected UI boundary and never submits a request.

Run with Node22 from the repository root:

```bash
npx playwright test --config playwright/responsive-handover-1187/playwright.config.mts --reporter=line
```

The config starts or reuses Storybook6218. Thirty-five DPR1 browser cases cover DE/EN/FR at phone320×568 and390×844, tablet820×1180, desktop1440×900 and short390×420/820×480/1440×480. They prove active-panel fit, complete protection-heading bounds after returning to top, a noninteractive native topic, normal reason/explanation transitions, persistent footer bounds, actual mousewheel body movement and keyboard focus across native disabled actions.

The body-wheel oracle has a deliberate test-only negative control:

```bash
FOOTER_SCROLL_NEGATIVE_CONTROL=1 npx playwright test --config playwright/responsive-handover-1187/playwright.config.mts --grep 'short phone body scrolls' --reporter=line
```

It must fail at scrollTop>0 because the mutation sets body overflow:hidden. Normal runs must not set that variable. A locator click on an offscreen control alone would auto-scroll and could hide the original clipping defect; the dedicated test uses actual mousewheel and measured scroll movement instead.

Native ScrollableSection bodyKey changes only the body DOM at step entry. The shared footer stays mounted. Only a clicked focused wizard action becoming disabled transfers focus to its enabled sibling; profile consumers and arbitrary field/prop changes retain their behavior. Existing unit/API integration tests cover backend submission and access logic separately from this public fixture.
