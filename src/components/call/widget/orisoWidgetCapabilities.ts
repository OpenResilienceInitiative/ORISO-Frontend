/**
 * Allow-list for the Element Call widget.
 *
 * The widget runs in an iframe we serve ourselves, but it is still a separate
 * origin driving our Matrix client. Anything it is allowed to do, it can do
 * *as the logged-in user* — so we approve capabilities by explicit event type
 * instead of rubber-stamping whatever the widget asks for. A widget that could
 * request `m.room.message` send rights could post into a counselling session
 * under the user's name.
 *
 * The list mirrors exactly what Element Call requests in its own
 * `createRoomWidgetClient` call (`ORISO-ElementCall/src/widget.ts`). Keep the
 * two in sync: an event type missing here surfaces as the widget silently
 * failing to join a call, not as a loud error.
 */

/** Room events Element Call sends and/or receives in the call room. */
export const ALLOWED_ROOM_EVENT_TYPES: ReadonlySet<string> = new Set([
	'org.matrix.rageshake_request',
	'io.element.call.encryption_keys',
	'm.call.encryption_keys',
	'org.matrix.msc3401.call.encryption_keys',
	'm.reaction',
	'm.room.redaction',
	'io.element.call.reaction',
	'org.matrix.msc4075.call.notify',
	'm.call.notify',
	'org.matrix.msc4075.rtc.notification',
	'm.rtc.notification',
	'org.matrix.msc4310.rtc.decline',
	'm.rtc.decline'
]);

/** State events Element Call reads and/or writes (call membership + room meta). */
export const ALLOWED_STATE_EVENT_TYPES: ReadonlySet<string> = new Set([
	'org.matrix.msc3401.call.member',
	'm.call.member',
	'm.room.create',
	'm.room.name',
	'm.room.member',
	'm.room.encryption'
]);

/**
 * To-device events. This is the channel that carries the per-participant media
 * keys, so it is the one that must never be dropped — see ADR-004.
 */
export const ALLOWED_TO_DEVICE_EVENT_TYPES: ReadonlySet<string> = new Set([
	'm.call.invite',
	'm.call.candidates',
	'm.call.answer',
	'm.call.hangup',
	'm.call.reject',
	'm.call.select_answer',
	'm.call.negotiate',
	'm.call.sdp_stream_metadata_changed',
	'org.matrix.call.sdp_stream_metadata_changed',
	'm.call.replaces',
	'io.element.call.encryption_keys',
	'm.call.encryption_keys',
	'org.matrix.msc3401.call.encryption_keys'
]);

/** Capabilities that carry no event type and are safe for a call widget. */
const ALLOWED_PLAIN_CAPABILITIES: ReadonlySet<string> = new Set([
	'm.always_on_screen',
	'org.matrix.msc2931.navigate',
	'org.matrix.msc4157.send.delayed_event',
	'org.matrix.msc4157.update_delayed_event'
]);

const ROOM_EVENT_PREFIXES = [
	'org.matrix.msc2762.send.event:',
	'org.matrix.msc2762.receive.event:',
	'org.matrix.msc2762.timeline:'
];
const STATE_EVENT_PREFIXES = [
	'org.matrix.msc2762.send.state_event:',
	'org.matrix.msc2762.receive.state_event:'
];
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
export const isAllowedWidgetCapability = (capability: string): boolean => {
	if (ALLOWED_PLAIN_CAPABILITIES.has(capability)) return true;

	const roomPrefix = matchPrefix(capability, ROOM_EVENT_PREFIXES);
	if (roomPrefix) {
		return ALLOWED_ROOM_EVENT_TYPES.has(
			eventTypeFromCapability(capability, roomPrefix)
		);
	}

	const statePrefix = matchPrefix(capability, STATE_EVENT_PREFIXES);
	if (statePrefix) {
		return ALLOWED_STATE_EVENT_TYPES.has(
			eventTypeFromCapability(capability, statePrefix)
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
