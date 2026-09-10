/**
 * T24 / B2 — ONE URL parameter is the truth for the open side channel of a
 * session (`ANALYSE-thread-deeplink-routing-2026-09-05.md` §3):
 *
 *   /sessions/…/<roomId>/<sessionId>?channel=thread:<rootEventId>[&at=<eventId>]
 *   /sessions/…/<roomId>/<sessionId>?channel=supervision[&at=<eventId>]
 *   /sessions/…/<roomId>/<sessionId>?channel=team[&at=<eventId>]
 *
 * The panel state is DERIVED from the URL (never a `useState` beside it);
 * opening pushes a history entry (Back closes the panel), switching replaces
 * it, closing removes the param. The legacy `threadRootId` / `threadMessageId`
 * pair is a hard cut (Frank, 05.09.): mapped ONCE on entry by
 * `normalizeLegacyChannelSearch`, never written again.
 *
 * Channel ids match the chat stage (`chatStage/`): `'supervision'`, `'team'`
 * or the thread's root event id — `channelId` / `channelFromId` convert.
 *
 * `team` (Frank, 09.09.) is the THIRD channel and mechanically the twin of
 * `supervision`: same push/replace rules, same memory, same panel — only the
 * room, the word and the membership rule differ (`FE#514` / ADR-016: the
 * Team-Besprechung room of the enquiry, the advice seeker never a member).
 *
 * Pure: no React, no router, no DOM. Storage is injected for the per-session
 * memory of the last open channel.
 */

export type SessionChannel =
	| { kind: 'supervision' }
	| { kind: 'team' }
	| { kind: 'thread'; rootId: string };

/** The two side ROOMS of a session — a thread lives in the main room. */
export type SideRoomChannelKind = 'supervision' | 'team';

export const CHANNEL_PARAM = 'channel';
export const AT_PARAM = 'at';
export const LEGACY_THREAD_ROOT_PARAM = 'threadRootId';
export const LEGACY_THREAD_MESSAGE_PARAM = 'threadMessageId';
/** The stage's id for the supervision channel (`panelForChannel`). */
export const SUPERVISION_CHANNEL_ID = 'supervision';
/** The stage's id for the team-counselling channel (Teamberatung). */
export const TEAM_CHANNEL_ID = 'team';
const THREAD_PREFIX = 'thread:';

export const channelId = (channel: SessionChannel): string => {
	switch (channel.kind) {
		case 'supervision':
			return SUPERVISION_CHANNEL_ID;
		case 'team':
			return TEAM_CHANNEL_ID;
		default:
			return channel.rootId;
	}
};

export const channelFromId = (id: string): SessionChannel => {
	switch (id) {
		case SUPERVISION_CHANNEL_ID:
			return { kind: 'supervision' };
		case TEAM_CHANNEL_ID:
			return { kind: 'team' };
		default:
			return { kind: 'thread', rootId: id };
	}
};

export const channelsEqual = (
	a: SessionChannel | null | undefined,
	b: SessionChannel | null | undefined
): boolean => {
	if (!a || !b) {
		return !a && !b;
	}
	if (a.kind !== b.kind) {
		return false;
	}
	// Side rooms carry no id of their own — the kind alone identifies them.
	return (
		a.kind !== 'thread' ||
		a.rootId === (b as { kind: 'thread'; rootId: string }).rootId
	);
};

export const serializeChannel = (channel: SessionChannel): string =>
	channel.kind === 'thread'
		? `${THREAD_PREFIX}${channel.rootId}`
		: channelId(channel);

export const parseChannelValue = (
	value: string | null | undefined
): SessionChannel | null => {
	const raw = (value ?? '').trim();
	if (!raw) {
		return null;
	}
	if (raw === SUPERVISION_CHANNEL_ID) {
		return { kind: 'supervision' };
	}
	if (raw === TEAM_CHANNEL_ID) {
		return { kind: 'team' };
	}
	if (raw.startsWith(THREAD_PREFIX)) {
		const rootId = raw.slice(THREAD_PREFIX.length).trim();
		return rootId ? { kind: 'thread', rootId } : null;
	}
	return null;
};

