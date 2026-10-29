# Verification evidence

Environment: local checkout based on dev
`59d5248824ac62da4771c8173efa91ca6fa59aff`; Node 22.23.3. No deployed-fix claim.

| Check | Result |
| --- | --- |
| `npm run test:unit` | 838 passed files, 1 skipped; 14,523 passed tests, 8 skipped; exit 0 |
| `npm run lint:scripts` | exit 0, includes TypeScript |
| `npm run lint:style` | exit 0 |
| `npm run build` | exit 0; compiled with warnings; deployment-host guard passed |
| `npm run typecheck:storybook` | exit 0 |
| Focused create-chat browser story | red before removal, green after; desktop + phone cases, 2 passed |
| Navigation browser geometry | red at 85px/375px before responsive fix; corrected axes/widths checked at desktop and narrow widths |
| Full affected Storybook files | not green: existing accessibility and runtime-fixture failures remain visible |

Reproduction command for the create regression:

```sh
npm exec -- vp test run --project storybook src/components/sessionsList/SessionListColumn.stories.tsx --maxWorkers=1 --testNamePattern='Toolbar Create Chat And Cards'
```

The complete affected browser run includes unapproved/incomplete accessibility
audits (navigation accessible names/tablist relationships, duplicate SVG path
IDs, nested interactive elements, incomplete contrast measurement) and
unexpected runtime-shell fixture requests. Do not infer accessibility success
from the passing layout assertions. The pre-existing open verification repair
is [PR 1864](https://github.com/OpenResilienceInitiative/ORISO-Frontend/pull/1864).

The public Dev Storybook index and local candidate index were read separately.
Old request-password stories and standalone create-card stories are absent
locally, while the composite creation ID and all linked navigation IDs remain.

Configured Predev Storybook MCP returned HTTP 502 during initialization; no
`docs-list`/`stories-preview` MCP verification is claimed. Native in-app browser
attachment also failed. Local browser story tests and captured previews provide
the candidate evidence. Human merge and post-merge Dev verification remain open.

Final affected browser run: 3 files failed; 11 tests failed and 4 passed.
The later focused create-column desktop/phone run passed both tests. No passing
full Storybook-suite claim is made. Independent Docs rendering preserved normal
860px and short420px desktop shells alongside mobile76px/full-height variants.
German, English and Russian menu labels rendered; focused logout was partially
clipped until the horizontal strip was scrolled. That existing production
accessibility issue remains visible and was not changed by this story cleanup.

## Password catalogue follow-up

The existing frontend gate is catalogued under `Components/Dialog/Account setup`.
All nine story IDs and its Docs ID retain the `organisms-accountsetupgate--`
prefix. Index readback confirms ten entries and zero retired
`Organisms/RequestPasswordReset` entries. The optional credentials-message link
uses its explicit stable ID `components-chat-erstantwort--save-credentials`.

The complete AccountSetupGate browser file was run against the original metadata
and the candidate. Both have nine failures, with the same incomplete accessibility
audits (`aria-hidden-focus`, `color-contrast`, `aria-allowed-attr`) and unmocked
two-factor PUT requests. No audit or fixture policy was weakened. The actual
component and all play functions are unchanged; this low-impact reclassification
does not require a new behavioral test. Existing empty-form rendering confirms
three password fields and a disabled save action.

Follow-up repository checks rerun on Node24.15.0:838unit files/14,523tests pass
(1file/8tests skipped), script/style lint, app build and Storybook typecheck pass.
The application build and deployment-host guard pass with existing warnings.
Local browser readback at1440x900,820x1180 and390x844 confirms the new catalogue
title, three real password fields, disabled empty-form save and stable IDs.
These are local-only results; deployed Storybook keeps its previous category
until human merge and deployment. No password-setting behavior is changed.

## Chat-preview correction — 2026-10-28

Frank identified the screenshots already published in PR1867 as the source of
five defects: avatar size/appearance, timestamps, topic spacing, wrapped header
name and the old date divider. The navigation-only verification was too narrow;
it did not establish chat-component parity.

The old desktop capture at base59d524882 already contains a handwritten chat
header and message renderer. The cleanup made that same stale panel visible on
phones. Two fresh390x844 probes at6e494b579 measured a56px title with28px line
height. This is a Storybook composition defect; no deployed-chat regression is
established by those screenshots.

The correction uses SessionHeaderComponent, MessageTimeline and the real composer,
inside the production ChatStage card structure. It deletes the duplicated header,
topic/date/message markup and fallback composer. The curated synthetic session is
isolated from the existing RuntimeRoutingShell data. No production component or
stylesheet changed in this follow-up.

Before implementation, both focused stories failed the added canonical-header
assertion. During integration, a stronger browser assertion caught a wrapper
class collision: a session-list header class must not wrap the chat header.
The final composition uses the production wrapper and passes the original
reproduction twice per viewport390x844,820x1180,1440x900. Assertions cover:

- one-line ellipsis and header containment;
  -48px header/message avatars;
- one canonical topic label and date pill;
  -09:18,09:21,09:24 in message time rails;
- last timestamp reachable above the composer and retained navigation axes.

Run the independent geometry/capture check from the repository root:

```sh
node docs/agent-tasks/2026-10-27_storybook-cleanup/verify-chat-surface.mjs
# Optional: STORYBOOK_URL, CHAT_LOCALE, CHAT_EVIDENCE_DIR.
```

Local checks on Node24.15.0:14,523 unit tests passed,8skipped;838files passed,
1skipped. Script lint/TypeScript, style lint, Storybook TypeScript and production
build passed. The deployment-host guard passed. A separate read-only review
found no remaining blocking scope/provider/security issues.

The strict focused Storybook gate remains RED:2failed,1skipped. Content/layout
assertions pass; outstanding audit rules include aria-required-children,
aria-required-parent,label,color-contrast,nested-interactive and incomplete
aria-allowed-attr/color-contrast checks. No suppression or audit bypass was added.
These layout results are not an accessibility acceptance claim. CodeRabbit skips
this draft; no bot approval is claimed. Verification is local only.

The older published phone screenshot is the BEFORE state for this correction.
Final candidate captures are published through the gateway and indexed in PR1867;
raw images and browser state are not committed.

## Avatar outline follow-up — 2026-10-28

The shared header's legacy text-participant rule clipped the avatar stack's
2px outer separator. The first avatar starts at the stack's left edge, so
`overflow:hidden` cut off precisely the border next to the type pill.
A fresh390px browser reproduction failed the unclipped-outline assertion.
The sampled left-edge pixel was RGB101/110/121 (underlying pill) before and
255/255/255 (separator) after the scoped fix.

The exception now applies only to `.sessionInfo__participants.participantStack`;
text/loading labels retain truncation. Unlike the earlier story-only correction,
this follow-up intentionally fixes one shared production CSS rule. Header and
message dimensions, overlap, name ellipsis and topic placement remain unchanged.
Independent review found no blocking scope/security finding.

Validation:13 targeted unit tests pass; script lint/TypeScript,stylelint,
Storybook typecheck and production build pass. Twice-per-viewport390/820/1440
geometry checks pass with the new outline assertion. Three focused header stories
pass their interaction/layout assertions but fail the strict accessibility gate
for incomplete ARIA/contrast audits and the existing phone back-button contrast.
No suppression added. Full unit suite was not repeated for this CSS-only runtime
change; the preceding14,523-test run is recorded above, not claimed as a new run.

Use127.0.0.1:6017 for this local candidate. A separate Admin Storybook process
ownsIPv6 localhost:6017; it was neither stopped nor modified. This explains why
an unqualified localhost URL can resolve to a different catalogue.
