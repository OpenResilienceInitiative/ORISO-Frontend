# Element Call lobby in widget mode — research notes

Source of truth: [OpenResilienceInitiative/ORISO-ElementCall](https://github.com/OpenResilienceInitiative/ORISO-ElementCall)
(fork of element-hq/element-call) at revision `881fa91`, and the host integration in this repository at
`src/components/call/widget/useElementCallWidget.ts` (passes `skipLobby=true`, `header=none`, `confineToRoom=true`,
`intent=start_call`, `callIntent=audio|video`, and `perParticipantE2EE=true` unless
`appConfig.releaseToggles.enableCallMediaE2EE` is explicitly `false`; see `useElementCallWidget.ts:155-180`).
All `path:line` references below are relative to the `ORISO-ElementCall` repository root unless prefixed with `ORISO-Frontend/`.

## 1. What renders in the lobby with `skipLobby=false` (widget mode)

`GroupCallView` renders `LobbyView` whenever `!joined && !preload && !skipLobby` (`src/room/GroupCallView.tsx:527-532`),
independent of widget mode. The lobby consists of: a `VideoPreview` (live camera track or avatar placeholder + "Video loading..." status,
`src/room/VideoPreview.tsx:62-97`) with a large "Join call" button inside it (`src/room/LobbyView.tsx:208-226`);
a footer with `MicButton`, `VideoButton` and `SettingsButton` (`src/room/LobbyView.tsx:229-245`); and a `SettingsModal`
(`src/room/LobbyView.tsx:247-255`). Preview tracks are requested via LiveKit `usePreviewTracks` — audio is requested only to trigger the
permission prompt, video only when the video mute state is enabled (`src/room/LobbyView.tsx:140-166`).
Device selection lives exclusively in the settings modal: the Audio tab has microphone + speaker radio lists and a sound-effect volume
slider (`src/settings/SettingsModal.tsx:121-170`), the Video tab has camera selection + background blur (`SettingsModal.tsx:172-188`);
`DeviceSelection` renders nothing when there is at most one device (`src/settings/DeviceSelection.tsx:57`). There is **no** speaker test,
no mic level meter, and no inline device dropdown outside the modal.
`header=none` maps to `hideHeader` which only removes the room-name header bar (`GroupCallView.tsx:462`, `LobbyView.tsx:191-206`);
`confineToRoom=true` removes the "Back to recents" link and the red leave button (`LobbyView.tsx:116-120, 243`). In widget mode the
Profile settings tab is dropped (`SettingsModal.tsx:221`). So yes: with `header=none` + `confineToRoom=true` the lobby is a
headerless preview + mic/cam/settings footer + join button, fully functional.

## 2. `callIntent=audio`: camera off in lobby and call, still switchable

`callIntent` is parsed as an explicit enum param (`src/UrlParams.ts:405-408`) and, when set, forces
`defaultAudioEnabled=true` and `defaultVideoEnabled = callIntent === "video"` (`src/UrlParams.ts:564-568`); this is applied after
the `intent=start_call` preset (which itself sets `skipLobby=false, callIntent="video"`, `src/UrlParams.ts:427-430`) because the
derived config is spread last (`src/UrlParams.ts:585-590`). `MuteStates` reads these via `getUrlParams()` and builds the initial
enabled flags: `defaultVideoEnabled = Config.enable_video && (urlParams.defaultVideoEnabled ?? urlParams.callIntent !== "audio")`
(`src/state/MuteStates.ts:195-204, 222-235`). Because the lobby derives `videoEnabled` from `muteStates.video.enabled$`
(`LobbyView.tsx:92`) and only creates a video preview track when it is true (`LobbyView.tsx:149`), the camera is not opened in the
lobby, and the same `MuteStates` instance is handed to `ActiveCall` (`GroupCallView.tsx:482-493`), so the call starts video-muted too.
It is only a _default_: the `VideoButton` in the lobby (`LobbyView.tsx:237-241`) and in the call (`src/room/InCallView.tsx:718-724`)
calls `muteStates.video.toggle$`, so the user can turn the camera on at any time; nothing hides the button for audio intent.
Fork commit `b6c1e9d` ("audio call should trigger audio only") originally added `callIntent` parsing + the `defaultAudio/VideoEnabled`
derivation in `UrlParams.ts` and passed them from `RoomPage` into a 5-argument `MuteStates` constructor. The follow-up merge `6a5f2cf`
moved the defaults into `MuteStates` itself (reading `getUrlParams()`), reverting the constructor to 3 params (`MuteStates.ts:237-241`),
but `RoomPage` still passes 5 arguments (`src/room/RoomPage.tsx:85-93`) — `tsc` reports `TS2554: Expected 3 arguments, but got 5`
at `RoomPage.tsx:90`. The extra args are ignored at runtime; behaviour is driven by `MuteStates.ts:195-204`. Note also the fork's
`MuteState.enabledByDefault$` ignores upstream's `skipLobby`/`joined` logic (`MuteStates.ts:47-57`) and `canControlDevices$` ignores
the device list (`MuteStates.ts:71-91`), so mute buttons are never disabled for "no devices".

## 3. Speaker test / `setSinkId`

There is no "play a test sound" feature anywhere (no `test_sound`/`playTestSound` in `src/` or `locales/en/app.json`); only output
_selection_ exists (`SettingsModal.tsx:148-152`). `setSinkId` is used in one place: the Web Audio context for call sound effects
(join/leave/reactions), guarded by `"setSinkId" in audioContext && !controlledAudioDevices`
(`src/useAudioContext.tsx:166-183`). Remote participant audio gets its sink via LiveKit room options
`audioOutput.deviceId` at connection time (`src/state/CallViewModel/remoteMembers/ConnectionFactory.ts:131-138`).
Browser gating: `AudioOutput.available$` synthesises a `""` default device and returns an **empty map on Safari** (detected via
`window.GestureEvent`), which hides the Speaker section entirely there (`src/state/MediaDevices.ts:225-247`; `DeviceSelection.tsx:57`).
On iOS/`controlledAudioDevices` the list is replaced by a native picker button (`SettingsModal.tsx:136-147`).
Device _names_ are only available after `requestDeviceNames()` triggers a getUserMedia (`MediaDevices.ts:405-424`), which the
settings modal does on open (`SettingsModal.tsx:102-104`).

## 4. Lobby state carry-over and URL-driven mute presets

Yes. `MuteStates` is created once in `RoomPage` (`RoomPage.tsx:83-95`) and the same instance is passed to `LobbyView`
(`GroupCallView.tsx:456-465`) and `ActiveCall` (`GroupCallView.tsx:482-493`); device selection is global via `MediaDevicesContext`
(`src/MediaDevicesContext.ts:13-17`) and persisted settings (`src/settings/settings.ts:90`). Toggling mic/cam in the lobby therefore
is the state the call publishes with; the selected camera id is read from `devices.videoInput.selected$` in both places
(`LobbyView.tsx:123-125`, `ConnectionFactory.ts:120-129`).
Host-side presets: there is **no** dedicated `audioMuted`/`videoMuted` URL param. The only URL levers are `intent=` presets
(`UrlParams.ts:426-455`, the `*_voice` intents yield audio-on/video-off, `UrlParams.ts:482-495`) and the explicit `callIntent=audio|video`
(`UrlParams.ts:405-408, 564-568`). Other flags: `skipLobby`, `preload` (widget only), `header` (`none|standard|app_bar`, `hideHeader`
mentioned only as legacy), `confineToRoom`, `showControls`, `hideScreensharing`, `returnToLobby` (widget only), `controlledAudioDevices`,
`noiseSuppression`, `echoCancellation`, `autoLeave`, `sendNotificationType`, `waitForCallPickup`; `viaServers` is parsed only in SPA mode
(`UrlParams.ts:520, 533-561`). At runtime a widget host can push mute state with the `io.element.device_mute` widget action
(`{audio_enabled, video_enabled}`), and EC reports its state back with the same action (`MuteStates.ts:242-293`, `src/widget.ts:75-87`).
With `skipLobby=true&preload=true` the host's `io.element.join` action may carry `audioInput`/`videoInput` device _names_ that EC
matches against enumerated devices (`GroupCallView.tsx:242-297`).

## 5. Knock / "ask to join" in widget mode

Not usable. `useLoadGroupCall.fetchOrCreateRoom` short-circuits in widget mode: if `client.getRoom(roomId)` is not already joined it
throws "Room not found. The widget-api did not pass over the relevant room events/information." before any summary/knock logic
(`src/room/useLoadGroupCall.ts:246-260`). The `canKnock` → `knockRoom` → `waitForInvite` → auto-join flow (`useLoadGroupCall.ts:202-233,
286-316`) and the `RoomPage` "Request to join call" lobby (`RoomPage.tsx:152-199`) are reachable only from the SPA path, and rely on
`client.getRoomSummary`, `client.knockRoom`, `client.joinRoom` and `RoomEvent.MyMembership` on a full `MatrixClient`. The widget client
is `createRoomWidgetClient` scoped to a single room with the ORISO capability set (`src/widget.ts:107-111`,
`ORISO-Frontend/src/components/call/widget/orisoWidgetCapabilities.ts:7-35`), which contains no room-join/knock/summary capability at all;
the matrix-widget-api does not expose knock/join as a capability (there is no MSC for it), so this cannot be fixed by adding entries
to `orisoWidgetCapabilities.ts`. A host would have to implement knocking itself (own Matrix client → `/knock`, wait for invite, join)
and only then mount the widget, or use the standalone SPA session.

## 6. What a user sees when mic/camera permission is denied

Lobby: `usePreviewTracks` errors are caught in `onError`, which just logs and flips both mute states to off
(`LobbyView.tsx:157-166`); the preview falls back to the avatar (`VideoPreview.tsx:78-95`). No message is shown — the user sees muted
mic/cam icons and can still press Join.
In call: `LocalMember` catches `createAndSetupTracks` failures and classifies them via LiveKit `MediaDeviceFailure.PermissionDenied` or the
fork's `isBrowserMediaPermissionDenied` (which maps Chromium's `NotSupportedError` to "denied" when the Permissions API confirms it)
(`src/state/CallViewModel/localMember/LocalMember.ts:296-320`, `src/utils/errors.ts:167-200`). The result is a non-fatal
`MediaPermissionDeniedError` (`errors.ts:156-166`) rendered as an inline `role="alert"` banner in `InCallView` with title
"Media access blocked", body "Allow access to your microphone or camera in the browser settings, then try again. You can remain in the
call and receive other participants' media." and a "Try again" button (`src/room/InCallView.tsx:807-820`; `locales/en/app.json:124-125`).
While the error is set, the mic and camera buttons are shown muted and disabled (`InCallView.tsx:711-724`). Other media failures
become `UnknownCallError` in the same banner. Fatal errors go through `GroupCallErrorBoundary`/`ErrorView` full-screen
(`src/room/GroupCallErrorBoundary.tsx:60-110`).

## Implications for the ORISO Entry Room device check

- Flipping `skipLobby=false` (keeping `header=none`, `confineToRoom=true`, `callIntent`) gives, for free: camera preview, mic/cam
  on-off toggles, mic/camera/speaker device selection (behind the gear icon, only when >1 device), permission prompting before join, and
  mute/device state that carries into the call. Audio intent keeps the camera off but the user can enable it.
- What ORISO would have to build itself: a speaker test sound, a mic level meter, any explicit "permission denied" explanation in the
  lobby (EC silently mutes there), speaker selection on Safari, inline (non-modal) device pickers, and any host-side `audioMuted`/
  `videoMuted` URL preset (only `callIntent`/`intent` exist; runtime `io.element.device_mute` action is the alternative).
- Knock/"ask to join" is unavailable in widget mode regardless of capabilities; entry-room admission must stay a host-side feature.
- Housekeeping in the fork: `RoomPage.tsx:90` passes 5 args to a 3-arg `MuteStates` constructor (`TS2554`); harmless at runtime but
  should be cleaned up before relying on the lobby path.
