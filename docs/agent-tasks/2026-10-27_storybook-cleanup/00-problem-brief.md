# Keep Storybook aligned with the current frontend

Storybook exposes retired create-chat and password-request examples, while the
consultant chat composition embeds the responsive navigation in an 85px rail.
These examples can bring obsolete UI back into new work.

User input: four screenshots and the 2026-10-27 cleanup request. Parent issue:
[1865](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1865).
Implementation slice:
[1866](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1866).

Acceptance:

- One create action in the session-list example; no retired create-chat card.
- Remove the rejected RequestPasswordReset stories, preserving the active route.
- Correct navigation in the consultant composition; link the canonical variants.
- Report missing/inconsistent icons and additional unused examples with links.
- Keep the missing redesigned recovery-dialog reference explicit; do not replace
  requesting a reset email with authenticated password change.

## Clarification received during verification

The requested dialog is the optional post-registration password-setup flow,
opened by a system message and configurable by the counselling agency. It is
not forgot-password recovery. Keep this as an open successor requirement; the
current cleanup PR does not implement it.

Source investigation found SaveCredentialsCard routes to inline profile settings,
not a popup. The catalogue says toggleable, but the actual agency-switch-to-message
integration was not found. The current password API requires the old password;
a new-password-only setup flow needs an explicit backend/recovery contract.
A concrete user decision is pending: require current password or support users
who do not know the generated registration password.

The routed Knowledge Core plan, `40 - Engineering/Plans/2026-10-27-storybook-frontend-cleanup.md`,
is the canonical requirement/status ledger. Human merge and post-merge Dev
verification are separate gates.
