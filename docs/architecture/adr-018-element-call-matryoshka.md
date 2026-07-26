# ADR-018: Embed Element Call via the Matrix Widget API

- Status: Proposed
- Date: 2026-07-26
- Owners: ORISO Frontend and Platform
- Decision scope: ORISO-Frontend, ORISO-ElementCall, ORISO-Livekit,
  ORISO-Helm, ORISO-UserService, and ORISO-E2E

## Context

ORISO previously embedded Element Call in standalone SPA mode. The frontend
minted a second Matrix session on an `ORISO_CALL_*` device, placed its access
token and identity in the iframe URL, and let the iframe run a second Matrix
client and sync loop.

That design created one security and reliability boundary too many:

- the iframe could not safely share the host device's crypto state;
- call-room events and per-participant media keys could not consistently use
  Matrix encryption;
- a bearer token crossed the iframe boundary and appeared in a URL;
- each browser accumulated an additional Matrix device;
- the second sync and refresh loop could fail independently of the app; and
- local credential and hangup `postMessage` protocols diverged from upstream
  Element Call.

Temporarily forcing unencrypted events or disabling media E2EE would only hide
those structural faults. Rocket.Chat and Jitsi are retired platforms and must
not be retained as fallback implementations.

## Decision

ORISO embeds Element Call exclusively in Matrix widget, or "matryoshka", mode.
The ORISO frontend is the sole Matrix and crypto owner. Element Call provides
the call UI and LiveKit media client, but performs Matrix operations through
the host's `ClientWidgetApi`.

The resulting boundary is:

1. The host initializes one crypto-capable Matrix client on its existing
   `ORISO_WEB_*` device.
2. The host joins the encrypted call room before mounting the iframe.
3. The iframe URL contains `widgetId`, `parentUrl`, `roomId`, `userId`,
   `deviceId`, `baseUrl`, presentation parameters, and
   `perParticipantE2EE=true`. It never contains an access token.
4. The room-bound `OrisoWidgetDriver` translates approved widget operations to
   the host Matrix client. Matrix encrypts outgoing room and to-device events
   through the same crypto state used for chat.
5. The iframe handles UI and LiveKit media only. It does not log in, start a
   second sync, or create a Matrix device.

There is no runtime feature flag or compatibility branch back to SPA mode,
Rocket.Chat, or Jitsi. Rollback means deploying the previous complete,
internally consistent release bundle. It does not mean selectively restoring a
legacy transport inside a new bundle.

## Widget Security Contract

Element Call is a first-party widget, but it acts with the logged-in user's
authority. Capabilities are therefore granted from an explicit allowlist in
`src/components/call/widget/orisoWidgetCapabilities.ts`; unknown capabilities
are denied and logged.

### Room events

The widget may use only:

- `org.matrix.rageshake_request`
- `io.element.call.encryption_keys`
- `m.call.encryption_keys`
- `org.matrix.msc3401.call.encryption_keys`
- `m.reaction`
- `m.room.redaction`
- `io.element.call.reaction`
- `org.matrix.msc4075.call.notify`
- `m.call.notify`
- `org.matrix.msc4075.rtc.notification`
- `m.rtc.notification`
- `org.matrix.msc4310.rtc.decline`
- `m.rtc.decline`

### State events

Write access is limited to call membership:

- `org.matrix.msc3401.call.member`
- `m.call.member`

Read access adds:

- `m.room.create`
- `m.room.name`
- `m.room.member`
- `m.room.encryption`

The iframe cannot change room names, membership, encryption configuration, or
any counselling-room content outside the active call room.

### To-device events

The widget may use the Matrix call negotiation event family:

- `m.call.invite`
- `m.call.candidates`
- `m.call.answer`
- `m.call.hangup`
- `m.call.reject`
- `m.call.select_answer`
- `m.call.negotiate`
- `m.call.sdp_stream_metadata_changed`
- `org.matrix.call.sdp_stream_metadata_changed`
- `m.call.replaces`
- `io.element.call.encryption_keys`
- `m.call.encryption_keys`
- `org.matrix.msc3401.call.encryption_keys`

Key-bearing to-device events must be encrypted. The driver rejects an
unencrypted request and also refuses encrypted sending when the host crypto
stack is unavailable.

### Other capabilities and channel checks

The widget may request:

- `m.always_on_screen`
- `org.matrix.msc2931.navigate`
- `org.matrix.msc4157.send.delayed_event`
- `org.matrix.msc4157.update_delayed_event`

The host auto-approves OpenID for this first-party widget only after validating
that the Matrix client returned a complete, non-expired credential object.
Invalid or failed requests are blocked.

