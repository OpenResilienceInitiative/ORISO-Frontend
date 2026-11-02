# Investigation and independent planning

Baseline: `origin/dev` at `59d5248824ac62da4771c8173efa91ca6fa59aff`.
Independent read-only planner and icon/legacy explorer checked current source.

- `SessionListCreateChat` has no runtime importer; only its own story and the
  composite reference it. The toolbar already provides creation.
- `Login` still navigates to `/password-reset`; `app.tsx` mounts
  `RequestPasswordReset` there. No redesigned request-email dialog was found.
  `PasswordReset variant="dialog"` changes an authenticated user's password and
  is a different operation. Remove the rejected story, preserve the route.
- `NavigationSidebar` supplies `app__wrapper`; the consultant composition omits
  it and reserves 85px even below the 900px horizontal-navigation breakpoint.
- Published graph generation `747d86fc-7221-43a7-a8b9-6081be8d394c` was fetched
  online. It was generated 2026-09-21 from frontend main
  `b3487d6a33e5174cef30f578e9f46b8f120c0da9`: historical orientation, not current
  source proof. No relevant accepted UI-governing graph edge was found.
- Dev Storybook's published index contains 2253 entries. Configured Predev
  Storybook MCP returned HTTP 502 at initialization; no MCP verification is
  claimed. Source, real browser story tests and local previews are separate evidence.

See `icon-and-legacy-audit.md` for the inventory and verified story links.
