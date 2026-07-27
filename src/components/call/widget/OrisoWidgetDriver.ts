/**
 * Host-side widget driver for the embedded Element Call.
 *
 * Why this exists
 * ---------------
 * Element Call used to be embedded as a plain iframe in *SPA mode*: we handed
 * it our `accessToken`, `userId` and — critically — our `deviceId` through the
 * URL, and it built its own Matrix client from them. Two consequences:
 *
 *  1. Element Call ran a second Matrix client on *our* device. Its
 *     `initRustCrypto()` could not work, because the host owns that device's
 *     crypto state. A crypto-less client in an encrypted room cannot do
 *     per-participant media encryption at all, which is why media E2EE was
 *     forced off.
 *  2. A bearer token in a URL query string leaks into history, referrers and
 *     any logging in between.
 *
 * In widget (matryoshka) mode Element Call has no Matrix client of its own. It
 * asks *us* to send and read events over `postMessage`, and we answer using the
 * host client — the one that already has crypto set up (see ADR-004). That
 * makes encrypted to-device messaging work, which is the channel the media keys
 * travel on, so `E2eeType.PER_PARTICIPANT` becomes possible.
 *
 * Scope
 * -----
 * This is deliberately a *purpose-built* driver, not a general one like Element
 * Web's. It serves exactly the capabilities Element Call asks for and denies
 * everything else — see `orisoWidgetCapabilities.ts`.
 */

import {
	Capability,
	type IOpenIDCredentials,
	type IOpenIDUpdate,
	IRoomEvent,
	ISendDelayedEventDetails,
	ISendEventDetails,
	ITurnServer,
	OpenIDRequestState,
	SimpleObservable,
	UpdateDelayedEventAction,
	WidgetDriver
} from 'matrix-widget-api';
import { EventTimeline, MatrixClient, MatrixEvent } from 'matrix-js-sdk';

import {
	ALLOWED_RECEIVE_STATE_EVENT_TYPES,
	ALLOWED_ROOM_EVENT_TYPES,
	ALLOWED_SEND_STATE_EVENT_TYPES,
	ALLOWED_TO_DEVICE_EVENT_TYPES,
	isAllowedWidgetCapability
} from './orisoWidgetCapabilities';

/**
 * To-device events that carry per-participant media keys. These may only ever
 * be sent through Olm, never through the plaintext queue.
 */
/** Matrix events carry more than the widget spec's shape; narrow it here. */
const toWidgetEvent = (event: MatrixEvent): IRoomEvent =>
	event.getEffectiveEvent() as unknown as IRoomEvent;

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0;

const isValidOpenIDToken = (token: unknown): token is IOpenIDCredentials => {
	if (!token || typeof token !== 'object') return false;

	const { access_token, token_type, matrix_server_name, expires_in } =
		token as Record<string, unknown>;

	return (
		isNonEmptyString(access_token) &&
		isNonEmptyString(token_type) &&
		isNonEmptyString(matrix_server_name) &&
		typeof expires_in === 'number' &&
		Number.isFinite(expires_in) &&
		expires_in > 0
	);
};

export class OrisoWidgetDriver extends WidgetDriver {
	public constructor(
		private readonly client: MatrixClient,
		/**
		 * The call room. The driver is bound to a single room on purpose: a call
		 * widget has no business reading any other conversation, so every request
		 * that names a different room is refused rather than proxied.
		 */
		private readonly roomId: string
	) {
		super();
	}

	private assertRoom(roomId?: string | null): string {
		if (roomId && roomId !== this.roomId) {
			throw new Error(
				`Call widget requested room ${roomId} but is confined to ${this.roomId}`
			);
		}
		return this.roomId;
	}

	public async validateCapabilities(
		requested: Set<Capability>
	): Promise<Set<Capability>> {
		const granted = new Set<Capability>();
		const userId = this.client.getUserId();
		const deviceId = this.client.getDeviceId();
		if (!userId || !deviceId) return granted;
		requested.forEach((capability) => {
			if (isAllowedWidgetCapability(capability, userId, deviceId)) {
				granted.add(capability);
			} else {
				// eslint-disable-next-line no-console
				console.warn('[call] denied widget capability:', capability);
			}
		});
		return granted;
	}

