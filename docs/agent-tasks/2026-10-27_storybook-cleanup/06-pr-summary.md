# Candidate for human review

Retire the unused create-chat card and the rejected password-request examples.
Share the real navigation's required app shell across Storybook examples and
show the active chat above full-width navigation on narrow screens. Preserve
existing story IDs and link the canonical consultant, advice-seeker, mobile and
short-rail variants.

Catalogue the existing required password/second-factor gate under
`Components/Dialog/Account setup`, retain its stable links and link the separate
post-registration credentials message from Docs. Reuse the actual frontend
component; do not present the required setup gate as the optional popup.

The complete icon/legacy inventory is a report, not a glyph redesign. The
user clarified a separate optional post-registration password-setup dialog.
That system-message/toggle/popup integration remains open, with a concrete
current-password/backend decision pending. The runtime recovery route is preserved.

Repository unit/lint/type/build checks pass. Browser layout regressions have
before/after proof, but the full affected Storybook gate is not green because
existing accessibility audits and runtime fixtures still fail. Keep the PR a
draft and retain those failures; do not claim merge readiness or Dev acceptance.

Verification and detailed limitations: `04-test-evidence.md`.
Review the original request and all four attachments before handoff. Human
review/merge and post-merge deployed Storybook verification remain open.
