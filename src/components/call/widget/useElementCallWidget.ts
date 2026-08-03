/**
 * Embeds Element Call as a Matrix *widget* rather than a standalone app.
 *
 * The hook returns the iframe URL to render and, once the iframe element is
 * handed to `attachIframe`, sets up the `postMessage` channel that lets the
 * widget drive our Matrix client. See `OrisoWidgetDriver` for why this replaced
 * the previous token-in-the-URL embedding.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	ClientWidgetApi,
	type IWidgetApiRequest,
	MatrixWidgetType,
	Widget
} from 'matrix-widget-api';
import {
	ClientEvent,
	MatrixClient,
	MatrixEvent,
	RoomEvent,
	RoomStateEvent
} from 'matrix-js-sdk';

import { OrisoWidgetDriver } from './OrisoWidgetDriver';
import {
	ALLOWED_RECEIVE_STATE_EVENT_TYPES,
	ALLOWED_ROOM_EVENT_TYPES,
	ALLOWED_TO_DEVICE_EVENT_TYPES
} from './orisoWidgetCapabilities';
import { getElementCallBaseUrl } from '../../../resources/scripts/runtimeConfig';
import { appConfig } from '../../../utils/appConfig';

export interface ElementCallWidgetOptions {
	/** The Matrix room the call takes place in. */
	roomId: string | null;
	/** Video or audio-only — Element Call starts with the camera off for audio. */
	isVideo: boolean;
	/** Skip the lobby and join immediately (we already asked the user). */
	skipLobby?: boolean;
	/** Called when Element Call asks the host to close or reports a hangup. */
	onClose?: () => void;
	/** Keeps the floating host surface visible when Element Call requests it. */
	onAlwaysOnScreenChange?: (alwaysOnScreen: boolean) => void;
}

export interface ElementCallWidget {
	/** `null` until every precondition is met; render nothing before then. */
	url: string | null;
	/** Ref callback for the iframe. Pass `null` on unmount to tear down. */
	attachIframe: (iframe: HTMLIFrameElement | null) => void;
	/** Requests a clean MatrixRTC leave through the widget protocol. */
	hangup: () => Promise<void>;
	/** Set when the call cannot be embedded at all; surface it, do not swallow. */
	error: Error | null;
}