	public askOpenID(observer: SimpleObservable<IOpenIDUpdate>): void {
		try {
			void this.client.getOpenIdToken().then(
				(token) =>
					observer.update(
						isValidOpenIDToken(token)
							? {
									state: OpenIDRequestState.Allowed,
									token
								}
							: { state: OpenIDRequestState.Blocked }
					),
				() => observer.update({ state: OpenIDRequestState.Blocked })
			);
		} catch {
			observer.update({ state: OpenIDRequestState.Blocked });
		}
	}

	public async sendEvent(
		eventType: string,
		content: unknown,
		stateKey: string | null = null,
		roomId: string | null = null
	): Promise<ISendEventDetails> {
		const targetRoom = this.assertRoom(roomId);
		const allowedTypes =
			stateKey === null
				? ALLOWED_ROOM_EVENT_TYPES
				: ALLOWED_SEND_STATE_EVENT_TYPES;
		if (!allowedTypes.has(eventType)) {
			throw new Error(`Call widget may not send ${eventType}`);
		}
		if (stateKey !== null) {
			const userId = this.client.getUserId();
			const deviceId = this.client.getDeviceId();
			const allowedStateKeys = new Set([
				userId,
				`_${userId}_${deviceId}_m.call`,
				`${userId}_${deviceId}_m.call`
			]);
			if (!userId || !deviceId || !allowedStateKeys.has(stateKey)) {
				throw new Error(
					'Call widget may only update its own MatrixRTC membership'
				);
			}
		}

		const response =
			stateKey === null
				? await this.client.sendEvent(
						targetRoom,
						eventType as any,
						content as any
					)
				: await this.client.sendStateEvent(
						targetRoom,
						eventType as any,
						content as any,
						stateKey
					);

		return { roomId: targetRoom, eventId: response.event_id };
	}

	/**
	 * Delayed events implement call-membership expiry: a client schedules its own
	 * "I have left" state event up front, so a participant that crashes or loses
	 * the network still disappears from the call instead of lingering forever.
	 */
	public async sendDelayedEvent(
		delay: number | null,
		parentDelayId: string | null,
		eventType: string,
		content: unknown,
		stateKey: string | null = null,
		roomId: string | null = null
	): Promise<ISendDelayedEventDetails> {
		const targetRoom = this.assertRoom(roomId);
		const allowedTypes =
			stateKey === null
				? ALLOWED_ROOM_EVENT_TYPES
				: ALLOWED_SEND_STATE_EVENT_TYPES;
		if (!allowedTypes.has(eventType)) {
			throw new Error(`Call widget may not delay ${eventType}`);
		}
		if (stateKey !== null) {
			const userId = this.client.getUserId();
			const deviceId = this.client.getDeviceId();
			const allowedStateKeys = new Set([
				userId,
				`_${userId}_${deviceId}_m.call`,
				`${userId}_${deviceId}_m.call`
			]);
			if (!userId || !deviceId || !allowedStateKeys.has(stateKey)) {
				throw new Error(
					'Call widget may only delay its own MatrixRTC membership'
				);
			}
		}
		const delayOpts =
			delay !== null
				? { delay }
				: { parent_delay_id: parentDelayId as string };

		const response =
			stateKey === null
				? await this.client._unstable_sendDelayedEvent(
						targetRoom,
						delayOpts as any,
						null,
						eventType as any,
						content as any
					)
				: await this.client._unstable_sendDelayedStateEvent(
						targetRoom,
						delayOpts as any,
						eventType as any,
						content as any,
						stateKey
					);

		return { roomId: targetRoom, delayId: response.delay_id };
	}

	public async updateDelayedEvent(
		delayId: string,
		action: UpdateDelayedEventAction
	): Promise<void> {
		await this.client._unstable_updateDelayedEvent(delayId, action);
	}

