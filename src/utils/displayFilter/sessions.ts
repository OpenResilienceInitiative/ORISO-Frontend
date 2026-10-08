/**
 * Display filter — Gespräche and Anfragen helpers (#1377 slices 4–5, spec
 * §5.2/§5.3). One classification per row so the toolbar chips and the
 * display filter can never disagree on what a row is.
 */

import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import {
	isAnonymousAskerSession,
	isConversationCircleSession,
	isInternalGroupChatSession,
	SessionToolbarChipFilter
} from '../../components/sessionsList/sessionToolbarFilters';
import {
	getSupervisionListState,
	hasSupervisionMarker
} from '../../components/sessionsListItem/supervisionListState';
import {
	OTHER_KIND_ID,
	resolveKindSetting
} from '../../components/displayFilter/displayFilterTypes';
import { DisplayFilter } from './model';

/** Gespräche kinds (§5.2). `futureTimeline` gates the panel, not rows. */
export type SessionKindId =
	| 'create'
	| 'unread'
	| 'drafts'
	| 'oneToOne'
	| 'liveChat'
	| 'internalGroup'
	| 'circle'
	| 'supervision'
	| 'archive'
	| 'appointments'
	| 'futureTimeline'
	| typeof OTHER_KIND_ID;

/** Anfragen kinds (§5.3). */
export type RequestKindId = 'nearby' | 'liveChat' | typeof OTHER_KIND_ID;

/** Dialog order for Gespräche. */
export const SESSION_KIND_ORDER: ReadonlyArray<SessionKindId> = [
	// Frank 2026-09-16: every toolbar chip is a dialog row, in toolbar
	// order. Erstellen/Ungelesen/Entwürfe are pill-only (no rows of their own).
	'create',
	'unread',
	'drafts',
	'oneToOne',
	'liveChat',
	'internalGroup',
	'circle',
	'supervision',
	// Frank 2026-09-16: the Archiv chip is configurable (pill only, no rows
	// of its own); Termine is announced but not wired yet (placeholder).
	'archive',
	'appointments',
	'futureTimeline',
	OTHER_KIND_ID
];

/** Dialog order for Anfragen. */
export const REQUEST_KIND_ORDER: ReadonlyArray<RequestKindId> = [
	'nearby',
	'liveChat',
	OTHER_KIND_ID
];

/** Kinds that only own a chip, never a row (Frank 2026-09-16). */
export const PILL_ONLY_SESSION_KINDS: ReadonlyArray<SessionKindId> = [
	'create',
	'unread',
	'drafts',
	'archive'
];

/**
 * The toolbar chip that stands for a kind (the chip filter and the display
 * filter share the classification below). `unread`/`drafts` are refinement
 * chips, not row kinds — they map so their pill can be switched like the rest.
 */
export const SESSION_KIND_CHIP: Partial<
	Record<SessionKindId | RequestKindId, SessionToolbarChipFilter>
> = {
	unread: 'unread',
	drafts: 'drafts',
	oneToOne: 'nearby',
	nearby: 'nearby',
	liveChat: 'liveChat',
	internalGroup: 'internalGroup',
	circle: 'groups',
	supervision: 'supervision',
	[OTHER_KIND_ID]: 'other'
};

const isSupervisedByMe = (
	extended: ExtendedSessionInterface,
	currentUserId: string | undefined
): boolean =>
	getSupervisionListState(extended, currentUserId) === 'supervisedByMe';

/**
 * Exactly one kind per row, evaluated in the spec's order (§5.2): supervision
 * by backend marker (only if the viewer can supervise) → circle → internal
 * group → live chat → supervision by legacy fallback (no marker, row owned
 * by another consultant, only if the viewer can supervise) → one-to-one.
 * The legacy heuristic runs after the structural group kinds because it
 * cannot tell a supervised case from a group an eligible consultant merely
 * subscribes to; and never for askers, whose ordinary chats it would
 * otherwise call "supervision".
 */
export const classifySession = (
	raw: ListItemInterface,
	extended: ExtendedSessionInterface,
	currentUserId: string | undefined,
	canSupervise: boolean
): SessionKindId => {
	if (!raw?.session && !raw?.chat) {
		return OTHER_KIND_ID;
	}
	const marker = hasSupervisionMarker(extended);
	if (canSupervise && marker && isSupervisedByMe(extended, currentUserId)) {
		return 'supervision';
	}
	if (isConversationCircleSession(extended)) {
		return 'circle';
	}
	if (isInternalGroupChatSession(extended)) {
		return 'internalGroup';
	}
	if (isAnonymousAskerSession(raw, extended)) {
		return 'liveChat';
	}
	if (
		canSupervise &&
		!marker &&
		raw.consultant?.id &&
		String(raw.consultant.id) !== String(currentUserId || '')
	) {
		return 'supervision';
	}
	return 'oneToOne';
};

