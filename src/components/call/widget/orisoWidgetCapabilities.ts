/**
 * Exact first-party contract shared with ORISO-ElementCall.
 *
 * The iframe acts as the logged-in Matrix user, so this list intentionally
 * excludes room administration, general chat events and legacy 1:1 signalling.
 */
export const ALLOWED_ROOM_EVENT_TYPES: ReadonlySet<string> = new Set([
	'io.element.call.encryption_keys',
	'org.matrix.msc4075.rtc.notification',
	'm.reaction',
	'io.element.call.reaction'
]);

export const ALLOWED_SEND_STATE_EVENT_TYPES: ReadonlySet<string> = new Set([
	'org.matrix.msc3401.call.member'
]);

// create/name/member are read-only boot metadata for createRoomWidgetClient.
// OrisoWidgetDriver still confines every state read to its single call room.
export const ALLOWED_RECEIVE_STATE_EVENT_TYPES: ReadonlySet<string> = new Set([
	...ALLOWED_SEND_STATE_EVENT_TYPES,
	'm.room.create',
	'm.room.name',
	'm.room.member',
	'm.room.encryption'
]);

export const ALLOWED_TO_DEVICE_EVENT_TYPES: ReadonlySet<string> = new Set([
	'io.element.call.encryption_keys'
]);

const ALLOWED_PLAIN_CAPABILITIES: ReadonlySet<string> = new Set([
	'org.matrix.msc4157.send.delayed_event',
	'org.matrix.msc4157.update_delayed_event'
]);

const ROOM_EVENT_PREFIXES = [
	'org.matrix.msc2762.send.event:',
	'org.matrix.msc2762.receive.event:'
];
const ROOM_TIMELINE_PREFIX = 'org.matrix.msc2762.timeline:';
const SEND_STATE_EVENT_PREFIX = 'org.matrix.msc2762.send.state_event:';
const RECEIVE_STATE_EVENT_PREFIX = 'org.matrix.msc2762.receive.state_event:';
const TO_DEVICE_PREFIXES = [
	'org.matrix.msc3819.send.to_device:',
	'org.matrix.msc3819.receive.to_device:'
];

/**
 * A state-event capability may be scoped to a state key with `#`, e.g.
 * `...send.state_event:m.call.member#@a:hs_DEVICE_m.call`. Strip it — we
 * validate the event type, the widget API enforces the state key itself.
 */
const eventTypeFromCapability = (
	capability: string,
	prefix: string
): string => {
	const rest = capability.slice(prefix.length);
	const hashIndex = rest.indexOf('#');
	return hashIndex === -1 ? rest : rest.slice(0, hashIndex);
};

const stateKeyFromCapability = (
	capability: string,
	prefix: string
): string | null => {
	const rest = capability.slice(prefix.length);
	const hashIndex = rest.indexOf('#');
	return hashIndex === -1 ? null : rest.slice(hashIndex + 1);
};

const matchPrefix = (
	capability: string,
	prefixes: ReadonlyArray<string>
): string | null =>
	prefixes.find((prefix) => capability.startsWith(prefix)) ?? null;

/**
 * True when the capability is one we are willing to grant an embedded call
 * widget. Anything unknown is denied — silently ignoring an unexpected request
 * is safer than granting it, and Element Call degrades visibly rather than
 * doing something unauthorised.
 */
export const isAllowedWidgetCapability = (
	capability: string,
	userId: string,
	deviceId: string,
	roomId: string
): boolean => {
	if (ALLOWED_PLAIN_CAPABILITIES.has(capability)) return true;
	if (capability.startsWith(ROOM_TIMELINE_PREFIX)) {
		return capability === `${ROOM_TIMELINE_PREFIX}${roomId}`;
	}

	const roomPrefix = matchPrefix(capability, ROOM_EVENT_PREFIXES);
	if (roomPrefix) {
		return ALLOWED_ROOM_EVENT_TYPES.has(
			eventTypeFromCapability(capability, roomPrefix)
		);
	}

	// Send and receive are checked against different sets: the widget may read
	// room metadata but must not write it.
	if (capability.startsWith(SEND_STATE_EVENT_PREFIX)) {
		const eventType = eventTypeFromCapability(
			capability,
			SEND_STATE_EVENT_PREFIX
		);
		const stateKey = stateKeyFromCapability(
			capability,
			SEND_STATE_EVENT_PREFIX
		);
		return (
			ALLOWED_SEND_STATE_EVENT_TYPES.has(eventType) &&
			stateKey !== null &&
			new Set([
				userId,
				`_${userId}_${deviceId}_m.call`,
				`${userId}_${deviceId}_m.call`
			]).has(stateKey)
		);
	}
	if (capability.startsWith(RECEIVE_STATE_EVENT_PREFIX)) {
		return ALLOWED_RECEIVE_STATE_EVENT_TYPES.has(
			eventTypeFromCapability(capability, RECEIVE_STATE_EVENT_PREFIX)
		);
	}

	const toDevicePrefix = matchPrefix(capability, TO_DEVICE_PREFIXES);
	if (toDevicePrefix) {
		return ALLOWED_TO_DEVICE_EVENT_TYPES.has(
			eventTypeFromCapability(capability, toDevicePrefix)
		);
	}

	return false;
};
