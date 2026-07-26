/**
 * Embeds Element Call as a Matrix *widget* rather than a standalone app.
 *
 * The hook returns the iframe URL to render and, once the iframe element is
 * handed to `attachIframe`, sets up the `postMessage` channel that lets the
 * widget drive our Matrix client. See `OrisoWidgetDriver` for why this replaced
 * the previous token-in-the-URL embedding.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientWidgetApi, MatrixWidgetType, Widget } from 'matrix-widget-api';
import {
	ClientEvent,
	EventTimeline,
	MatrixClient,
	MatrixEvent,
	RoomEvent
} from 'matrix-js-sdk';

import { OrisoWidgetDriver } from './OrisoWidgetDriver';
import { ALLOWED_TO_DEVICE_EVENT_TYPES } from './orisoWidgetCapabilities';
import { getElementCallBaseUrl } from '../../../resources/scripts/runtimeConfig';

export interface ElementCallWidgetOptions {
	/** The Matrix room the call takes place in. */
	roomId: string | null;
	/** Video or audio-only — Element Call starts with the camera off for audio. */
	isVideo: boolean;
	/** Skip the lobby and join immediately (we already asked the user). */
	skipLobby?: boolean;
}

export interface ElementCallWidget {
	/** `null` until every precondition is met; render nothing before then. */
	url: string | null;
	/** Ref callback for the iframe. Pass `null` on unmount to tear down. */
	attachIframe: (iframe: HTMLIFrameElement | null) => void;
	/** Set when the call cannot be embedded at all; surface it, do not swallow. */
	error: Error | null;
}

/**
 * Widget ids only need to be unique per host, and Element Call echoes ours back
 * on every message. Deriving it from the room keeps it stable across re-renders
 * so a remount does not orphan the previous messaging channel.
 */
const widgetIdForRoom = (roomId: string): string =>
	`oriso-call-${roomId.replace(/[^a-zA-Z0-9]/g, '')}`;

export const useElementCallWidget = (
	client: MatrixClient | null,
	{ roomId, isVideo, skipLobby = true }: ElementCallWidgetOptions
): ElementCallWidget => {
	const [error, setError] = useState<Error | null>(null);
	const apiRef = useRef<ClientWidgetApi | null>(null);
	const driverRef = useRef<OrisoWidgetDriver | null>(null);

	const url = useMemo(() => {
		if (!client || !roomId) return null;

		try {
			const origin = getElementCallBaseUrl();
			if (!origin) {
				throw new Error(
					'REACT_APP_ELEMENT_CALL_BASE_URL is not set — cannot embed the call.'
				);
			}

			const userId = client.getUserId();
			const deviceId = client.getDeviceId();
			const baseUrl = client.getHomeserverUrl();
			if (!userId || !deviceId || !baseUrl) {
				throw new Error(
					'Matrix session incomplete — cannot embed the call.'
				);
			}

			// Widget mode reads its configuration from query params (SPA mode uses
			// the fragment). Note what is *absent*: no access token. The widget
			// never receives our credentials; it asks us to act on its behalf.
			const params = new URLSearchParams({
				widgetId: widgetIdForRoom(roomId),
				parentUrl: window.location.origin,
				roomId,
				userId,
				deviceId,
				baseUrl,
				// Media encryption. Element Call derives per-participant keys and
				// distributes them over encrypted to-device messages, which only
				// works because the host client does the crypto (ADR-004).
				enableE2EE: 'true',
				perParticipantE2EE: 'true',
				confineToRoom: 'true',
				header: 'none',
				skipLobby: String(skipLobby),
				intent: 'start_call',
				callIntent: isVideo ? 'video' : 'audio'
			});

			setError(null);
			return `${origin}/room?${params.toString()}`;
		} catch (err) {
			setError(err as Error);
			return null;
		}
	}, [client, roomId, isVideo, skipLobby]);

	const attachIframe = useCallback(
		(iframe: HTMLIFrameElement | null) => {
			// Tear down any previous channel first — leaking a ClientWidgetApi
			// keeps a postMessage listener alive against a dead iframe.
			if (apiRef.current) {
				apiRef.current.stop();
				apiRef.current = null;
				driverRef.current = null;
			}

			if (!iframe || !client || !roomId || !url) return;

			const userId = client.getUserId();
			if (!userId) return;

			const driver = new OrisoWidgetDriver(client, roomId);
			const widget = new Widget({
				id: widgetIdForRoom(roomId),
				creatorUserId: userId,
				type: MatrixWidgetType.Custom,
				url
			});

			driverRef.current = driver;
			apiRef.current = new ClientWidgetApi(widget, iframe, driver);
			apiRef.current.setViewedRoomId(roomId);
		},
		[client, roomId, url]
	);

	// Push room and to-device traffic into the widget. The widget API only
	// *answers* requests; anything the widget needs to observe has to be fed.
	useEffect(() => {
		if (!client || !roomId) return undefined;

		const onTimeline = (
			event: MatrixEvent,
			_room: unknown,
			toStartOfTimeline: boolean | undefined
		) => {
			if (toStartOfTimeline) return; // backfill, not live
			if (event.getRoomId() !== roomId) return;
			apiRef.current
				?.feedEvent(event.getEffectiveEvent() as never, roomId)
				.catch(() => {
					/* the widget may have gone away mid-call */
				});
		};

		const onToDevice = (event: MatrixEvent) => {
			// The host client receives all to-device traffic, including device
			// verification and room-key material that has nothing to do with the
			// call. Forwarding it wholesale would hand that to a separate origin.
			if (!ALLOWED_TO_DEVICE_EVENT_TYPES.has(event.getType())) return;
			apiRef.current
				?.feedToDevice(
					event.getEffectiveEvent() as never,
					event.getWireType() === 'm.room.encrypted'
				)
				.catch(() => {
					/* see above */
				});
		};

		client.on(RoomEvent.Timeline, onTimeline);
		client.on(ClientEvent.ToDeviceEvent, onToDevice);

		return () => {
			client.off(RoomEvent.Timeline, onTimeline);
			client.off(ClientEvent.ToDeviceEvent, onToDevice);
		};
	}, [client, roomId]);

	// Replay the current call membership so a widget that mounts mid-call sees
	// who is already there instead of an empty room.
	useEffect(() => {
		if (!client || !roomId || !apiRef.current) return;
		const state = client
			.getRoom(roomId)
			?.getLiveTimeline()
			.getState(EventTimeline.FORWARDS);
		state
			?.getStateEvents('org.matrix.msc3401.call.member')
			.forEach((event) => {
				apiRef.current
					?.feedEvent(event.getEffectiveEvent() as never, roomId)
					.catch(() => {
						/* best effort */
					});
			});
	}, [client, roomId, url]);

	useEffect(
		() => () => {
			apiRef.current?.stop();
			apiRef.current = null;
		},
		[]
	);

	return { url, attachIframe, error };
};