export interface ParsedChannelSearch {
	channel: SessionChannel | null;
	/** Event id to jump to / highlight inside the channel (or main chat). */
	at: string | null;
}

const toParams = (search: string): URLSearchParams =>
	new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

const fromParams = (params: URLSearchParams): string => {
	const query = params.toString();
	return query ? `?${query}` : '';
};

/** Reads `channel` / `at` from a search string. Legacy params are NOT read here. */
export const parseChannel = (search: string): ParsedChannelSearch => {
	const params = toParams(search || '');
	const at = params.get(AT_PARAM);
	return {
		channel: parseChannelValue(params.get(CHANNEL_PARAM)),
		at: at ? at : null
	};
};

const deleteChannelParams = (params: URLSearchParams) => {
	params.delete(CHANNEL_PARAM);
	params.delete(AT_PARAM);
	params.delete(LEGACY_THREAD_ROOT_PARAM);
	params.delete(LEGACY_THREAD_MESSAGE_PARAM);
};

/**
 * The search string with `channel` set (and `at` when given); `null` removes
 * the channel, its `at` and any legacy pair. Unrelated params survive.
 */
export const withChannel = (
	search: string,
	channel: SessionChannel | null,
	at?: string | null
): string => {
	const params = toParams(search || '');
	deleteChannelParams(params);
	if (channel) {
		params.set(CHANNEL_PARAM, serializeChannel(channel));
		if (at) {
			params.set(AT_PARAM, at);
		}
	}
	return fromParams(params);
};

export const stripChannelParams = (search: string): string =>
	withChannel(search, null);

/** The search without `at` (consumed after the jump); the channel stays. */
export const stripAtParam = (search: string): string => {
	const params = toParams(search || '');
	if (!params.has(AT_PARAM)) {
		return search || '';
	}
	params.delete(AT_PARAM);
	return fromParams(params);
};

/**
 * Hard cut for the legacy pair: when `threadRootId` (and optionally
 * `threadMessageId`) is present, returns the search with them mapped to
 * `channel=thread:<id>` / `at=<id>`; an existing `channel` wins and the
 * legacy params are simply dropped. `null` when nothing legacy is there.
 */
export const normalizeLegacyChannelSearch = (search: string): string | null => {
	const params = toParams(search || '');
	if (
		!params.has(LEGACY_THREAD_ROOT_PARAM) &&
		!params.has(LEGACY_THREAD_MESSAGE_PARAM)
	) {
		return null;
	}
	const existing = parseChannelValue(params.get(CHANNEL_PARAM));
	const existingAt = params.get(AT_PARAM);
	const legacyRoot = (params.get(LEGACY_THREAD_ROOT_PARAM) || '').trim();
	const legacyAt = (params.get(LEGACY_THREAD_MESSAGE_PARAM) || '').trim();
	params.delete(LEGACY_THREAD_ROOT_PARAM);
	params.delete(LEGACY_THREAD_MESSAGE_PARAM);
	if (existing) {
		return fromParams(params);
	}
	params.delete(CHANNEL_PARAM);
	params.delete(AT_PARAM);
	if (legacyRoot) {
		params.set(
			CHANNEL_PARAM,
			serializeChannel({ kind: 'thread', rootId: legacyRoot })
		);
		const at = legacyAt || existingAt;
		if (at) {
			params.set(AT_PARAM, at);
		}
	}
	return fromParams(params);
};

const splitPath = (path: string): [string, string] => {
	const index = path.indexOf('?');
	return index === -1
		? [path, '']
		: [path.slice(0, index), path.slice(index)];
};

/** `<basePath>?…&channel=…` — the one builder every entry point uses. */
export const buildSessionChannelPath = (
	basePath: string,
	channel: SessionChannel | null,
	at?: string | null
): string => {
	const [pathname, search] = splitPath(basePath);
	return `${pathname}${withChannel(search, channel, at)}`;
};