/** Anfragen: live chat or nearby (assigned enquiries never reach this). */
export const classifyRequest = (
	raw: ListItemInterface,
	extended: ExtendedSessionInterface
): RequestKindId => {
	if (!raw?.session && !raw?.chat) {
		return OTHER_KIND_ID;
	}
	return isAnonymousAskerSession(raw, extended) ? 'liveChat' : 'nearby';
};

/**
 * Anfragen (§5.3): the Mail / Live-Chat chips are TABS over two disjoint
 * feeds, not unread pills. The list opens on "Mail" by default and a tab
 * must stay reachable while its kind is shown, unread rows or not. So the
 * pill rule of §5.1 (`visiblePillKinds`) does not apply here: a request
 * chip is hidden exactly when its kind is hidden.
 *
 * Until 2026-09 the request chips went through the pill rule: hiding Mail
 * dropped the active chip, and with zero unread requests the chip never
 * came back - not after showing Mail again, not after a reset.
 */
export const hiddenRequestKinds = <T extends { id: string }>(
	filter: DisplayFilter,
	kinds: ReadonlyArray<T>
): T[] => kinds.filter((kind) => !resolveKindSetting(filter, kind.id).show);

/**
 * The active request tab survives everything except its kind being hidden.
 * Returns the kind to keep, or `null` when the tab must be cleared.
 */
export const reconcileActiveRequestKind = (
	filter: DisplayFilter,
	activeKindId: string | null
): string | null =>
	activeKindId && resolveKindSetting(filter, activeKindId).show
		? activeKindId
		: null;

export const isKindShown = (
	filter: DisplayFilter,
	kind: SessionKindId | RequestKindId
): boolean => resolveKindSetting(filter, kind).show;

export interface SessionPair {
	raw: ListItemInterface;
	extended: ExtendedSessionInterface;
}

export interface SessionsFilterContext {
	currentUserId: string | undefined;
	canSupervise: boolean;
	/** The route-active row stays visible while open (§5.2), dimmed. */
	isActive?: (extended: ExtendedSessionInterface) => boolean;
}

export interface FilteredSessions<T extends SessionPair> {
	visible: T[];
	/** Rows kept only because they are active; the list dims them. */
	hiddenActiveIds: Set<string>;
}

const pairId = (pair: SessionPair): string =>
	String(
		pair.raw.session?.id ?? pair.raw.chat?.id ?? pair.extended.rid ?? ''
	);

/**
 * Gespräche: drop rows of hidden kinds, keep the active row (dimmed). Runs
 * after `SessionsList.filterSessions` and before `sessionMatchesToolbar`
 * (§7), so the chip refinement composes on top.
 */
export const applySessionsFilter = <T extends SessionPair>(
	pairs: ReadonlyArray<T>,
	filter: DisplayFilter,
	context: SessionsFilterContext
): FilteredSessions<T> => {
	const hiddenActiveIds = new Set<string>();
	const visible = pairs.filter((pair) => {
		const kind = classifySession(
			pair.raw,
			pair.extended,
			context.currentUserId,
			context.canSupervise
		);
		if (isKindShown(filter, kind)) {
			return true;
		}
		if (context.isActive?.(pair.extended)) {
			hiddenActiveIds.add(pairId(pair));
			return true;
		}
		return false;
	});
	return { visible, hiddenActiveIds };
};

/** Anfragen: same shape, kinds of §5.3, no active-row exception needed. */
export const applyRequestsFilter = <T extends SessionPair>(
	pairs: ReadonlyArray<T>,
	filter: DisplayFilter,
	context: Pick<SessionsFilterContext, 'isActive'> = {}
): FilteredSessions<T> => {
	const hiddenActiveIds = new Set<string>();
	const visible = pairs.filter((pair) => {
		if (isKindShown(filter, classifyRequest(pair.raw, pair.extended))) {
			return true;
		}
		if (context.isActive?.(pair.extended)) {
			hiddenActiveIds.add(pairId(pair));
			return true;
		}
		return false;
	});
	return { visible, hiddenActiveIds };
};

export const sessionPairId = pairId;
