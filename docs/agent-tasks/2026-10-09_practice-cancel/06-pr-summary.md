Ending a practice exercise resets its saved progress to not started before practice cleanup finishes. Practice writes are ordered per login/tour/version so a delayed step cannot resurrect in-progress status; queued writes reject if the login identity changed.

Local verification: 701 files / 12311 unit tests, lint/scripts/types/style, production build and 5 Chromium PracticeFlow interaction/a11y tests passed. Before/after Chrome proof is in docs/storybook/issue-1680-practice-cancel/.

Reviewer test: start an exercise, advance, End, verify Help says not started. Repeat with delayed/failing progress API; cleanup must work and starting a new run must not be closed by an earlier reset.

Limitations: local only. Existing two-second drain timeout remains. A failed reset is tolerated for cleanup and must not be claimed as a persisted success. Omitted currentStepId clearing has not been checked on the live backend.
