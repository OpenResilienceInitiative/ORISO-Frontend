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
	'clientConsent',
	'threadRootId',
	'mentioned',
	'seriesId',
	'occurrenceIndex',
	'start',
	'callRoomId',
	'isVideo',
	'callId',
	'callType',
	'invitedAt',
	'startedAt',
	'endedAt',
	'durationSeconds',
	'actorUserId',
	'participants',
	'participantCount',
	'eventAt',
	'inferredFromMembership',
	'forcedScopeKey',
	// #924: added on the frontend first. The backend starts emitting it with
	// ORISO-UserService#961; until then the key is simply absent, which the
	// preview hydration treats as "nothing to correlate".
	'matrixEventId'
] as const;

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
	params.callId = asNullableString(source.callId);
	if (typeof source.isVideo === 'boolean' || source.isVideo === null) {
		params.isVideo = source.isVideo as boolean | null;
	}
	if (
		source.callType === 'audio' ||
		source.callType === 'video' ||
		source.callType === null
	) {
		params.callType = source.callType as 'audio' | 'video' | null;
	}
	params.invitedAt = asNullableString(source.invitedAt);
	params.startedAt = asNullableString(source.startedAt);
	params.endedAt = asNullableString(source.endedAt);
	params.actorUserId = asNullableString(source.actorUserId);
	params.eventAt = asNullableString(source.eventAt);
	if (
		typeof source.inferredFromMembership === 'boolean' ||
		source.inferredFromMembership === null
	) {
		params.inferredFromMembership = source.inferredFromMembership as
			| boolean
			| null;
	}
	if (
		typeof source.durationSeconds === 'number' &&
		Number.isFinite(source.durationSeconds)
	) {
		params.durationSeconds = source.durationSeconds;
	}
	if (
		typeof source.participantCount === 'number' &&
		Number.isFinite(source.participantCount)
	) {
		params.participantCount = source.participantCount;
	}
	if (Array.isArray(source.participants)) {
		params.participants = source.participants.filter(
			(participant): participant is string =>
				typeof participant === 'string' && participant.length > 0
		);
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
	return params;
};

/**
 * String/number values from parsed params, for i18n interpolation. i18next
 * escapes interpolated values by default, and params never carry message
 * content (ADR-AT-01).
 */
export const toInterpolationValues = (
	params: EventActionParams | undefined
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
	return values;
};

export const resolveNotificationActionPath = (
	item: NotificationActionInput,
	sessionsBasePath: string,
	// #846: request-origin events resolve against the enquiry list — without
	// this, requestTarget fell through to null and the consumer navigated to
	// the bare sessions root.
	requestsBasePath?: string | null
): string | null => {
	const target = resolveNotificationActionTarget(
		item,
		sessionsBasePath,
		requestsBasePath
	);

	return target.kind === 'conversation' ||
		target.kind === 'groupChatJoin' ||
		target.kind === 'request' ||
		target.kind === 'draft'
		? target.path
		: null;
};

export const resolveNotificationActionTarget = (
	item: NotificationActionInput,
	sessionsBasePath: string,
	requestsBasePath?: string | null
) =>
	getEventDescriptor(item.eventType).resolveActionTarget({
		...(item.params || {}),
		actionPath: item.actionPath,
		sourceSessionId: item.sourceSessionId ?? item.params?.sourceSessionId,
		sessionsBasePath,
		requestsBasePath
	});
