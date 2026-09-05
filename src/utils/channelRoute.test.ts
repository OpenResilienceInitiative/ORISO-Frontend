/**
 * T24 / B2 — the session's open side channel lives in the URL:
 *   ?channel=thread:<rootEventId>[&at=<eventId>]
 *   ?channel=supervision[&at=<eventId>]
 * The legacy `threadRootId` / `threadMessageId` pair is a hard cut: it is
 * mapped once on entry and never written again.
 */
import { describe, expect, it } from 'vitest';
import {
	buildSessionChannelPath,
	channelFromId,
	channelId,
	channelsEqual,
	decideAutoOpen,
	normalizeLegacyChannelSearch,
	parseChannel,
	parseChannelValue,
	readLastChannel,
	rewriteLegacyChannelPath,
	serializeChannel,
	stripChannelParams,
	withChannel,
	writeLastChannel,
	SUPERVISION_CHANNEL_ID
} from './channelRoute';

const ROOT = '$abc:oriso.invalid';

describe('parseChannelValue / serializeChannel', () => {
	it('round-trips the supervision channel', () => {
		expect(parseChannelValue('supervision')).toEqual({
			kind: 'supervision'
		});
		expect(serializeChannel({ kind: 'supervision' })).toBe('supervision');
	});

	it('round-trips a thread channel with a Matrix event id', () => {
		const channel = { kind: 'thread' as const, rootId: ROOT };
		expect(serializeChannel(channel)).toBe(`thread:${ROOT}`);
		expect(parseChannelValue(`thread:${ROOT}`)).toEqual(channel);
	});

	it('rejects garbage', () => {
		expect(parseChannelValue(null)).toBeNull();
		expect(parseChannelValue('')).toBeNull();
		expect(parseChannelValue('thread:')).toBeNull();
		expect(parseChannelValue('peer:1')).toBeNull();
		expect(parseChannelValue('  supervision ')).toEqual({
			kind: 'supervision'
		});
	});
});

describe('channelId / channelFromId (the stage ids)', () => {
	it('uses the chatStage ids: "supervision" or the root event id', () => {
		expect(channelId({ kind: 'supervision' })).toBe(SUPERVISION_CHANNEL_ID);
		expect(channelId({ kind: 'thread', rootId: ROOT })).toBe(ROOT);
		expect(channelFromId(SUPERVISION_CHANNEL_ID)).toEqual({
			kind: 'supervision'
		});
		expect(channelFromId(ROOT)).toEqual({ kind: 'thread', rootId: ROOT });
	});

	it('compares channels by value', () => {
		expect(
			channelsEqual(
				{ kind: 'thread', rootId: ROOT },
				{ kind: 'thread', rootId: ROOT }
			)
		).toBe(true);
		expect(
			channelsEqual(
				{ kind: 'supervision' },
				{ kind: 'thread', rootId: ROOT }
			)
		).toBe(false);
		expect(channelsEqual(null, null)).toBe(true);
		expect(channelsEqual(null, { kind: 'supervision' })).toBe(false);
	});
});

describe('parseChannel(search)', () => {
	it('reads channel and at from the search string (URL-decoded)', () => {
		const search = `?sessionListTab=archive&channel=thread%3A${encodeURIComponent(
			ROOT
		)}&at=%24evt`;
		expect(parseChannel(search)).toEqual({
			channel: { kind: 'thread', rootId: ROOT },
			at: '$evt'
		});
	});

	it('returns null without a param', () => {
		expect(parseChannel('')).toEqual({ channel: null, at: null });
		expect(parseChannel('?foo=1')).toEqual({ channel: null, at: null });
	});

	it('ignores the legacy params — they are mapped on entry, not read here', () => {
		expect(
			parseChannel(`?threadRootId=${encodeURIComponent(ROOT)}`)
		).toEqual({ channel: null, at: null });
	});
});

describe('withChannel / stripChannelParams', () => {
	it('sets the channel and keeps unrelated params', () => {
		expect(
			withChannel('?sessionListTab=archive', { kind: 'supervision' })
		).toBe('?sessionListTab=archive&channel=supervision');
	});

	it('encodes the Matrix event id and writes at', () => {
		expect(withChannel('', { kind: 'thread', rootId: ROOT }, '$evt')).toBe(
			`?channel=thread%3A${encodeURIComponent(ROOT)}&at=%24evt`
		);
	});

	it('replaces an existing channel and drops a stale at', () => {
		expect(
			withChannel(
				`?channel=thread%3A${encodeURIComponent(ROOT)}&at=%24evt`,
				{ kind: 'supervision' }
			)
		).toBe('?channel=supervision');
	});

	it('null removes channel, at and the legacy pair', () => {
		expect(
			withChannel(
				'?threadRootId=x&threadMessageId=y&channel=supervision&at=z&keep=1',
				null
			)
		).toBe('?keep=1');
		expect(stripChannelParams('?channel=supervision')).toBe('');
		expect(stripChannelParams('?a=1&channel=supervision&at=2')).toBe(
			'?a=1'
		);
	});
});

