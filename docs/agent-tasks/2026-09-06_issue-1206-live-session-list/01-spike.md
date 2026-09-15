# 01 — Root cause (#1206)

Phase 1 of `superpowers:systematic-debugging`. Verified on `upstream/dev` @ `501959f3` by reading the code, not from the trace alone.

## How a session list is supposed to stay live

- `WebsocketHandler.tsx` opens a STOMP/SockJS connection to `endpoints.liveservice` and subscribes to `/user/events`. It also bridges Matrix room traffic: `matrixLiveEventBridge.on('directMessage', …)` → `messageEventEmitter.emit({ roomId, timestamp })`.
- `SessionsList.tsx` consumes `messageEventEmitter` in `onNewMessageEvent` (~line 860): `refreshEnquiryList` / `refreshSessionList` trigger a refetch; otherwise the `roomId` is used to _touch_ the matching session in place.

## Break 1 — a message from a room the list has never loaded is dropped (AC1)

`onNewMessageEvent` ends with:

```
if (!roomId) return;
touchSessionsByRids([{ rid: roomId, … }]);
const touchesLoadedSession = sessionsRef.current.some(s => s?.chat?.matrixRoomId === roomId || s?.session?.matrixRoomId === roomId);
if (touchesLoadedSession) handleRIDsRef.current([roomId]);
```

and `touchSessionsByRids` (line 808) maps each rid to the **existing** session and `return null` when there is none. So for a **new** enquiry/room: the emitter fires, the room matches nothing, both branches no-op, and **the list never learns the room exists**. That is precisely "I must hard refresh to see a new user".

## Break 2 — an accepted enquiry only raised a toast (AC2)

The `/user/events` switch handled `anonymousEnquiryAccepted` by calling `addNotification(...)` and nothing else, while its siblings (`newAnonymousEnquiry`, `anonymousConversationFinished`) set a state flag whose effect emits the refresh flags. So on acceptance the entry stayed in every counsellor's request list and never appeared in the assignee's conversation list — the request→chat transition needed a reload. Consistent with the archaeology's "subscription/producer wiring is the prime suspect" and with #851 having reworked that producer path.

## What is deliberately _not_ the cause

- Not the 15 s interval: it exists only while the Live-Chat chip is selected (`sessionToolbarChip !== 'liveChat'` returns early), so it never covered the general case.
- Not the raw `[[align:left]]…` preview in the same screenshot — that is #1191 / #1117 and the issue says not to fix it here.

## Fix

1. `sessionsList/liveListRefresh.ts` — `isRoomInSessions` (is this room already in the list?) and `createRefreshThrottle` (one refetch per burst). `SessionsList` refetches the tab's list when a message arrives for an unknown room instead of silently dropping it.
2. `app/stompListRefresh.ts` — `resolveStompListRefresh(eventType)` maps the membership-changing live events to their refresh flags, case-insensitively (the backend sends both camelCase and ALL-CAPS). `WebsocketHandler` now follows its own sibling pattern for `anonymousEnquiryAccepted`: state flag → effect that emits `{refreshEnquiryList, refreshSessionList}` **and** keeps the toast.

Both are pure-function-first so the behaviour is unit-tested without mounting the 900-line list component.