const widgetIdForRoom = async (
	roomId: string,
	instanceNonce: string
): Promise<string> => {
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${roomId}\u0000${instanceNonce}`)
	);
	return `oriso-call-${Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')}`;
};

const fragmentParams = (url: string): URLSearchParams => {
	const hash = new URL(url).hash;
	const queryStart = hash.indexOf('?');
	return new URLSearchParams(queryStart === -1 ? '' : hash.slice(queryStart));
};

/**
 * Navigate a call iframe to a blank document so the browser releases the camera
 * and microphone it holds.
 *
 * Removing the element from the DOM is not reliable enough on its own: the
 * capture indicator can stay lit after a call ends, which on a counselling
 * platform reads to the person on the other side as still being watched.
 */
const releaseIframeDevices = (iframe: HTMLIFrameElement | null): void => {
	if (!iframe) return;
	try {
		iframe.src = 'about:blank';
	} catch {
		/* the iframe may already be detached; the devices go with it */
	}
};

export const useElementCallWidget = (
	client: MatrixClient | null,
	{
		roomId,
		isVideo,
		skipLobby = true,
		onClose,
		onAlwaysOnScreenChange
	}: ElementCallWidgetOptions
): ElementCallWidget => {
	const [error, setError] = useState<Error | null>(null);
	const [url, setUrl] = useState<string | null>(null);
	const apiRef = useRef<ClientWidgetApi | null>(null);
	const driverRef = useRef<OrisoWidgetDriver | null>(null);
	const attachedIframeRef = useRef<HTMLIFrameElement | null>(null);
	const instanceNonceRef = useRef(globalThis.crypto.randomUUID());
	const messageGuardRef = useRef<
		((event: MessageEvent<unknown>) => void) | null
	>(null);

	// A widget client cannot join rooms. Gate iframe creation on the host's
	// membership so Element Call never starts against an invited/unknown room.
	useEffect(() => {
		let cancelled = false;
		setUrl(null);
		setError(null);

		if (!client || !roomId) return undefined;

		const prepare = async () => {
			try {
				const configuredBaseUrl = getElementCallBaseUrl();
				if (!configuredBaseUrl) {
					throw new Error(
						'REACT_APP_ELEMENT_CALL_BASE_URL is not set — cannot embed the call.'
					);
				}

				const elementCallUrl = new URL(
					'/room',
					new URL(configuredBaseUrl)
				);
				const userId = client.getUserId();
				const deviceId = client.getDeviceId();
				const baseUrl = client.getHomeserverUrl();
				if (!userId || !deviceId || !baseUrl) {
					throw new Error(
						'Matrix session incomplete — cannot embed the call.'
					);
				}

				if (client.getRoom(roomId)?.getMyMembership() !== 'join') {
					await client.joinRoom(roomId);
				}
				if (cancelled) return;

				const widgetId = await widgetIdForRoom(
					roomId,
					instanceNonceRef.current
				);
				if (cancelled) return;
				elementCallUrl.hash = `?${new URLSearchParams({
					widgetId,
					parentUrl: window.location.origin,
					roomId,
					userId,
					deviceId,
					baseUrl,
					confineToRoom: 'true',
					header: 'none',
					// The call UI is deliberately dark even though the app
					// around it is light; app-wide dark is a separate decision
					// (ACTIVE_SCHEMES). Pin it rather than inheriting Element
					// Call's own default, which an upstream merge could change
					// without anything here to point at.
					theme: 'dark',
					skipLobby: String(skipLobby),
					// Per-participant media E2EE is the ADR-018 default. Element
					// Call only encrypts LiveKit media when the host asks for it
					// (the host owns the Olm path that distributes media keys).
					// Kill-switch: releaseToggles.enableCallMediaE2EE === false.
					...(appConfig?.releaseToggles?.enableCallMediaE2EE === false
						? {}
						: { perParticipantE2EE: 'true' }),
					intent: 'start_call',
					callIntent: isVideo ? 'video' : 'audio'
				}).toString()}`;

				setUrl(elementCallUrl.toString());
			} catch (err) {
				if (!cancelled) setError(err as Error);
			}
		};

		void prepare();
		return () => {
			cancelled = true;
		};
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
			// Stopping the channel does not stop the call: the iframe document
			// keeps its camera and microphone tracks, so the capture indicator
			// stays lit after hanging up until the user reloads the page.
			// Navigating it away destroys that document and releases the
			// devices, whoever ended the call.
			//
			// Only when this iframe is really going away, though. React calls
			// the previous ref callback with null and the new one with the same
			// element whenever the callback's identity changes, so blanking
			// unconditionally would tear the media out of a live call.
			const previous = attachedIframeRef.current;
			if (previous && previous !== iframe) {
				releaseIframeDevices(previous);
			}
			attachedIframeRef.current = null;
			if (messageGuardRef.current) {
				window.removeEventListener(
					'message',
					messageGuardRef.current,
					true
				);
				messageGuardRef.current = null;
			}

			if (!iframe || !client || !roomId || !url) return;

			const userId = client.getUserId();
			if (!userId) return;

			const expectedOrigin = new URL(url).origin;
			if (
				new URL(iframe.src, window.location.href).origin !==
				expectedOrigin
			) {
				setError(
					new Error(
						'Element Call iframe origin does not match the configured widget origin.'
					)
				);
				return;
			}

			const widgetId = fragmentParams(url).get('widgetId');
			if (!widgetId) {
				setError(new Error('Element Call widget id is missing.'));
				return;
			}
			const iframeWindow = iframe.contentWindow;
			const guardWidgetChannel = (event: MessageEvent<unknown>) => {
				const message = event.data as { widgetId?: unknown } | null;
				if (!message || message.widgetId !== widgetId) return;
				if (
					event.origin !== expectedOrigin ||
					event.source !== iframeWindow
				) {
					event.stopImmediatePropagation();
				}
			};
			// matrix-widget-api 1.13's strictOriginCheck compares with the host
			// origin and therefore rejects a legitimate cross-origin widget. A
			// capture-phase guard gives this channel the correct two-part
			// boundary: configured origin plus the mounted iframe window.
			window.addEventListener('message', guardWidgetChannel, true);
			messageGuardRef.current = guardWidgetChannel;

			const driver = new OrisoWidgetDriver(client, roomId);
			const widget = new Widget({
				id: widgetId,
				creatorUserId: userId,
				type: MatrixWidgetType.Custom,
				url,
				waitForIframeLoad: false
			});

			driverRef.current = driver;
			attachedIframeRef.current = iframe;
			const api = new ClientWidgetApi(widget, iframe, driver);
			apiRef.current = api;
			api.setViewedRoomId(roomId);

			api.on('ready', () => {
				void api.updateTheme({ name: 'light' }).catch(() => {
					/* the widget may have closed during capability negotiation */
				});
			});

			const handleClose = (
				event: CustomEvent<IWidgetApiRequest>
			): void => {
				event.preventDefault();
				api.transport.reply(event.detail, {});
				onClose?.();
			};
			api.on('action:im.vector.hangup', handleClose);
			api.on('action:io.element.close', handleClose);

			api.on(
				'action:io.element.device_mute',
				(event: CustomEvent<IWidgetApiRequest>) => {
					event.preventDefault();
					api.transport.reply(event.detail, event.detail.data);
				}
			);
			api.on(
				'action:set_always_on_screen',
				(event: CustomEvent<IWidgetApiRequest>) => {
					event.preventDefault();
					const value = event.detail.data.value === true;
					onAlwaysOnScreenChange?.(value);
					api.transport.reply(event.detail, { success: true });
				}
			);
			const acknowledgeLifecycleAction = (
				event: CustomEvent<IWidgetApiRequest>
			): void => {
				event.preventDefault();
				api.transport.reply(event.detail, {});
			};
			for (const action of [
				'io.element.join',
				'io.element.tile_layout',
				'io.element.spotlight_layout'
			]) {
				api.on(`action:${action}`, acknowledgeLifecycleAction);
			}
		},
		[client, onAlwaysOnScreenChange, onClose, roomId, url]
	);

	const hangup = useCallback(async (): Promise<void> => {
		if (!apiRef.current) return;
		await apiRef.current.transport.send('im.vector.hangup', {});
	}, []);

	// Push room and to-device traffic into the widget. The widget API only
	// *answers* requests; anything the widget needs to observe has to be fed.
	useEffect(() => {
		if (!client || !roomId) return undefined;

		const pendingDecryptions = new Map<
			MatrixEvent,
			{
				listener: (event: MatrixEvent, error?: Error) => void;
				timeout: ReturnType<typeof setTimeout>;
			}
		>();
		const clearPendingDecryption = (event: MatrixEvent) => {
			const pending = pendingDecryptions.get(event);
			if (!pending) return;
			clearTimeout(pending.timeout);
			event.off('Event.decrypted' as any, pending.listener as any);
			pendingDecryptions.delete(event);
		};
		const feedAllowedRoomEvent = (event: MatrixEvent) => {
			if (event.getRoomId() !== roomId) return;
			if (!ALLOWED_ROOM_EVENT_TYPES.has(event.getType())) return;
			apiRef.current
				?.feedEvent(event.getEffectiveEvent() as never, roomId)
				.catch(() => {
					/* the widget may have gone away mid-call */
				});
		};
		const waitForSuccessfulDecryption = (event: MatrixEvent) => {
			if (pendingDecryptions.has(event)) return;

			const listener = (decryptedEvent: MatrixEvent, error?: Error) => {
				if (error || decryptedEvent.getType() === 'm.room.encrypted') {
					// Keep waiting: Megolm keys frequently arrive after the event,
					// and the SDK re-runs decryption when they do. Only report it,
					// so a call that stays silent is not silent in the log too.
					console.warn(
						'[call] call event still undecrypted, waiting for the key:',
						event.getId(),
						error?.message ?? 'no decryption error reported'
					);
					return;
				}
				clearPendingDecryption(event);
				feedAllowedRoomEvent(decryptedEvent);
			};
			const timeout = setTimeout(
				() => {
					// The widget never received this event. For
					// `io.element.call.encryption_keys` that means media stays
					// undecodable — the participant is connected but silent, with
					// nothing else in the UI to explain it (see ElementCall#35).
					console.error(
						'[call] dropping call event that never decrypted:',
						event.getId(),
						'in',
						event.getRoomId(),
						'— media keys carried by this event are lost'
					);
					clearPendingDecryption(event);
				},
				5 * 60 * 1000
			);
			pendingDecryptions.set(event, { listener, timeout });
			event.on('Event.decrypted' as any, listener as any);

			// Close the race where Rust Crypto finishes between the initial type
			// check and listener registration.
			if (event.getType() !== 'm.room.encrypted') listener(event);
		};
		const feedOrWaitForDecryption = (event: MatrixEvent) => {
			if (event.getRoomId() !== roomId) return;
			if (event.getType() === 'm.room.encrypted') {
				waitForSuccessfulDecryption(event);
				return;
			}
			feedAllowedRoomEvent(event);
		};

		const onTimeline = (
			event: MatrixEvent,
			_room: unknown,
			toStartOfTimeline: boolean | undefined
		) => {
			if (toStartOfTimeline) return; // backfill, not live
			feedOrWaitForDecryption(event);
		};

		const onLocalEchoUpdated = (event: MatrixEvent) => {
			feedOrWaitForDecryption(event);
		};

		const onStateEvent = (
			event: MatrixEvent,
			state: { roomId: string }
		) => {
			if (state.roomId !== roomId) return;
			if (!ALLOWED_RECEIVE_STATE_EVENT_TYPES.has(event.getType())) return;
			apiRef.current
				?.feedStateUpdate(event.getEffectiveEvent() as never)
				.catch(() => {
					/* see above */
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
		client.on(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
		client.on(RoomStateEvent.Events, onStateEvent);
		client.on(ClientEvent.ToDeviceEvent, onToDevice);

		return () => {
			client.off(RoomEvent.Timeline, onTimeline);
			client.off(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
			client.off(RoomStateEvent.Events, onStateEvent);
			client.off(ClientEvent.ToDeviceEvent, onToDevice);
			Array.from(pendingDecryptions.keys()).forEach(
				clearPendingDecryption
			);
		};
	}, [client, roomId]);

	useEffect(
		() => () => {
			apiRef.current?.stop();
			apiRef.current = null;
			releaseIframeDevices(attachedIframeRef.current);
			attachedIframeRef.current = null;
			if (messageGuardRef.current) {
				window.removeEventListener(
					'message',
					messageGuardRef.current,
					true
				);
				messageGuardRef.current = null;
			}
		},
		[]
	);

	return { url, attachIframe, hangup, error };
};