	/**
	 * The media-key channel. `encrypted` is honoured rather than ignored: when
	 * Element Call asks for an encrypted send we route through Olm, which is the
	 * whole point of running in widget mode. A crypto-less client would have to
	 * downgrade this to plaintext.
	 */
	public async sendToDevice(
		eventType: string,
		encrypted: boolean,
		contentMap: { [userId: string]: { [deviceId: string]: object } }
	): Promise<void> {
		if (!ALLOWED_TO_DEVICE_EVENT_TYPES.has(eventType)) {
			throw new Error(`Call widget may not send ${eventType} to devices`);
		}
		if (!encrypted) {
			throw new Error(
				`Refusing to send ${eventType} unencrypted: call keys must never ` +
					'travel in plaintext.'
			);
		}

		const crypto = this.client.getCrypto();
		if (!crypto) {
			throw new Error(
				'Refusing to send call keys: host client has no crypto. ' +
					'Encrypted calls require an initialised crypto stack (ADR-004).'
			);
		}

		// `encryptAndSendToDevice` takes one payload for a set of devices, so
		// group the map by payload identity rather than sending per device.
		const byPayload = new Map<
			string,
			{ devices: { userId: string; deviceId: string }[]; payload: object }
		>();
		Object.entries(contentMap).forEach(([userId, byDevice]) => {
			Object.entries(byDevice).forEach(([deviceId, payload]) => {
				const key = JSON.stringify(payload);
				const existing = byPayload.get(key);
				if (existing) {
					existing.devices.push({ userId, deviceId });
				} else {
					byPayload.set(key, {
						devices: [{ userId, deviceId }],
						payload
					});
				}
			});
		});

		await Promise.all(
			Array.from(byPayload.values()).map(({ devices, payload }) =>
				this.client.encryptAndSendToDevice(
					eventType,
					devices,
					payload as any
				)
			)
		);
	}

	public async readRoomEvents(
		eventType: string,
		msgtype: string | undefined,
		limit: number,
		roomIds: string[] | null = null,
		since?: string
	): Promise<IRoomEvent[]> {
		const targetRoom = this.assertRoom(roomIds?.[0] ?? null);
		if (!ALLOWED_ROOM_EVENT_TYPES.has(eventType)) return [];
		return this.readRoomTimeline(
			targetRoom,
			eventType,
			msgtype,
			undefined,
			limit,
			since
		);
	}

	public async readRoomTimeline(
		roomId: string,
		eventType: string,
		msgtype: string | undefined,
		stateKey: string | undefined,
		limit: number,
		since: string | undefined
	): Promise<IRoomEvent[]> {
		const targetRoom = this.assertRoom(roomId);
		if (!ALLOWED_ROOM_EVENT_TYPES.has(eventType)) return [];
		const room = this.client.getRoom(targetRoom);
		if (!room) return [];

		const events = room
			.getLiveTimeline()
			.getEvents()
			.filter((event) => {
				if (event.getType() !== eventType) return false;
				if (msgtype && event.getContent().msgtype !== msgtype)
					return false;
				if (stateKey !== undefined && event.getStateKey() !== stateKey)
					return false;
				return true;
			});

		// `since` is an event id: everything strictly after it, newest last.
		const sinceIndex = since
			? events.findIndex((event) => event.getId() === since)
			: -1;
		const window =
			sinceIndex === -1 ? events : events.slice(sinceIndex + 1);

		// A limit of 0 means "no limit" per the widget spec.
		const limited = limit > 0 ? window.slice(-limit) : window;
		return limited.map(toWidgetEvent);
	}

	public async readStateEvents(
		eventType: string,
		stateKey: string | undefined,
		limit: number,
		roomIds: string[] | null = null
	): Promise<IRoomEvent[]> {
		this.assertRoom(roomIds?.[0] ?? null);
		if (!ALLOWED_RECEIVE_STATE_EVENT_TYPES.has(eventType)) return [];
		return this.readRoomState(this.roomId, eventType, stateKey).then(
			(events) => (limit > 0 ? events.slice(0, limit) : events)
		);
	}

	public async readRoomState(
		roomId: string,
		eventType: string,
		stateKey: string | undefined
	): Promise<IRoomEvent[]> {
		const targetRoom = this.assertRoom(roomId);
		if (!ALLOWED_RECEIVE_STATE_EVENT_TYPES.has(eventType)) return [];
		const room = this.client.getRoom(targetRoom);
		if (!room) return [];

		const currentState = room
			.getLiveTimeline()
			.getState(EventTimeline.FORWARDS);
		if (!currentState) return [];

		const events =
			stateKey === undefined
				? currentState.getStateEvents(eventType)
				: [currentState.getStateEvents(eventType, stateKey)].filter(
						(event): event is MatrixEvent => Boolean(event)
					);

		return (Array.isArray(events) ? events : []).map(toWidgetEvent);
	}

	/**
	 * TURN credentials come from the LiveKit SFU in our deployment, not from the
	 * homeserver, so there is nothing to hand over. Returning without yielding
	 * leaves the widget on its configured ICE servers.
	 */
	public async *getTurnServers(): AsyncGenerator<ITurnServer> {
		// eslint-disable-next-line no-empty-function
	}
}