describe('normalizeLegacyChannelSearch (hard cut on entry)', () => {
	it('maps threadRootId/threadMessageId to channel/at once', () => {
		expect(
			normalizeLegacyChannelSearch(
				`?threadRootId=${encodeURIComponent(ROOT)}&threadMessageId=%24evt&x=1`
			)
		).toBe(`?x=1&channel=thread%3A${encodeURIComponent(ROOT)}&at=%24evt`);
	});

	it('returns null when nothing legacy is present', () => {
		expect(normalizeLegacyChannelSearch('?channel=supervision')).toBeNull();
		expect(normalizeLegacyChannelSearch('')).toBeNull();
	});

	it('a present channel wins over the legacy params (legacy just dropped)', () => {
		expect(
			normalizeLegacyChannelSearch('?channel=supervision&threadRootId=x')
		).toBe('?channel=supervision');
	});

	it('drops a lone threadMessageId (no root → no channel)', () => {
		expect(normalizeLegacyChannelSearch('?threadMessageId=y&x=1')).toBe(
			'?x=1'
		);
	});
});

describe('buildSessionChannelPath / rewriteLegacyChannelPath', () => {
	it('appends the channel to a base path with or without a query', () => {
		expect(
			buildSessionChannelPath('/sessions/consultant/sessionView/!r/12', {
				kind: 'supervision'
			})
		).toBe('/sessions/consultant/sessionView/!r/12?channel=supervision');
		expect(
			buildSessionChannelPath(
				'/sessions/consultant/sessionView/!r/12?sessionListTab=archive',
				{ kind: 'thread', rootId: ROOT },
				'$evt'
			)
		).toBe(
			`/sessions/consultant/sessionView/!r/12?sessionListTab=archive&channel=thread%3A${encodeURIComponent(
				ROOT
			)}&at=%24evt`
		);
	});

	it('rewrites a server-emitted legacy actionPath to the channel form', () => {
		expect(
			rewriteLegacyChannelPath(
				`/sessions/consultant/sessionView/!r/12?threadRootId=${encodeURIComponent(
					ROOT
				)}`
			)
		).toBe(
			`/sessions/consultant/sessionView/!r/12?channel=thread%3A${encodeURIComponent(
				ROOT
			)}`
		);
	});

	it('leaves paths without legacy params untouched (same reference)', () => {
		const path =
			'/sessions/consultant/sessionView/!r/12?channel=supervision';
		expect(rewriteLegacyChannelPath(path)).toBe(path);
		expect(rewriteLegacyChannelPath(null)).toBeNull();
		expect(rewriteLegacyChannelPath(undefined)).toBeUndefined();
	});
});

describe('last channel per session (sessionStorage)', () => {
	const memory = () => {
		const map = new Map<string, string>();
		return {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
			},
			removeItem: (key: string) => {
				map.delete(key);
			}
		};
	};

	it('is undefined before anything was written', () => {
		expect(readLastChannel(memory(), 74)).toBeUndefined();
	});

	it('remembers the last open channel per session', () => {
		const storage = memory();
		writeLastChannel(storage, 74, { kind: 'thread', rootId: ROOT });
		writeLastChannel(storage, 75, { kind: 'supervision' });
		expect(readLastChannel(storage, 74)).toEqual({
			kind: 'thread',
			rootId: ROOT
		});
		expect(readLastChannel(storage, 75)).toEqual({ kind: 'supervision' });
	});

	it('remembers an explicit close as null (no auto-open afterwards)', () => {
		const storage = memory();
		writeLastChannel(storage, 74, { kind: 'supervision' });
		writeLastChannel(storage, 74, null);
		expect(readLastChannel(storage, 74)).toBeNull();
	});

	it('survives a throwing or missing storage', () => {
		const broken = {
			getItem: () => {
				throw new Error('nope');
			},
			setItem: () => {
				throw new Error('nope');
			}
		};
		expect(() =>
			writeLastChannel(broken, 74, { kind: 'supervision' })
		).not.toThrow();
		expect(readLastChannel(broken, 74)).toBeUndefined();
		expect(readLastChannel(null, 74)).toBeUndefined();
		expect(readLastChannel(memory(), undefined)).toBeUndefined();
	});

	it('treats garbage as unset', () => {
		const storage = memory();
		storage.setItem('chatStage.lastChannel.74', 'peer:x');
		expect(readLastChannel(storage, 74)).toBeUndefined();
	});
});

describe('decideAutoOpen (review B2 D-3: Back after a deep link must not re-open)', () => {
	const supervision = { kind: 'supervision' as const };
	const thread = { kind: 'thread' as const, rootId: ROOT };

	it('settles the session on a deep-link entry without opening anything', () => {
		expect(
			decideAutoOpen({
				routeChannel: thread,
				alreadySettled: false,
				remembered: undefined,
				loadedRootIds: null,
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: true, open: null });
	});

	it('does nothing once the session is settled (that is what Back relies on)', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: true,
				remembered: undefined,
				loadedRootIds: [ROOT],
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: false, open: null });
	});

	it('stays closed when the user closed the panel earlier', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: null,
				loadedRootIds: [ROOT],
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: true, open: null });
	});

	it('reopens a remembered thread once its root is loaded, waits while history is empty', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: thread,
				loadedRootIds: [],
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: false, open: null });
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: thread,
				loadedRootIds: [ROOT],
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: true, open: thread });
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: thread,
				loadedRootIds: ['$other'],
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: true, open: null });
	});

	it('auto-opens the side room once on a first visit, only when it exists', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: undefined,
				loadedRootIds: null,
				hasSupervisionSideRoom: false
			})
		).toEqual({ settle: false, open: null });
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: supervision,
				loadedRootIds: null,
				hasSupervisionSideRoom: true
			})
		).toEqual({ settle: true, open: supervision });
	});
});
