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
	}
	if (isIdentifier(source.seriesId)) {
		params.seriesId = source.seriesId;
	}
	params.roomRef = asNullableString(source.roomRef);
	params.forcedScopeKey = asNullableString(source.forcedScopeKey);
	params.threadRootId = asNullableString(source.threadRootId);
	params.callRoomId = asNullableString(source.callRoomId);
	if (typeof source.isVideo === 'boolean' || source.isVideo === null) {
		params.isVideo = source.isVideo as boolean | null;
	}
	return params;
};

export const resolveNotificationActionPath = (
	item: NotificationActionInput,
	sessionsBasePath: string
): string | null => {
	const target = getEventDescriptor(item.eventType).resolveActionTarget({
		...(item.params || {}),
		actionPath: item.actionPath,
		sourceSessionId: item.sourceSessionId,
		sessionsBasePath
	});

	return target.kind === 'conversation' ||
		target.kind === 'groupChatJoin' ||
		target.kind === 'request' ||
		target.kind === 'draft'
		? target.path
		: null;
};