/**
 * Server-emitted action paths still carry `?threadRootId=` until the
 * UserService side (analysis B2) lands: rewrite them once at the boundary.
 * Untouched (same reference) when nothing legacy is in the path.
 */
export function rewriteLegacyChannelPath(path: string): string;
export function rewriteLegacyChannelPath(path: null): null;
export function rewriteLegacyChannelPath(path: undefined): undefined;
export function rewriteLegacyChannelPath(
	path: string | null | undefined
): string | null | undefined;
export function rewriteLegacyChannelPath(
	path: string | null | undefined
): string | null | undefined {
	if (!path) {
		return path;
	}
	const [pathname, search] = splitPath(path);
	const normalized = normalizeLegacyChannelSearch(search);
	return normalized === null ? path : `${pathname}${normalized}`;
}

/* ------------------------------------------------------------------ *
 * Auto-open on entry (B2; review D-3)
 * ------------------------------------------------------------------ */

export interface AutoOpenInput {
	/** The channel the URL asks for right now (deep link, or after Back: none). */
	routeChannel: SessionChannel | null;
	/** The host already settled this session (nothing more to decide). */
	alreadySettled: boolean;
	/** `readLastChannel`: `undefined` first visit, `null` closed by the user. */
	remembered: SessionChannel | null | undefined;
	/** Root ids of the loaded history; `null` while the timeline is not there yet. */
	loadedRootIds: string[] | null;
	hasSupervisionSideRoom: boolean;
	/**
	 * The Teamberatung room of this session exists AND the viewer may see it
	 * (`apiGetTeamDiscussion` answered with a `matrixRoomId`). Optional so
	 * every existing caller and test keeps its meaning.
	 */
	hasTeamSideRoom?: boolean;
}

export interface AutoOpenDecision {
	/** Mark the session as handled — no later run may open anything for it. */
	settle: boolean;
	/** Channel to open with `replace`, or nothing. */
	open: SessionChannel | null;
}

const KEEP_WAITING: AutoOpenDecision = { settle: false, open: null };

/**
 * What the host does with a session it has just entered. Entering WITH a
 * channel in the URL (deep link, timeline, e-mail) settles the session
 * right away: the URL is the truth and browser Back must land on the
 * closed main chat, not re-run the first-visit auto-open (review D-3).
 * Without a channel: a remembered close stays closed, a remembered thread
 * re-opens once its root is in the loaded history, else the remembered SIDE
 * ROOM (supervision or team) re-opens once it exists — never before.
 *
 * Frank, 09.09.: "für den Nutzer [wird] immer die letzte Einstellung
 * gespeichert" — so a remembered `team` comes back as team, not as
 * supervision. With nothing remembered at all (first visit) the supervision
 * room keeps today's precedence; the Teamberatung is then one click away in
 * the channel card or the FAB.
 */
export const decideAutoOpen = ({
	routeChannel,
	alreadySettled,
	remembered,
	loadedRootIds,
	hasSupervisionSideRoom,
	hasTeamSideRoom = false
}: AutoOpenInput): AutoOpenDecision => {
	if (routeChannel) {
		return { settle: true, open: null };
	}
	if (alreadySettled) {
		return KEEP_WAITING;
	}
	if (remembered === null) {
		return { settle: true, open: null };
	}
	if (remembered?.kind === 'thread') {
		if (!loadedRootIds || loadedRootIds.length === 0) {
			return KEEP_WAITING;
		}
		return {
			settle: true,
			open: loadedRootIds.includes(remembered.rootId) ? remembered : null
		};
	}
	// Nothing remembered → the first visit still belongs to the supervision
	// room (unchanged behaviour); a remembered side room wins over it.
	const wanted: SessionChannel = remembered ?? { kind: 'supervision' };
	const exists =
		wanted.kind === 'team' ? hasTeamSideRoom : hasSupervisionSideRoom;
	if (!exists) {
		return KEEP_WAITING;
	}
	return { settle: true, open: wanted };
};

