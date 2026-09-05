/**
 * WP-B2 — pure state behind the supervision parallel panel.
 *
 * Everything here is free of React and Matrix so the rules can be unit-tested
 * and ported 1:1. `SessionItemComponent` owns the reducer and feeds it the
 * events it observes (side room resolved, message arrived, thread opened …).
 *
 * State machine (status):
 *
 *   hidden ──ROOM_RESOLVED──▶ expanded | collapsed (remembered per session)
 *   expanded ──COLLAPSE / THREAD_OPENED──▶ collapsed
 *   collapsed ──EXPAND──▶ expanded
 *   collapsed ──INCOMING(desktop)──▶ expanded          (auto re-open)
 *   collapsed ──INCOMING(phone)──▶ collapsed + hasNewMessage (pulse + badge)
 *   collapsed(yieldedToThread) ──THREAD_CLOSED──▶ expanded
 *   any ──ROOM_LOST──▶ hidden
 *
 * Closing (the X) and collapsing are the same transition: the mini card / FAB
 * stays visible as long as the side room exists, so the user can always come
 * back. "Unread" = side-room messages from someone else that arrived after
 * `lastExpandedAt`; while expanded the count is 0 by definition.
 */

export type SupervisionLayout = 'desktop' | 'phone';
export type SupervisionPanelStatus = 'hidden' | 'expanded' | 'collapsed';

export interface SupervisionPanelState {
	status: SupervisionPanelStatus;
	/** Epoch ms of the last expansion; messages newer than this are unread. */
	lastExpandedAt: number;
	/** A message arrived while collapsed and the panel did not auto-open (phone / thread). */
	hasNewMessage: boolean;
	/** Collapsed only because a thread took the side slot; re-expands when it closes. */
	yieldedToThread: boolean;
}

export type SupervisionPanelAction =
	| { type: 'ROOM_RESOLVED'; rememberedCollapsed: boolean; now: number }
	| { type: 'ROOM_LOST' }
	| { type: 'EXPAND'; now: number }
	| { type: 'COLLAPSE' }
	| {
			type: 'INCOMING';
			layout: SupervisionLayout;
			isOwn: boolean;
			now: number;
	  }
	| { type: 'THREAD_OPENED' }
	| { type: 'THREAD_CLOSED'; now: number };

export const INITIAL_SUPERVISION_PANEL_STATE: SupervisionPanelState = {
	status: 'hidden',
	lastExpandedAt: 0,
	hasNewMessage: false,
	yieldedToThread: false
};

const expanded = (now: number): SupervisionPanelState => ({
	status: 'expanded',
	lastExpandedAt: now,
	hasNewMessage: false,
	yieldedToThread: false
});

export const reduceSupervisionPanel = (
	state: SupervisionPanelState,
	action: SupervisionPanelAction
): SupervisionPanelState => {
	switch (action.type) {
		case 'ROOM_RESOLVED':
			if (state.status !== 'hidden') {
				return state;
			}
			return action.rememberedCollapsed
				? {
						status: 'collapsed',
						lastExpandedAt: action.now,
						hasNewMessage: false,
						yieldedToThread: false
					}
				: expanded(action.now);
		case 'ROOM_LOST':
			return INITIAL_SUPERVISION_PANEL_STATE;
		case 'EXPAND':
			return state.status === 'hidden' ? state : expanded(action.now);
		case 'COLLAPSE':
			return state.status === 'hidden'
				? state
				: { ...state, status: 'collapsed', yieldedToThread: false };
		case 'INCOMING':
			if (action.isOwn || state.status !== 'collapsed') {
				return state;
			}
			if (action.layout === 'desktop' && !state.yieldedToThread) {
				return expanded(action.now);
			}
			return { ...state, hasNewMessage: true };
		case 'THREAD_OPENED':
			return state.status === 'expanded'
				? { ...state, status: 'collapsed', yieldedToThread: true }
				: state;
		case 'THREAD_CLOSED':
			return state.status === 'collapsed' && state.yieldedToThread
				? expanded(action.now)
				: state;
		default:
			return state;
	}
};

/** The minimal shape the helpers below read from a timeline item. */
export interface SideRoomMessageLike {
	_id: string;
	/** `prepareMessages` stores the epoch ms as a string in `messageTime`. */
	messageTime?: string;
	userId?: string;
	rid?: string;
}

