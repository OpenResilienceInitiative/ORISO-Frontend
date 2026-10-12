# Test evidence

Environment: local only, Node 22.23.3, Chrome, Storybook 375×812 viewport. Static heading and build identity fixture; no live backend verified.

- Targeted navigation Storybook RED: 6 passed, 1 failed on version bottom 804 <= navigation top 734.
- Targeted navigation Storybook GREEN: 7 passed. Verifies scrollport fits viewport, version clears bar, language/logout stay reachable after scrolling, and Enter activates focused logout.
- `npm run lint:scripts` → pass (exit 0).
- `npm run lint:style` → pass (exit 0).
- `npm run test:unit` → pass (exit 0), 701 files and 12,305 tests passed; log `work/unit.log`.
- `npm run build` → pass (exit 0), production compilation and postbuild hardcoded-host validation passed; log `work/build.log`.
- `git diff --check` → pass.
- Parent independent review → pass.

Proof: `docs/storybook/issue-1683-mobile-navigation/01-before-375-shell.jpg` and `02-after-375-actions.jpg`. Before shows version over labels; after shows cleared version and scrolled language/logout with focus ring. Screenshots do not alone prove keyboard activation; the play test does.

Local runner setup: symlinked dependency directory caused Vite addon import failure; replaced it with an APFS clone of the same installed dependency directory. Initial sandbox localhost listen restriction required normal escalation; no source configuration was changed for the environment workaround.
