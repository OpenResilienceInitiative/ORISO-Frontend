# ADR-020: Signal feed changes over Matrix to-device, keep the feed itself on REST

- Status: Proposed
- Date: 2026-09-16
- Owners: ORISO Frontend and Platform
- Decision scope: ORISO-Frontend, ORISO-UserService
- Related: `adr-018-element-call-matryoshka.md` (Matrix Widget API, to-device contract);
  platform `ADR-004` (Matrix-only runtime path); WP-06 `ADR-AT-01` / `FE-H01`
  (no notification content leaves the persisted feed); UserService `8b75eddd`
  (the same hook for the retired LiveService) and `c62ae561` (its removal);
  `ORISO-Frontend` branch `feat/feed-events-refresh-session-lists` ("P1")

> A platform-level twin of this ADR should follow in `ORISO-Docs`
> (`oriso-platform/decisions/`) as **ADR-027** — 024–026 are parked on `email-v2.1`.
> The retirement of LiveService itself was never recorded in any ADR; this is the
> first citable record of what replaced its notification nudge.

---

## Context

The realtime relay ("LiveService", STOMP/SockJS) was retired in July 2026
(ORISO-UserService#901/#902: no deployment, 152 failed deliveries in 12 h).
`DeprecatedLiveProxyController` is a 410 tombstone.

Since then the client learns about most events from a **15 s poll** of the persisted
Activity-Timeline feed (`GET /service/users/event-notifications`, written by
`EventNotificationService.createEvent` / `createEventOnce`). Only new chat messages
arrive live, through the client's own Matrix sync
(`src/services/matrixLiveEventBridge.ts` → `messageEventEmitter`).

Commit `8b75eddd` had already added exactly the hook we want — fire a content-free
nudge to the recipient whenever a feed row is persisted — and `c62ae561` removed it
together with the dead transport. The hook points are still there and still correct.

"P1" (`feat/feed-events-refresh-session-lists`) makes the frontend translate new feed
rows into session-list refreshes. What is missing ("P2") is a low-latency **signal**
that the feed changed, so the refresh happens now rather than up to 15 s later.

Non-negotiable constraint: **no notification content may leave the persisted feed.**
The signal may say "something changed" and nothing more (`ADR-AT-01` / `FE-H01`).

### Measured current state (2026-09-16, `origin/dev`)

- `NotificationsProvider.tsx:973` — `setInterval(refreshNotificationFeedSafe, 15000)`.
- `NotificationsProvider.tsx:1008-1012` — any `messageEventEmitter` emission already
  triggers `refreshNotificationFeed` behind a **400 ms debounce**. The client side of
  P2 therefore needs a producer, not a new consumer.
- `MatrixSynapseService` already holds a technical admin identity
  (`matrix.adminUsername` / `adminPassword`, cached client access token via
  `getAdminToken()`), and already creates rooms, invites, sends messages and syncs.
- `matrix-js-sdk` is pinned at `^38.4.0`, which emits
  `ClientEvent.ReceivedToDeviceMessage`; rust-crypto passes unencrypted, unknown
  to-device types through untouched (`ProcessedToDeviceEventType.PlainText`).

## Decision

**Option A — Matrix as the event bus, transported as a to-device message.**

UserService sends a **content-free** custom event `org.oriso.feed.updated` with an
**empty content object** to the recipient, as the technical admin identity, via
`PUT /_matrix/client/v3/sendToDevice/{eventType}/{txnId}` addressed to `{"*": {}}`
(all of that user's devices). The frontend's existing `matrixLiveEventBridge` picks it
up from the sync it already runs and emits through `messageEventEmitter`, so
`refreshNotificationFeed` runs behind its existing 400 ms debounce.

Three refinements over the 2026-07 LiveService hook:

1. **To-device, not a room.** The signal needs no shared room, writes nothing into any
   room timeline, and is not persisted in Matrix. **No per-user signalling room has to
   be provisioned, so existing users need no migration at all.** This is the main
   reason this option is cheap.
2. **After commit.** When a transaction is active the send is deferred to
   `afterCommit`, so a client can never refresh into a row that is not visible yet, and
   a rolled-back transaction signals nothing. The old hook fired inside the transaction.
3. **Switchable.** `matrix.feedSignal.enabled` (`MATRIX_FEED_SIGNAL_ENABLED`, default
   `true`) turns it off without a rollback; the 15 s poll stays as the floor.

The feed contents keep coming exclusively from the authenticated REST endpoint. The
signal is a nudge, never a carrier.

## Comparison

|                                  | **A — Matrix signal** (chosen)                                                                                                                                                                                            | **B — SSE / streaming on UserService**                                                                                                                                                                                                                                                                                                                   | **C — cheaper poll, ETag/304**               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Repos touched**                | ORISO-UserService, ORISO-Frontend                                                                                                                                                                                         | ORISO-UserService, ORISO-Frontend, **ORISO-Helm** (ingress/timeouts), **ORISO-Kubernetes** (Redis), likely ORISO-Infra                                                                                                                                                                                                                                   | ORISO-UserService, ORISO-Frontend            |
| **Migration for existing users** | **None.** To-device needs no room, no state, no backfill. (A room-based variant would need lazy, idempotent provisioning per user — avoided.)                                                                             | None in data, but every replica needs Redis pub/sub wiring before it is correct                                                                                                                                                                                                                                                                          | None                                         |
| **Latency**                      | Sub-second (rides the sync the client already holds open)                                                                                                                                                                 | Sub-second                                                                                                                                                                                                                                                                                                                                               | Still 15 s (only cheaper, not faster)        |
| **Failure modes**                | Synapse down or admin token unavailable → no signal, poll still covers it. Signal lost if no device is syncing → next poll covers it. Sender is the admin identity, so a client must not trust it as evidence of anything | Replica affinity: without Redis pub/sub a client connected to replica 2 never sees an event written on replica 1 — silent, not loud. Ingress/proxy buffering and idle timeouts on an **operator-run** (Neusta) cluster silently kill streams. Connection-count pressure; auth without a token in the URL needs a cookie or a short-lived ticket endpoint | None new. Simply does not solve P2           |
| **Privacy**                      | Empty content; recipient implicit; nothing persisted in Matrix. Fully inside `ADR-AT-01`/`FE-H01`                                                                                                                         | Same is achievable (event name only), but a long-lived per-user stream is itself new metadata, and needs a DSFA note                                                                                                                                                                                                                                     | Unchanged                                    |
| **Effort (rough)**               | **BE ~1–2 d, FE ~0.5 d, ops ~0** (one env var)                                                                                                                                                                            | BE ~5–8 d, FE ~2 d, **ops ~3–5 d and an operator dependency we do not control**                                                                                                                                                                                                                                                                          | BE ~1 d, FE ~0.5 d, ops 0                    |
| **Architecture fit**             | Matches the "Matrix-only" direction (`ADR-004`); reuses transport already in production                                                                                                                                   | Re-introduces a second realtime transport — precisely what #901/#902 retired                                                                                                                                                                                                                                                                             | Fits, but is an optimisation, not a solution |

**Recommendation: A.** It is the only option that is both sub-second and free of new
infrastructure, it reuses a transport that is already load-bearing in production, and
to-device removes the one thing that made it look expensive (per-user room
provisioning and a migration for existing users). B re-creates the failure class that
#901/#902 just retired and puts the outcome in the operator's hands. C is worth doing
on its own merits (it cuts poll cost) but does not deliver P2 — it can be layered on
top later.

**Fallback if A is blocked:** if the technical Matrix identity turns out to be unable
to send to-device messages on the production homeserver, fall back to C plus a shorter
interval while foregrounded, and re-open B only if sub-second latency is a hard
requirement.

## Consequences

**Positive:** feed and session lists react in well under a second; no new service, no
new port, no ingress work; the existing 400 ms debounce already collapses bursts; the
15 s poll remains the correctness floor, so the feature degrades to today's behaviour
rather than to nothing; one env var disables it.

**Negative / cost:** UserService now depends on Synapse for a (best-effort) part of the
notification path — logged and swallowed, never propagated; the admin identity sends
to-device traffic proportional to feed-row creation, so a chatty producer becomes
homeserver load; `ClientEvent.ReceivedToDeviceMessage` is SDK-version-sensitive (the
older `toDeviceEvent` is deprecated); no Synapse-side proof exists yet that the admin
user may send to-device on the production homeserver — that is the one open
verification.

## Alternatives considered

- **Per-user signalling room + `org.oriso.feed.updated` timeline event.** Rejected —
  same latency as to-device but needs lazy idempotent room provisioning, a migration
  story for every existing user, and pollutes room state. The frontend bridge accepts
  the event from the timeline anyway, so this remains available with no client change.
- **Reuse an existing shared room per recipient.** Rejected — no room is guaranteed to
  exist for every recipient, and a signal in a counselling room is visible context.
- **Matrix push (sygnal / APNs-FCM).** Rejected for P2 — that is the mobile-push story,
  not an in-session refresh nudge, and it is a much larger ops surface.
- **Carry the notification in the signal.** Rejected — violates `ADR-AT-01` / `FE-H01`.

## Productionisation (2026-09-16)

Option A was accepted by the owner and hardened. What changed against the spike, and why:

- **The Matrix call never runs on the caller's thread.** It is handed to a dedicated bounded pool
  (`matrixFeedSignalExecutor`: core 1, max 2, queue 500). The rejection policy is `AbortPolicy`,
  explicitly _not_ `CallerRunsPolicy` — caller-runs would put an HTTP call back on the request
  thread that just persisted a notification, which is the blocking this design exists to avoid. A
  saturated pool drops the signal with a warning and counts it as `failed`.
- **Per-recipient coalescing** (`matrix.feedSignal.coalesceMillis`, default 500 ms). A burst of N
  rows for one recipient costs one to-device message, sent at the **end** of the window.
  Trailing rather than leading edge on purpose: the one signal then covers every row of the burst,
  so the client's single refresh sees all of them. The cost is latency — end-to-end is roughly the
  window plus the client's existing 400 ms debounce. Set the window to `0` to get one signal per
  row (lowest latency, highest Synapse load).
- **Telemetry:** one counter, `oriso.matrix.feed_signal` (Prometheus:
  `oriso_matrix_feed_signal_total`), tagged only with `outcome` ∈ {`sent`, `coalesced`,
  `skipped_no_identity`, `disabled`, `failed`}. No user, room, tenant or agency tag — the signal
  exists so that nothing about a notification leaves the persisted feed, and its telemetry must not
  undo that. A test asserts the tag set.
- **Client-side fallback:** the bridge listens to both `receivedToDeviceMessage` and the deprecated
  `toDeviceEvent`, so an older matrix-js-sdk still delivers the signal. matrix-js-sdk v38 emits
  both for the _same_ message, so a per-tick guard collapses the pair into one refresh.
- **Breadcrumb:** the client logs a content-free `console.debug('[oriso] feed signal received')`,
  so "did this refresh come from the signal or from the 15 s poll?" is answerable in a browser
  console without a network trace.

The delay timer deliberately does **not** use a Spring `TaskScheduler` bean: a lone `TaskScheduler`
(or `ScheduledExecutorService`) bean in the context is adopted by `@EnableScheduling` as _the_
scheduler for every `@Scheduled` job in UserService, which would make feed signals and batch jobs
starve each other. It is a one-thread daemon timer behind the `FeedSignalDelayScheduler` interface.

Still open: no Synapse-side proof that the technical admin identity may send to-device on the
production homeserver. That remains the one gate before this can be trusted in production; the
15 s poll covers the failure case either way.
