/**
 * T24 / B2 — the session's open side channel lives in the URL:
 *   ?channel=thread:<rootEventId>[&at=<eventId>]
 *   ?channel=supervision[&at=<eventId>]
 *   ?channel=team[&at=<eventId>]        ← Teamberatung (Frank, 09.09.)
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
	stripAtParam,
	stripChannelParams,
	withChannel,
	writeLastChannel,
	safeChannelStorage,
	safeLocalStorage,
	safeSessionStorage,
	SUPERVISION_CHANNEL_ID,
	TEAM_CHANNEL_ID
} from './channelRoute';

const ROOT = '$abc:oriso.invalid';

describe('parseChannelValue / serializeChannel', () => {
	it('round-trips the supervision channel', () => {
		expect(parseChannelValue('supervision')).toEqual({
			kind: 'supervision'
		});
		expect(serializeChannel({ kind: 'supervision' })).toBe('supervision');
	});

	it('round-trips the team channel', () => {
		expect(parseChannelValue('team')).toEqual({ kind: 'team' });
		expect(serializeChannel({ kind: 'team' })).toBe('team');
		expect(parseChannelValue('  team ')).toEqual({ kind: 'team' });
	});

	it('round-trips a thread channel with a Matrix event id', () => {
		const channel = { kind: 'thread' as const, rootId: ROOT };
		expect(serializeChannel(channel)).toBe(`thread:${ROOT}`);
		expect(parseChannelValue(`thread:${ROOT}`)).toEqual(channel);
	});

	it('does not confuse a thread whose root merely starts with "team"', () => {
		// The team channel is the WHOLE value; a thread always carries the
		// `thread:` prefix, so "teamwork" is neither.
		expect(parseChannelValue('teamwork')).toBeNull();
		expect(parseChannelValue(`thread:${TEAM_CHANNEL_ID}`)).toEqual({
			kind: 'thread',
			rootId: 'team'
		});
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

	it('gives the team channel the stage id "team"', () => {
		expect(channelId({ kind: 'team' })).toBe(TEAM_CHANNEL_ID);
		expect(channelFromId(TEAM_CHANNEL_ID)).toEqual({ kind: 'team' });
		// The two side rooms are distinct ids, never each other's fallback.
		expect(TEAM_CHANNEL_ID).not.toBe(SUPERVISION_CHANNEL_ID);
	});

	it('never mistakes one side room for the other', () => {
		expect(
			channelsEqual({ kind: 'team' }, { kind: 'supervision' })
		).toBe(false);
		expect(channelsEqual({ kind: 'team' }, { kind: 'team' })).toBe(true);
		expect(
			channelsEqual({ kind: 'team' }, { kind: 'thread', rootId: 'team' })
		).toBe(false);
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

	it('writes and clears the team channel like any other', () => {
		expect(withChannel('?sessionListTab=x', { kind: 'team' })).toBe(
			'?sessionListTab=x&channel=team'
		);
		// Switching side rooms replaces the value, never appends a second one.
		expect(withChannel('?channel=supervision', { kind: 'team' })).toBe(
			'?channel=team'
		);
		expect(withChannel('?channel=team', { kind: 'supervision' })).toBe(
			'?channel=supervision'
		);
		expect(withChannel('?channel=team&at=$e', null)).toBe('');
		expect(parseChannel('?channel=team&at=$e')).toEqual({
			channel: { kind: 'team' },
			at: '$e'
		});
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

describe('last channel per session (localStorage since 09.09.)', () => {
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

	it('remembers the team channel, and remembers it AS team', () => {
		// Frank, 09.09.: "wichtig, dass für den Nutzer immer die letzte
		// Einstellung gespeichert wird" — a remembered team must not come
		// back as the supervision room.
		const storage = memory();
		writeLastChannel(storage, 74, { kind: 'team' });
		expect(readLastChannel(storage, 74)).toEqual({ kind: 'team' });
		writeLastChannel(storage, 74, { kind: 'supervision' });
		expect(readLastChannel(storage, 74)).toEqual({ kind: 'supervision' });
	});

	it('survives a reload: a fresh reader over the same store finds it', () => {
		// What `localStorage` buys over `sessionStorage` — the store outlives
		// the page. Modelled as a second reader over the same backing map.
		const map = new Map<string, string>();
		const first = {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
			}
		};
		writeLastChannel(first, 74, { kind: 'team' });
		const afterReload = {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
			}
		};
		expect(readLastChannel(afterReload, 74)).toEqual({ kind: 'team' });
	});

	it('keeps one key per session, so two sessions never bleed', () => {
		const storage = memory();
		writeLastChannel(storage, 74, { kind: 'team' });
		writeLastChannel(storage, 75, { kind: 'supervision' });
		expect(readLastChannel(storage, 74)).toEqual({ kind: 'team' });
		expect(readLastChannel(storage, 75)).toEqual({ kind: 'supervision' });
		expect(readLastChannel(storage, 76)).toBeUndefined();
	});
});

describe('safeChannelStorage (the store the host injects)', () => {
	// The unit project runs in node, where there is no `window` at all — so
	// the contract is stated over the two accessors, not over globals.
	it('is localStorage when there is one, sessionStorage otherwise', () => {
		expect(safeChannelStorage()).toBe(
			safeLocalStorage() ?? safeSessionStorage()
		);
	});

	it('prefers localStorage over sessionStorage when a window exists', () => {
		const local = { getItem: () => null, setItem: () => undefined };
		const session = { getItem: () => null, setItem: () => undefined };
		const previous = (globalThis as any).window;
		(globalThis as any).window = {
			localStorage: local,
			sessionStorage: session
		};
		try {
			expect(safeLocalStorage()).toBe(local);
			expect(safeChannelStorage()).toBe(local);
			expect(safeChannelStorage()).not.toBe(session);
		} finally {
			if (previous === undefined) {
				delete (globalThis as any).window;
			} else {
				(globalThis as any).window = previous;
			}
		}
	});

	it('falls back to sessionStorage when localStorage throws (private mode)', () => {
		const session = { getItem: () => null, setItem: () => undefined };
		const previous = (globalThis as any).window;
		(globalThis as any).window = {
			get localStorage() {
				throw new Error('blocked');
			},
			sessionStorage: session
		};
		try {
			expect(safeLocalStorage()).toBeNull();
			expect(safeChannelStorage()).toBe(session);
		} finally {
			if (previous === undefined) {
				delete (globalThis as any).window;
			} else {
				(globalThis as any).window = previous;
			}
		}
	});
});

describe('decideAutoOpen (review B2 D-3: Back after a deep link must not re-open)', () => {
	const supervision = { kind: 'supervision' as const };
	const team = { kind: 'team' as const };
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

	it('reopens a remembered TEAM channel as team, not as supervision', () => {
		// The whole point of Frank's "letzte Einstellung": what was open
		// comes back, even when the supervision room also exists.
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: team,
				loadedRootIds: null,
				hasSupervisionSideRoom: true,
				hasTeamSideRoom: true
			})
		).toEqual({ settle: true, open: team });
	});

	it('waits for the team room instead of falling back to supervision', () => {
		// The team room resolves over its own request; until it lands the
		// decision stays open rather than opening the wrong room.
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: team,
				loadedRootIds: null,
				hasSupervisionSideRoom: true,
				hasTeamSideRoom: false
			})
		).toEqual({ settle: false, open: null });
	});

	it('a remembered supervision still waits for ITS room, not the team one', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: supervision,
				loadedRootIds: null,
				hasSupervisionSideRoom: false,
				hasTeamSideRoom: true
			})
		).toEqual({ settle: false, open: null });
	});

	it('a first visit keeps supervision precedence, team stays one click away', () => {
		// Unchanged behaviour on purpose: nothing remembered means nothing
		// was chosen, and the team room does not steal the first open.
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: undefined,
				loadedRootIds: null,
				hasSupervisionSideRoom: true,
				hasTeamSideRoom: true
			})
		).toEqual({ settle: true, open: supervision });
	});

	it('a team deep link settles the session, so Back closes the panel', () => {
		expect(
			decideAutoOpen({
				routeChannel: team,
				alreadySettled: false,
				remembered: undefined,
				loadedRootIds: null,
				hasSupervisionSideRoom: true,
				hasTeamSideRoom: true
			})
		).toEqual({ settle: true, open: null });
	});

	it('an explicit close outranks a remembered team room', () => {
		expect(
			decideAutoOpen({
				routeChannel: null,
				alreadySettled: false,
				remembered: null,
				loadedRootIds: null,
				hasSupervisionSideRoom: true,
				hasTeamSideRoom: true
			})
		).toEqual({ settle: true, open: null });
	});
});

describe('stripAtParam (review B2 D-6: at= is consumed after the jump)', () => {
	it('drops at and keeps the channel and foreign params', () => {
		expect(stripAtParam('?channel=supervision&at=%24evt&keep=1')).toBe(
			'?channel=supervision&keep=1'
		);
	});

	it('returns the search unchanged when there is no at', () => {
		expect(stripAtParam('?channel=supervision')).toBe(
			'?channel=supervision'
		);
		expect(stripAtParam('')).toBe('');
	});
});
