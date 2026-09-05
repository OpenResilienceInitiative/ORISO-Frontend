/**
 * T24 / B2 — ONE URL parameter is the truth for the open side channel of a
 * session (`ANALYSE-thread-deeplink-routing-2026-09-05.md` §3):
 *
 *   /sessions/…/<roomId>/<sessionId>?channel=thread:<rootEventId>[&at=<eventId>]
 *   /sessions/…/<roomId>/<sessionId>?channel=supervision[&at=<eventId>]
 *
 * The panel state is DERIVED from the URL (never a `useState` beside it);
 * opening pushes a history entry (Back closes the panel), switching replaces
 * it, closing removes the param. The legacy `threadRootId` / `threadMessageId`
 * pair is a hard cut (Frank, 05.09.): mapped ONCE on entry by
 * `normalizeLegacyChannelSearch`, never written again.
 *
 * Channel ids match the chat stage (`chatStage/`): `'supervision'` or the
 * thread's root event id — `channelId` / `channelFromId` convert.
 *
 * Pure: no React, no router, no DOM. Storage is injected for the per-session
 * memory of the last open channel.
 */

export type SessionChannel =
	| { kind: 'supervision' }
	| { kind: 'thread'; rootId: string };

export const CHANNEL_PARAM = 'channel';
export const AT_PARAM = 'at';
export const LEGACY_THREAD_ROOT_PARAM = 'threadRootId';
export const LEGACY_THREAD_MESSAGE_PARAM = 'threadMessageId';
/** The stage's id for the supervision channel (`panelForChannel`). */
export const SUPERVISION_CHANNEL_ID = 'supervision';
const THREAD_PREFIX = 'thread:';

export const channelId = (channel: SessionChannel): string =>
	channel.kind === 'supervision' ? SUPERVISION_CHANNEL_ID : channel.rootId;

export const channelFromId = (id: string): SessionChannel =>
	id === SUPERVISION_CHANNEL_ID
		? { kind: 'supervision' }
		: { kind: 'thread', rootId: id };

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
	return a.kind === 'supervision' || a.rootId === (b as any).rootId;
};

export const serializeChannel = (channel: SessionChannel): string =>
	channel.kind === 'supervision'
		? SUPERVISION_CHANNEL_ID
		: `${THREAD_PREFIX}${channel.rootId}`;

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
 * Last open channel per session (Frank, 05.09.: "letzten Kanal merken")
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
