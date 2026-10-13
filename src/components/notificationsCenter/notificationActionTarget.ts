import { getEventDescriptor } from './eventDescriptors';
import { EventActionParams } from './eventDescriptors/types';

type Identifier = string | number | null;

interface NotificationActionInput {
	eventType?: string | null;
	actionPath?: string | null;
	sourceSessionId?: Identifier;
	params?: EventActionParams;
}

const isIdentifier = (value: unknown): value is Identifier =>
	value === null || typeof value === 'string' || typeof value === 'number';

const asNullableString = (value: unknown): string | null | undefined =>
	value === null || typeof value === 'string'
		? (value as string | null)
		: undefined;

/**
 * The shared params contract (#846). Every key the backend emits is listed
 * here, and ORISO-UserService pins the same set in
 * EventNotificationServiceTest.allEmittedParamKeysStayInsideTheSharedFrontendContract —
 * a key missing on either side is a contract break, not a silent drop.
 */
export const EVENT_PARAM_KEYS = [
	'sessionId',
	'sourceSessionId',
	'roomRef',
	'roomId',
	'agencyId',
	'topicId',
	'consultingTypeId',
	'senderName',
	'senderDisplayName',
	'contentClass',
	'recipientRole',
	'conversationType',
	'clientConsent',
	'threadRootId',
	'mentioned',
	'seriesId',
	'occurrenceIndex',
	'start',
	'callRoomId',
	'isVideo',
	'forcedScopeKey',
	// #924: added on the frontend first. The backend starts emitting it with
	// ORISO-UserService#961; until then the key is simply absent, which the
	// preview hydration treats as "nothing to correlate".
	'matrixEventId',
	// #876: planned maintenance notice (ORISO-UserService#1343).
	'campaignKey',
	'maintenanceDate',
	'maintenanceStart',
	'maintenanceEnd',
	'statusUrl'
] as const;

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const matching = (value: unknown, pattern: RegExp): string | undefined =>
	typeof value === 'string' && pattern.test(value) ? value : undefined;

// Date.UTC would silently shift 2026-02-31 to 3 March; reject it instead.
const calendarDay = (value: unknown): string | undefined => {
	const iso = matching(value, ISO_DATE);
	if (!iso) return undefined;
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
		? iso
		: undefined;
};

// The link is rendered as an anchor, so only absolute web URLs pass.
const webUrl = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:'
			? url.href
			: undefined;
	} catch {
		return undefined;
	}
};

/** Parse only the known, non-content fields accepted by action-target resolvers. */
export const parseEventActionParams = (raw: unknown): EventActionParams => {
	let value: unknown = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			return {};
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	const source = value as Record<string, unknown>;
	const params: EventActionParams = {};
	if (isIdentifier(source.sourceSessionId)) {
		params.sourceSessionId = source.sourceSessionId;
	} else if (isIdentifier(source.sessionId)) {
		// #846: the backend emits `sessionId`; accept it as the session ref.
		params.sourceSessionId = source.sessionId;
	}
	if (isIdentifier(source.seriesId)) {
		params.seriesId = source.seriesId;
	}
	params.roomRef =
		asNullableString(source.roomRef) ??
		// #846: team-discussion events carry the room as `roomId`.
		asNullableString(source.roomId);
	// #924: the opaque Matrix event id, so a card can be correlated with the
	// exact message it came from. An identifier, not content (ADR-AT-01).
	params.matrixEventId = asNullableString(source.matrixEventId);
	params.forcedScopeKey = asNullableString(source.forcedScopeKey);
	params.threadRootId = asNullableString(source.threadRootId);
	params.callRoomId = asNullableString(source.callRoomId);
	if (typeof source.isVideo === 'boolean' || source.isVideo === null) {
		params.isVideo = source.isVideo as boolean | null;
	}
	if (typeof source.mentioned === 'boolean') {
		params.mentioned = source.mentioned;
	}
	// #846: display metadata (never message content, ADR-AT-01) — feeds the
	// i18n interpolation ({{senderDisplayName}}) and future list rendering.
	params.senderName = asNullableString(source.senderName);
	params.senderDisplayName = asNullableString(source.senderDisplayName);
	params.contentClass = asNullableString(source.contentClass);
	params.recipientRole = asNullableString(source.recipientRole);
	params.conversationType = asNullableString(source.conversationType);
	const clientConsent = asNullableString(source.clientConsent);
	if (
		clientConsent === 'OPT_IN' ||
		clientConsent === 'OPT_OUT' ||
		clientConsent === 'NONE'
	) {
		params.clientConsent = clientConsent;
	}
	if (isIdentifier(source.agencyId)) {
		params.agencyId = source.agencyId;
	}
	if (isIdentifier(source.topicId)) {
		params.topicId = source.topicId;
	}
	if (isIdentifier(source.consultingTypeId)) {
		params.consultingTypeId = source.consultingTypeId;
	}
	if (isIdentifier(source.occurrenceIndex)) {
		params.occurrenceIndex = source.occurrenceIndex;
	}
	params.start = asNullableString(source.start);
	const campaignKey = asNullableString(source.campaignKey);
	if (campaignKey) params.campaignKey = campaignKey;
	const maintenanceDate = calendarDay(source.maintenanceDate);
	if (maintenanceDate) params.maintenanceDate = maintenanceDate;
	const maintenanceStart = matching(source.maintenanceStart, CLOCK_TIME);
	if (maintenanceStart) params.maintenanceStart = maintenanceStart;
	const maintenanceEnd = matching(source.maintenanceEnd, CLOCK_TIME);
	if (maintenanceEnd) params.maintenanceEnd = maintenanceEnd;
	const statusUrl = webUrl(source.statusUrl);
	if (statusUrl) params.statusUrl = statusUrl;
	return params;
};

