# Practice reload status (#1679)
Source: https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1679

An interrupted exercise loses its memory-only case on reload, but Help says it is in progress. Show a truthful fresh-start state without persisting fictional messages or implementing partial resume.

Acceptance: current-version in_progress displays not_started; Start opens a fresh run; completed/skipped states remain available for repeat; mobile practice restriction remains; unit/lint/style/build and card browser checks pass.
