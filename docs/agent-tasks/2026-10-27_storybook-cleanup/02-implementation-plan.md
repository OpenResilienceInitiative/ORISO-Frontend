# Implementation plan

1. Add real browser checks for the duplicate card and narrow navigation geometry;
   record their failures before the fixes.
2. Remove the unused card/component/story/styles and rejected password stories.
3. Share the Storybook navigation shell and correct the responsive composition;
   retain story IDs and link the canonical navigation variants.
4. Run focused story tests, Storybook typechecking and repository checks. Record
   pre-existing gate failures separately; never suppress accessibility audits.
5. Review the complete diff and original requirements, then prepare the draft PR
   with exact verification limits and a human test plan.

Icons remain an inspection/report decision in this slice. Additional unused
stories are reported for review, not silently removed.

## Successor requirement — post-registration password setup

Retain the user's clarification as separate work: system message → dismissible
password dialog, actual per-agency enable/disable behavior, and matching
Storybook states. The candidate cleanup does not claim this integration.
Do not substitute the mandatory administrator-provisioned AccountSetupGate.
Current-password validation and LOGIN_PASSWORD key rewrapping cannot be bypassed.
Wait for the concrete password-entry decision before implementation of this
successor; continue the independent cleanup delivery.
