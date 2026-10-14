# Local verification

The repair lets pointer and touch users scroll the existing protected card. It does not change the handover state machine, access predicate, API request, normal chat layout or global footer.

**For developers — measured regression and required gates:**

```text
Node: 22.12.0, locked npm ci --legacy-peer-deps
RED before production change: 2 failed (390/320), 2 passed (820/1440), 16.4s.
GREEN after change: 12 passed (390/820/1440/320, de/en/fr), 13.5s.
Includes complete protection-title bounds after pointer scrolling back to top.
Full test:unit: 720 files, 12532 tests passed, 302.85s.
lint:scripts (ESLint + TypeScript): passed.
lint:style: passed.
build + postbuild forbidden-host scan: passed.
typecheck:storybook: passed after final Storybook changes.
Focused Storybook: 2 files / 13 tests + axe passed (final readback recorded below).
Independent review: no production findings; one public oracle strengthening requested
by the root's independent reviewer and implemented with passing browser evidence.
```

The base is `26e1b7ea7d7d94f1fb6516dd235077e3b0ad139b` on dev. The final image-containing commit pins the source. The produced build lives in the worktree's ignored `build/` directory; its application HTML is `beratung-hilfe.html`. Runtime configuration is injected through `build/config.js` by the Docker entrypoint and wins over build-time environment values.

Screenshots and captions live at `docs/storybook/issue-1187-responsive-handover-curtain/`. RED/GREEN public logs are beside this file. Full local gate logs remain outside Git in `/tmp/1187-{unit,lint-scripts,lint-style,build,storybook-tests-final}.log`.

Actual Dev and root candidate Docker acceptance are separate and owned by the root agent. This worker did not submit a live request, mutate a test account, push, open a PR, merge or deploy. The root's actual Dev evidence retracted the initial width hypothesis: settled widths fit, while the protection notice/controls were vertically clipped.