// `de@informal` is an i18next code, not a BCP 47 tag; Intl would throw on it.
const intlLocale = (language: string | undefined): string =>
	(language || 'de').split('@')[0] || 'de';

/** A calendar day as the reader writes it ("15. Oktober 2026"). */
const formatMaintenanceDate = (iso: string, language?: string): string => {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, 12));
	const options: Intl.DateTimeFormatOptions = {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	};
	try {
		return date.toLocaleDateString(intlLocale(language), options);
	} catch {
		return date.toLocaleDateString('de', options);
	}
};

/**
 * String/number values from parsed params, for i18n interpolation. i18next
 * escapes interpolated values by default, and params never carry message
 * content (ADR-AT-01).
 */
export const toInterpolationValues = (
	params: EventActionParams | undefined,
	language?: string
): Record<string, string | number> => {
	const values: Record<string, string | number> = {};
	Object.entries(params || {}).forEach(([key, value]) => {
		if (typeof value === 'string' || typeof value === 'number') {
			values[key] = value;
		}
	});
	// The team-discussion template renders {{senderDisplayName}} — fall back
	// to the plain sender label, and always define the key so a missing
	// value renders empty instead of a raw "{{senderDisplayName}}".
	if (!values.senderDisplayName) {
		values.senderDisplayName = values.senderName ?? '';
	}
	// #876: the day is localised here; the times are already the operator's
	// wall clock. Missing values render empty, never as a raw placeholder.
	values.maintenanceDate = params?.maintenanceDate
		? formatMaintenanceDate(params.maintenanceDate, language)
		: '';
	values.maintenanceStart ??= '';
	values.maintenanceEnd ??= '';
	return values;
};

/**
 * Whether an item's action is the public status page, and its validated URL
 * (null when the item has none, so the consumer offers no action at all).
 */
export const resolveStatusPageAction = (
	item: NotificationActionInput | null | undefined
): { linksToStatusPage: boolean; url: string | null } => {
	const target = getEventDescriptor(item?.eventType).resolveActionTarget({
		...(item?.params || {})
	});
	return target.kind === 'statusPage'
		? { linksToStatusPage: true, url: webUrl(target.url) ?? null }
		: { linksToStatusPage: false, url: null };
};

/** The status page a planned maintenance notice links to, or null. */
export const resolveNotificationStatusPageUrl = (
	item: NotificationActionInput
): string | null => resolveStatusPageAction(item).url;

export const resolveNotificationActionPath = (
	item: NotificationActionInput,
	sessionsBasePath: string,
	// #846: request-origin events resolve against the enquiry list — without
	// this, requestTarget fell through to null and the consumer navigated to
	// the bare sessions root.
	requestsBasePath?: string | null
): string | null => {
	const target = getEventDescriptor(item.eventType).resolveActionTarget({
		...(item.params || {}),
		actionPath: item.actionPath,
		sourceSessionId: item.sourceSessionId ?? item.params?.sourceSessionId,
		sessionsBasePath,
		requestsBasePath
	});

	return target.kind === 'conversation' ||
		target.kind === 'groupChatJoin' ||
		target.kind === 'request' ||
		target.kind === 'draft'
		? target.path
		: null;
};
