# 01 — Spike: what the timeline actually does (#1200)

All paths relative to `ORISO-Frontend/` unless noted. Verified on `upstream/dev` @ `ad5c8c21`.

## JOB1 — the double-check button

- `src/components/notificationsCenter/NotificationsCenter.tsx` (filter row): `DoneAllIcon` button, `title`/`aria-label` = `notifications.center.markAllRead` ("Mark all as read"), `onClick={markAllNotificationsAsRead}`.
- `src/globalState/provider/NotificationsProvider.tsx` `markAllNotificationsAsRead`: calls `apiMarkAllEventNotificationsRead()` → `PATCH ${endpoints.eventNotifications}/read-all` (`src/api/apiEventNotifications.ts`), then sets `readAt` on all loaded items and `unreadNotificationCount = 0`.
- Scope: activity-event read state only. No Matrix read receipts, no session state. Consistent with `CONTEXT.md`: `event_notification` is append-only, `markAsRead` is its only mutation; "Timeline collision" — the Activity Timeline is not the Matrix room timeline.
- Gap found: the button is always enabled, so with nothing unread it is a silent no-op → fixed (disabled state).

## JOB2 — the chat inside the detail pane

- Two modes, toggled by `notifications.center.showPreview` / `showDetails` (`showEmbeddedChat = embeddedChatOpen && canShowChatPreview`).
- **Details**: icon, client-rendered title/text (event descriptor), timestamp — `waitingSince` phrasing for `waiting_room.client.joined` (#845) — and handover consent actions for `case.handover.consent.requested`.
- **Preview**: `src/components/notificationsCenter/ConversationPreview.tsx` (#847): read-only, last 50 messages, rendered from the app's own Matrix client (ADR-AT-01: previews hydrated client-side, never server-side); "NEVER registers an active view and sends no read receipts — viewing the preview must not suppress anything". Replaced the `embeddedNotifications` iframe that booted a second SPA and suppressed `message.new` events.
- "Status" = the selected activity event's own state (type, read/unread, time) + a snapshot of the room; acting on the conversation goes through the event's action-target button.

## JOB3 — the extended filter bar

- `src/components/notificationsCenter/timelineFilter.ts`: `TIMELINE_FAMILY_ORDER` = requests, messages, drafts, handover, calls, system, appointments; `getFamiliesInFeed` → chips only for families present in the loaded feed; comment: "`all` … is no longer rendered as its own chip (design feedback 2026-07-12: the default state IS 'all')"; `unreadOnly` is a separate composable dimension (feedback 2026-07-12).
- `NotificationsCenter.tsx`: `familiesInFeed.map(renderFamilyChip)` + Unread toggle + bulk-read button; comment "no dedicated 'All' chip, no selection means everything".
- So the bar in the report (Requests + Unread + ✓✓) IS the extended bar for a feed that only contains request events. `CONTEXT.md` still said "'Alle' shows everything" → corrected.
- ADR-018 (line 37) requires "a deliberate exception to the current filter that discards system notifications" for the Erstantwort — a feed-level filter, unrelated to the chip row.

## ADR coverage

- `ORISO-Docs/oriso-platform/decisions/`: ADR-012 (line 6/77) only sequences "Future Timeline and Activity Timeline integration"; ADR-018 as above; ADR-004/005 (Matrix + Megolm) give the E2EE boundary. **ADR-AT-01/02/03** (Activity Timeline ADRs in "OrisoPlan WP-06") are referenced by `CONTEXT.md`, `timelineFilter.ts`, `ConversationPreview.tsx` but are **not in ORISO-Docs**. The "notification-center/timeline analysis from 2026-08-01" was not found in ORISO-Frontend, ORISO-Docs or the client workspace.
- Consequence: no relabeling/removal is justified by an ADR. Deliverables: findings comment; `CONTEXT.md` alignment; disabled-state fix (a UX defect, not a decision change); ADR-019 draft in ORISO-Docs to give the answers a home (product sign-off pending).