/* ------------------------------------------------------------------ *
 * Last open channel per session (Frank, 05.09.: "letzten Kanal merken";
 * 09.09.: "wichtig, dass für den Nutzer immer die letzte Einstellung
 * gespeichert wird")
 *
 * WHY `localStorage` and not `sessionStorage` (the decision, 09.09.):
 * `sessionStorage` is scoped to ONE tab and dies with it — close the tab,
 * open the app again tomorrow, and the remembered channel is gone. That is
 * exactly the gap Frank named, so the store moves to `localStorage`, which
 * survives tab and browser restarts on the same device.
 *
 * WHY NOT Matrix account data (the durable, cross-device variant used by
 * `utils/notificationSettings/store.ts`): three reasons, in order of weight.
 *   1. It is not the same KIND of state. Notification settings are a handful
 *      of account-wide switches; this is one entry PER SESSION, written on
 *      every panel open, switch and close. Account data would take a network
 *      round trip per toggle and grow without a bound anyone ever collects.
 *   2. Cross-device sameness is not obviously wanted here. The desktop shows
 *      the panel BESIDE the chat, the phone shows it INSTEAD of the chat —
 *      "the panel I last had open" is a per-device habit, not an identity.
 *   3. It is reversible. The store is injected (`ChannelStorageLike`), so
 *      swapping in an account-data backend later touches this one seam and
 *      no caller.
 * Cost accepted: one key per session id per device, ~45 bytes each — a
 * counsellor with 2 000 sessions spends ~90 KB of a 5 MB budget. Cheaper
 * than an index that would have to be kept correct.
 * ------------------------------------------------------------------ */

export interface ChannelStorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
}

export const lastChannelKey = (sessionId: string | number) =>
	`chatStage.lastChannel.${sessionId}`;

const CLOSED_MARKER = 'none';

/**
 * `undefined` = nothing remembered (first visit → the host may auto-open),
 * `null` = the user closed the panel in this session (stay closed),
 * else the channel to reopen.
 */
export const readLastChannel = (
	storage: ChannelStorageLike | null | undefined,
	sessionId: string | number | null | undefined
): SessionChannel | null | undefined => {
	if (!storage || sessionId === null || sessionId === undefined) {
		return undefined;
	}
	try {
		const raw = storage.getItem(lastChannelKey(sessionId));
		if (raw === null) {
			return undefined;
		}
		if (raw === CLOSED_MARKER) {
			return null;
		}
		return parseChannelValue(raw) ?? undefined;
	} catch {
		return undefined;
	}
};

export const writeLastChannel = (
	storage: ChannelStorageLike | null | undefined,
	sessionId: string | number | null | undefined,
	channel: SessionChannel | null
): void => {
	if (!storage || sessionId === null || sessionId === undefined) {
		return;
	}
	try {
		storage.setItem(
			lastChannelKey(sessionId),
			channel ? serializeChannel(channel) : CLOSED_MARKER
		);
	} catch {
		/* private mode: nothing to remember */
	}
};

export const safeSessionStorage = (): ChannelStorageLike | null => {
	try {
		return typeof window !== 'undefined' ? window.sessionStorage : null;
	} catch {
		return null;
	}
};

export const safeLocalStorage = (): ChannelStorageLike | null => {
	try {
		return typeof window !== 'undefined' ? window.localStorage : null;
	} catch {
		return null;
	}
};

/**
 * The store the host uses: `localStorage` so the choice outlives the tab,
 * falling back to `sessionStorage` where `localStorage` is unavailable
 * (Safari private mode throws on access) so the memory still works for the
 * length of the visit instead of silently doing nothing.
 */
export const safeChannelStorage = (): ChannelStorageLike | null =>
	safeLocalStorage() ?? safeSessionStorage();
