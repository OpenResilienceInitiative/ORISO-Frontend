# Profile legal-text reconciliation — local synthetic evidence

Refs ORISO-Frontend#1213, #1220; original PR #1245.

The pictures show the real DepartmentLegalSection and shared Dev LegalLinkModal with synthetic public legal text. No account, credential or backend was used.

- 01-before-inline-desktop: current Dev details variant before the profile modal wiring; own text expands inline, 1440×900, de.
- 02-after-agency-desktop: candidate modal variant, own agency text, 1440×900, de.
- 03-after-agency-tablet: same candidate, 820×1180, de.
- 04-after-agency-mobile: same candidate, 390×844, de.
- 05-after-carrier-desktop: no own text; the existing shared dialog shows the Träger text, 1440×900, de.
- 06-after-missing-link-desktop: neither text; exact approved notice and configured synthetic address, 1440×900, de.

The temporary Storybook fixture intercepted only the synthetic agency42/topic7 public legal endpoint, supplied the existing TenantContext/LegalLinksContext, and restored fetch/cache after each story. The fixture was removed after capture; no product source was instrumented.

Four focused stories passed the existing Chromium/axe gate. The first fixture attempt queried visibility before the existing dialog entrance animation completed; the fixture now waits for the same visible elements, without timeout or assertion weakening.

The 42 focused unit cases separately cover own privacy/imprint precedence, Träger fallback, missing notice with/without configured address, loading, agency/topic stale-snapshot protection, profile wiring, registration details/consent preservation, same-origin navigation and platform footer URLs without aid.

Images prove the displayed local states only. They do not prove deployment, received mail, real registration/profile data, human approval or full-suite completion.