Every widget request is confined to the active call room. Incoming browser
messages must match both the configured Element Call origin and the mounted
iframe's `Window` object. This prevents a different same-page frame or origin
from driving the privileged widget channel.

## MatrixRTC Authorization and Encryption

Element Call requests Matrix OpenID through the widget API. The public
MatrixRTC policy gateway validates the exact ORISO origin, the OpenID identity,
and current membership of the requested room before invoking the internal
LiveKit token issuer. The issuer is not public and must not log identifiers,
OpenID tokens, or LiveKit credentials.

Call rooms are encrypted Matrix rooms. Call data is sent by the host's
crypto-capable client, and `perParticipantE2EE=true` enables participant media
key exchange over encrypted Matrix events. Synapse MSC4140 delayed events are
enabled so crashed or disconnected participants receive a bounded delayed
leave instead of remaining as ghosts.

## Data and Device Cutover

No user or device migration is required for the current pre-production
environment:

- disposable test accounts may be deleted and recreated;
- stale `ORISO_CALL_*` devices are enumerated and deleted with the guarded
  administration script after the SPA path is gone;
- Rocket.Chat identifier columns are physically removed by UserService
  Liquibase changesets; and
- no Rocket.Chat room, account, token, or Jitsi meeting identifier is mapped
  into the Matrix target model.

Historical Liquibase files remain immutable audit history. Their final
effective schema contains no Rocket.Chat columns.

## Rollout

The cutover is one coordinated release bundle:

1. Publish immutable images for the MatrixRTC gateway and internal issuer.
2. Replace placeholder digests and remove all floating image references.
3. Rotate gateway, issuer, Matrix, and LiveKit secrets.
4. Deploy Synapse delayed events and the MatrixRTC authorization boundary.
5. Deploy UserService schema/API cleanup.
6. Deploy the Matryoshka-only frontend and Element Call builds.
7. Run the two-user PreDev E2E gate before promoting the same immutable bundle.
8. Delete stale `ORISO_CALL_*` devices only after the application gate passes.

If a stop condition occurs, roll back the complete bundle to its last known
good immutable versions. Because PreDev identities and content are disposable,
the preferred recovery is reset and recreate, not a compatibility migration.

## Consequences

Positive consequences:

- no Matrix access token crosses the iframe boundary;
- one Matrix device and sync loop serve chat and calls;
- call events and media keys use the host's working crypto stack;
- the Element Call fork moves closer to upstream widget behavior;
- Rocket.Chat and Jitsi cannot silently return as runtime fallbacks; and
- authorization is enforced at both the widget and MatrixRTC service
  boundaries.

Trade-offs:

- the host must faithfully implement and test the widget API contract;
- Element Call and host capability changes must be coordinated;
- popup-window calls are replaced by an in-app overlay; and
- media-E2EE rollout cannot mix old SPA clients with new widget clients.

## Exit Criteria

The decision is implemented only when all of the following are true:

- active code, config, generated contracts, CI, Helm templates, and deployed
  resources contain no Rocket.Chat or Jitsi runtime path;
- iframe URLs, browser messages, logs, and traces contain no Matrix access
  token;
- widget capability, room-scope, origin/source, OpenID, delayed-event, and
  encrypted to-device tests pass;
- Synapse reports `org.matrix.msc4140` enabled;
- two independent browser contexts exchange media, every reaction, and
  hand-raise/lower, then hang up on both sides;
- neither browser reports an encrypted-room or crypto-support error;
- no new `ORISO_CALL_*` device appears during the E2E run;
- old `ORISO_CALL_*` devices are absent after the guarded cleanup;
- MatrixRTC gateway and issuer use immutable non-placeholder image digests;
- production-shaped secrets have been rotated and are absent from Git; and
- dashboards and alerts show successful authorization without identity,
  token, or room-ID leakage.

## Out of Scope

- Replacing ORISO's phase-one `org.oriso.call.invite` and
  `org.oriso.call.hangup` ringing protocol with `m.rtc.notification`.
- Removing the separate legacy Matrix `MatrixCall` path for 1:1 calls.
- Migrating pre-production users, devices, appointments, or chat history.

## Implementation References

- `src/components/call/widget/useElementCallWidget.ts`
- `src/components/call/widget/OrisoWidgetDriver.ts`
- `src/components/call/widget/orisoWidgetCapabilities.ts`
- `src/services/matrixClientService.ts`
- `ORISO-ElementCall/src/widget.ts`
- `ORISO-Livekit/src/server.mjs`
- `ORISO-Helm/templates/matrix/matrix-configmaps.yaml`
- `ORISO-Helm/scripts/cleanup-oriso-call-devices.sh`
- `ORISO-E2E/tests/call-widget-mode.spec.ts`
