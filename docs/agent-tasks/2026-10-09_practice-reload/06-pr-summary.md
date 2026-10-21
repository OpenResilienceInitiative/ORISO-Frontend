Interrupted exercises now show a truthful fresh-start state in Help. Since the fictional case lives only in memory, a saved step cannot resume it after reload. Completed and skipped exercises retain their repeat action; ordinary introduction tours are unchanged.

Validation: local only, 12305 unit tests, lint/scripts/types/style, production build, 4 Chromium Storybook tests and Chrome before/after screenshots.

Reviewer test: load CompletedAndInterrupted story; verify completed acceptance exercise remains completed, interrupted supervision shows not started and Start (no Continue). Confirm mobile practice remains disabled.
