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
