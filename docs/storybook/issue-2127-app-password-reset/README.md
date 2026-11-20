# App password reset recovery · #2127

| Viewport           | Before on Dev, Frontend `44ce40c`                     | After in local Storybook                                                     |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Phone 390 × 844    | [Rejected confirmation](01-before-dev-de-mobile.png)  | [Recovery link with keyboard focus](02-after-local-storybook-de-mobile.png)  |
| Tablet 820 × 1180  | [Rejected confirmation](01-before-dev-de-tablet.png)  | [Recovery link with keyboard focus](02-after-local-storybook-de-tablet.png)  |
| Desktop 1440 × 900 | [Rejected confirmation](01-before-dev-de-desktop.png) | [Recovery link with keyboard focus](02-after-local-storybook-de-desktop.png) |

The before images show the real Dev response to a never-issued token after the throwaway fields were cleared for capture. The after images show the German Storybook form after a simulated HTTP 400, with fixture passwords masked and visible keyboard focus on the recovery link.

The Storybook browser test checks a single rejected confirmation, retained field values, keyboard activation and the actual blank request form with zero reset requests. The candidate has not been deployed.