const messageTs = (message: SideRoomMessageLike): number => {
	const parsed = Number(message.messageTime);
	return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Side-room messages from someone else that arrived after `sinceTs`. Own
 * messages never count, and an expanded panel always reports 0.
 */
export const countUnreadSideRoomMessages = (
	messages: ReadonlyArray<SideRoomMessageLike> | null | undefined,
	state: Pick<SupervisionPanelState, 'status' | 'lastExpandedAt'>,
	isOwn: (userId: string) => boolean
): number => {
	if (!messages || state.status === 'expanded') {
		return 0;
	}
	return messages.filter(
		(message) =>
			messageTs(message) > state.lastExpandedAt &&
			!isOwn(message.userId || '')
	).length;
};

/**
 * Message split safety net: the client-facing timeline must never contain
 * side-room events. `SessionStream` keeps the rooms apart at load time and
 * stamps `rid` on side-room items; this drops anything that still carries
 * the side room id.
 */
export const excludeSideRoomMessages = <T extends SideRoomMessageLike>(
	messages: ReadonlyArray<T> | null | undefined,
	supervisionRoomId: string | null | undefined
): T[] => {
	if (!messages) {
		return [];
	}
	if (!supervisionRoomId) {
		return [...messages];
	}
	return messages.filter((message) => message.rid !== supervisionRoomId);
};

/**
 * Messages not seen before (by id). The caller keeps `knownIds` and decides
 * whether the first hydration counts (it should not: history is not "new").
 */
export const findUnseenMessages = <T extends SideRoomMessageLike>(
	messages: ReadonlyArray<T> | null | undefined,
	knownIds: ReadonlySet<string>
): T[] => (messages || []).filter((message) => !knownIds.has(message._id));

/** Snippet for the mini card: last message body, one line. */
export const lastSideRoomSnippet = (
	messages: ReadonlyArray<{ message?: string }> | null | undefined
): string | undefined => {
	const last = messages?.[messages.length - 1];
	const text = (last?.message || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text || undefined;
};

/* ------------------------------------------------------------------ *
 * Persistence (storage injected so the rules stay testable)
 * ------------------------------------------------------------------ */

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
}

export const collapsedPreferenceKey = (sessionId: string | number) =>
	`supervisionPanel.collapsed.${sessionId}`;
export const secondaryWidthKey = (userId: string | number) =>
	`supervisionPanel.width.${userId}`;
export const miniPositionKey = (userId: string | number) =>
	`supervisionPanel.mini.${userId}`;

const safeGet = (storage: StorageLike | null | undefined, key: string) => {
	try {
		return storage?.getItem(key) ?? null;
	} catch {
		return null;
	}
};

const safeSet = (
	storage: StorageLike | null | undefined,
	key: string,
	value: string
) => {
	try {
		storage?.setItem(key, value);
	} catch {
		// Storage may be disabled (private mode); the in-memory state still works.
	}
};

/** Per-session "the user collapsed it" flag (sessionStorage in the app). */
export const readCollapsedPreference = (
	storage: StorageLike | null | undefined,
	sessionId: string | number | null | undefined
): boolean =>
	sessionId !== null &&
	sessionId !== undefined &&
	safeGet(storage, collapsedPreferenceKey(sessionId)) === '1';

export const writeCollapsedPreference = (
	storage: StorageLike | null | undefined,
	sessionId: string | number | null | undefined,
	collapsed: boolean
): void => {
	if (sessionId === null || sessionId === undefined) {
		return;
	}
	safeSet(storage, collapsedPreferenceKey(sessionId), collapsed ? '1' : '0');
};

/** Per-user secondary pane width (localStorage in the app). */
export const readSecondaryWidth = (
	storage: StorageLike | null | undefined,
	userId: string | number | null | undefined,
	fallback: number
): number => {
	if (userId === null || userId === undefined) {
		return fallback;
	}
	const parsed = Number(safeGet(storage, secondaryWidthKey(userId)));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const writeSecondaryWidth = (
	storage: StorageLike | null | undefined,
	userId: string | number | null | undefined,
	width: number
): void => {
	if (userId === null || userId === undefined || !Number.isFinite(width)) {
		return;
	}
	safeSet(storage, secondaryWidthKey(userId), String(Math.round(width)));
};

export interface MiniPositionLike {
	right: number;
	bottom: number;
}

/** Per-user mini card position (localStorage in the app). */
export const readMiniPosition = (
	storage: StorageLike | null | undefined,
	userId: string | number | null | undefined
): MiniPositionLike | null => {
	if (userId === null || userId === undefined) {
		return null;
	}
	const raw = safeGet(storage, miniPositionKey(userId));
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			Number.isFinite(parsed.right) &&
			Number.isFinite(parsed.bottom)
		) {
			return {
				right: Math.max(0, parsed.right),
				bottom: Math.max(0, parsed.bottom)
			};
		}
	} catch {
		// fall through
	}
	return null;
};

export const writeMiniPosition = (
	storage: StorageLike | null | undefined,
	userId: string | number | null | undefined,
	position: MiniPositionLike
): void => {
	if (userId === null || userId === undefined) {
		return;
	}
	safeSet(storage, miniPositionKey(userId), JSON.stringify(position));
};

/** `window.sessionStorage`, or null when access throws (privacy mode, SSR). */
export const safeSessionStorage = (): StorageLike | null => {
	try {
		return typeof window !== 'undefined' ? window.sessionStorage : null;
	} catch {
		return null;
	}
};

/** `window.localStorage`, or null when access throws (privacy mode, SSR). */
export const safeLocalStorage = (): StorageLike | null => {
	try {
		return typeof window !== 'undefined' ? window.localStorage : null;
	} catch {
		return null;
	}
};
