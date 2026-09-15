/**
 * #1377 slice 2 — display-filter store against a fake Matrix client
 * (spec §7 rules 1–5 and the version rule).
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_DISPLAY_FILTERS,
	DISPLAY_FILTERS_VERSION,
	resolveEffective
} from './model';
import {
	DISPLAY_FILTERS_EVENT_TYPE,
	displayFilterStore,
	mirrorKey
} from './store';

type Handler = (...args: any[]) => void;

interface FakeClient {
	getUserId: () => string;
	getSyncState: () => string | null;
	getAccountData: (type: string) => { getContent: () => any } | undefined;
	setAccountData: ReturnType<typeof vi.fn>;
	on: (event: string, handler: Handler) => void;
	removeListener: (event: string, handler: Handler) => void;
	/** Test helpers */
	sync: (state: string) => void;
	emitAccountData: (type: string, content: any) => void;
	stored: () => any;
	pending: Array<() => void>;
}

const makeClient = (
	userId: string,
	options: { synced?: boolean; deferWrites?: boolean; initial?: any } = {}
): FakeClient => {
	const accountData = new Map<string, any>();
	if (options.initial !== undefined) {
		accountData.set(DISPLAY_FILTERS_EVENT_TYPE, options.initial);
	}
	const handlers: Record<string, Handler[]> = {};
	let syncState: string | null = options.synced === false ? null : 'PREPARED';
	const client: FakeClient = {
		pending: [],
		getUserId: () => userId,
		getSyncState: () => syncState,
		getAccountData: (type) =>
			accountData.has(type)
				? { getContent: () => accountData.get(type) }
				: undefined,
		setAccountData: vi.fn((type: string, content: any) => {
			if (!options.deferWrites) {
				accountData.set(type, content);
				return Promise.resolve();
			}
			return new Promise<void>((resolve) => {
				client.pending.push(() => {
					accountData.set(type, content);
					resolve();
				});
			});
		}),
		on: (event, handler) => {
			(handlers[event] ||= []).push(handler);
		},
		removeListener: (event, handler) => {
			handlers[event] = (handlers[event] || []).filter(
				(h) => h !== handler
			);
		},
		sync: (state) => {
			syncState = state;
			(handlers.sync || []).forEach((h) => h(state, null));
		},
		emitAccountData: (type, content) => {
			accountData.set(type, content);
			(handlers.accountData || []).forEach((h) =>
				h({ getType: () => type, getContent: () => content })
			);
		},
		stored: () => accountData.get(DISPLAY_FILTERS_EVENT_TYPE)
	};
	return client;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const hideCalls = {
	kinds: { calls: { show: false, pill: false } },
	autoReadHidden: false
};

const v1With = (sections: any) => ({
	version: 1,
	global: DEFAULT_DISPLAY_FILTERS.global,
	sections
});

describe('display-filter store — attach (rules 1–2)', () => {
	beforeEach(() => {
		displayFilterStore.resetForTests();
		localStorage.clear();
	});

	it('account data only: authoritative, mirror written', () => {
		const client = makeClient('@a:hs', {
			initial: v1With({ timeline: hideCalls })
		});
		displayFilterStore.attachClient(client as any);
		const state = displayFilterStore.getState();
		expect(state.source).toBe('account');
		expect(state.synced).toBe(true);
		expect(state.filters.sections.timeline).toEqual(hideCalls);
		expect(JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!)).toEqual(
			state.filters
		);
		expect(client.setAccountData).not.toHaveBeenCalled();
	});

	it('mirror only: first-attach seed, persisted once', async () => {
		localStorage.setItem(
			mirrorKey('@a:hs'),
			JSON.stringify(v1With({ sessions: hideCalls }))
		);
		const client = makeClient('@a:hs');
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.getState().filters.sections.sessions).toEqual(
			hideCalls
		);
		await flush();
		expect(client.setAccountData).toHaveBeenCalledTimes(1);
		expect(client.stored().sections.sessions).toEqual(hideCalls);
	});

	it('both: account wins and overwrites the mirror', () => {
		localStorage.setItem(
			mirrorKey('@a:hs'),
			JSON.stringify(v1With({ sessions: hideCalls }))
		);
		const client = makeClient('@a:hs', {
			initial: v1With({ timeline: hideCalls })
		});
		displayFilterStore.attachClient(client as any);
		const { filters } = displayFilterStore.getState();
		expect(filters.sections.sessions).toBeUndefined();
		expect(filters.sections.timeline).toEqual(hideCalls);
		expect(JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!)).toEqual(
			filters
		);
	});

	it('malformed account blob: defaults, mirror of another user ignored, first write replaces it', async () => {
		localStorage.setItem(
			mirrorKey('@someone-else:hs'),
			JSON.stringify(v1With({ sessions: hideCalls }))
		);
		const client = makeClient('@a:hs', { initial: { garbage: true } });
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		await flush();
		expect(client.stored()).toEqual(DEFAULT_DISPLAY_FILTERS);
	});

	it("malformed account blob with the same user's mirror: defaults win, not the mirror", async () => {
		localStorage.setItem(
			mirrorKey('@a:hs'),
			JSON.stringify(v1With({ sessions: hideCalls }))
		);
		const client = makeClient('@a:hs', { initial: { garbage: true } });
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		await flush();
		expect(client.stored()).toEqual(DEFAULT_DISPLAY_FILTERS);
	});

	it('"no event yet" is decided only after PREPARED/SYNCING (pre-sync cache never seeds)', async () => {
		localStorage.setItem(
			mirrorKey('@a:hs'),
			JSON.stringify(v1With({ sessions: hideCalls }))
		);
		const client = makeClient('@a:hs', { synced: false });
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.getState().synced).toBe(false);
		expect(displayFilterStore.getState().source).toBe('mirror');
		// The account's real record arrives with the initial sync.
		client.emitAccountData(
			DISPLAY_FILTERS_EVENT_TYPE,
			v1With({ requests: hideCalls })
		);
		client.sync('SYNCING');
		await flush();
		const { filters, synced } = displayFilterStore.getState();
		expect(synced).toBe(true);
		expect(filters.sections.requests).toEqual(hideCalls);
		expect(filters.sections.sessions).toBeUndefined();
		expect(client.setAccountData).not.toHaveBeenCalled();
	});
});

describe('display-filter store — review follow-ups (#1378)', () => {
	beforeEach(() => {
		displayFilterStore.resetForTests();
		localStorage.clear();
	});

	it('rejected account-data write: rolls back to the confirmed record and flags it', async () => {
		const client = makeClient('@a:hs', {
			initial: v1With({ timeline: hideCalls })
		});
		client.setAccountData.mockRejectedValue(new Error('boom'));
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.setSection('sessions', hideCalls)).toBe(true);
		expect(displayFilterStore.getState().filters.sections.sessions).toEqual(
			hideCalls
		);
		await flush();
		const state = displayFilterStore.getState();
		expect(state.writeFailed).toBe(true);
		expect(state.filters.sections.sessions).toBeUndefined();
		expect(state.filters.sections.timeline).toEqual(hideCalls);
		// The mirror still holds the confirmed record, never the failed one.
		expect(
			JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!).sections
				.sessions
		).toBeUndefined();
		// The next accepted update clears the flag.
		client.setAccountData.mockResolvedValue(undefined);
		displayFilterStore.setSection('requests', hideCalls);
		expect(displayFilterStore.getState().writeFailed).toBe(false);
	});

	it('a failed B after a successful A rolls back to A, not to before A', async () => {
		const client = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS
		});
		const gates: Array<() => void> = [];
		client.setAccountData.mockImplementation(
			() =>
				gates.length === 0
					? new Promise<void>((resolve) => gates.push(resolve)) // A
					: Promise.reject(new Error('boom')) // B
		);
		displayFilterStore.attachClient(client as any);
		displayFilterStore.setSection('timeline', hideCalls); // A (in flight)
		displayFilterStore.setSection('sessions', hideCalls); // B (queued)
		gates[0]();
		await flush();
		await flush();
		const state = displayFilterStore.getState();
		expect(client.setAccountData).toHaveBeenCalledTimes(2);
		expect(state.writeFailed).toBe(true);
		expect(state.filters.sections.timeline).toEqual(hideCalls);
		expect(state.filters.sections.sessions).toBeUndefined();
	});

	it('an account-data echo of write A does not drop queued update B', async () => {
		const client = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS,
			deferWrites: true
		});
		displayFilterStore.attachClient(client as any);
		displayFilterStore.setSection('timeline', hideCalls); // A (in flight)
		displayFilterStore.setSection('sessions', hideCalls); // B (queued)
		const echoOfA = client.setAccountData.mock.calls[0][1];
		client.emitAccountData(DISPLAY_FILTERS_EVENT_TYPE, echoOfA);
		expect(displayFilterStore.getState().filters.sections.sessions).toEqual(
			hideCalls
		);
		client.pending.shift()!();
		await flush();
		expect(client.setAccountData).toHaveBeenCalledTimes(2);
		expect(client.setAccountData.mock.calls[1][1].sections).toEqual({
			timeline: hideCalls,
			sessions: hideCalls
		});
	});

	it('newer mirror and no account event: stays read-only, nothing seeded', () => {
		localStorage.setItem(
			mirrorKey('@a:hs'),
			JSON.stringify({ ...v1With({}), version: 99, future: true })
		);
		const client = makeClient('@a:hs');
		displayFilterStore.attachClient(client as any);
		const state = displayFilterStore.getState();
		expect(state.synced).toBe(true);
		expect(state.readOnly).toBe(true);
		expect(state.source).toBe('mirror');
		expect(client.setAccountData).not.toHaveBeenCalled();
		expect(displayFilterStore.setSection('timeline', hideCalls)).toBe(
			false
		);
	});

	it('same-user client replacement keeps the mirror and the state until the new client syncs', () => {
		const first = makeClient('@a:hs', {
			initial: v1With({ timeline: hideCalls })
		});
		displayFilterStore.attachClient(first as any);
		const replacement = makeClient('@a:hs', {
			synced: false,
			initial: v1With({ timeline: hideCalls })
		});
		displayFilterStore.attachClient(replacement as any);
		let state = displayFilterStore.getState();
		expect(state.synced).toBe(false);
		expect(state.filters.sections.timeline).toEqual(hideCalls);
		expect(localStorage.getItem(mirrorKey('@a:hs'))).not.toBeNull();
		expect(displayFilterStore.setSection('sessions', hideCalls)).toBe(
			false
		);
		replacement.sync('PREPARED');
		state = displayFilterStore.getState();
		expect(state.synced).toBe(true);
		expect(state.source).toBe('account');
		expect(state.filters.sections.timeline).toEqual(hideCalls);
		expect(replacement.setAccountData).not.toHaveBeenCalled();
	});
});

describe('display-filter store — updates (rules 3–4, version rule)', () => {
	beforeEach(() => {
		displayFilterStore.resetForTests();
		localStorage.clear();
	});

	it('rejects updates before attach and before sync (nothing written)', () => {
		expect(displayFilterStore.setSection('timeline', hideCalls)).toBe(
			false
		);
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		expect(localStorage.length).toBe(0);

		const client = makeClient('@a:hs', { synced: false });
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.setSection('timeline', hideCalls)).toBe(
			false
		);
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		expect(client.setAccountData).not.toHaveBeenCalled();
	});

	it('writes account data first and the mirror on success', async () => {
		const client = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS,
			deferWrites: true
		});
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.setSection('timeline', hideCalls)).toBe(true);
		expect(
			resolveEffective(displayFilterStore.getState().filters, 'timeline')
		).toEqual(hideCalls);
		expect(client.setAccountData).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!).sections
				.timeline
		).toBeUndefined();
		client.pending.shift()!();
		await flush();
		expect(
			JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!).sections
				.timeline
		).toEqual(hideCalls);
	});

	it('serialises writes: second request waits, carries the coalesced state', async () => {
		const client = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS,
			deferWrites: true
		});
		displayFilterStore.attachClient(client as any);
		displayFilterStore.setSection('timeline', hideCalls);
		displayFilterStore.setSection('sessions', hideCalls);
		displayFilterStore.setGlobal('requests', {
			kinds: {},
			autoReadHidden: false,
			hiddenEventTypes: ['ignored-outside-timeline']
		});
		expect(client.setAccountData).toHaveBeenCalledTimes(1);
		client.pending.shift()!();
		await flush();
		expect(client.setAccountData).toHaveBeenCalledTimes(2);
		const second = client.setAccountData.mock.calls[1][1];
		expect(second.sections).toEqual({
			timeline: hideCalls,
			sessions: hideCalls
		});
		client.pending.shift()!();
		await flush();
		expect(client.setAccountData).toHaveBeenCalledTimes(2);
		expect(client.stored()).toEqual(displayFilterStore.getState().filters);
		expect(JSON.parse(localStorage.getItem(mirrorKey('@a:hs'))!)).toEqual(
			displayFilterStore.getState().filters
		);
	});

	it('newer version → read-only: every write path refuses', () => {
		const client = makeClient('@a:hs', {
			initial: {
				version: DISPLAY_FILTERS_VERSION + 1,
				global: { timeline: { autoReadHidden: true } },
				sections: {}
			}
		});
		displayFilterStore.attachClient(client as any);
		expect(displayFilterStore.getState().readOnly).toBe(true);
		expect(displayFilterStore.canWrite()).toBe(false);
		expect(
			resolveEffective(displayFilterStore.getState().filters, 'timeline')
				.autoReadHidden
		).toBe(true);
		expect(displayFilterStore.setSection('timeline', hideCalls)).toBe(
			false
		);
		expect(displayFilterStore.resetSection('timeline')).toBe(false);
		expect(
			displayFilterStore.setGlobal('timeline', {
				kinds: {},
				autoReadHidden: false
			})
		).toBe(false);
		expect(client.setAccountData).not.toHaveBeenCalled();
	});

	it('supported version with an unknown top-level key → key preserved on write', async () => {
		const client = makeClient('@a:hs', {
			initial: { ...DEFAULT_DISPLAY_FILTERS, futureKey: { x: 1 } }
		});
		displayFilterStore.attachClient(client as any);
		displayFilterStore.resetSection('timeline');
		await flush();
		expect(client.stored().futureKey).toEqual({ x: 1 });
		expect(client.stored().version).toBe(DISPLAY_FILTERS_VERSION);
	});

	it('applies a record synced in from another device', () => {
		const client = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS
		});
		displayFilterStore.attachClient(client as any);
		const listener = vi.fn();
		displayFilterStore.subscribe(listener);
		client.emitAccountData(
			DISPLAY_FILTERS_EVENT_TYPE,
			v1With({ requests: hideCalls })
		);
		expect(listener).toHaveBeenCalled();
		expect(displayFilterStore.getState().filters.sections.requests).toEqual(
			hideCalls
		);
	});
});

describe('display-filter store — detach and logout hygiene (rule 5)', () => {
	beforeEach(() => {
		displayFilterStore.resetForTests();
		localStorage.clear();
	});

	it('A customises → detach → mirror gone → B with no event gets defaults, nothing of A written', async () => {
		const a = makeClient('@a:hs', { initial: DEFAULT_DISPLAY_FILTERS });
		displayFilterStore.attachClient(a as any);
		displayFilterStore.setSection('timeline', hideCalls);
		await flush();
		expect(localStorage.getItem(mirrorKey('@a:hs'))).not.toBeNull();

		displayFilterStore.detachClient();
		expect(localStorage.getItem(mirrorKey('@a:hs'))).toBeNull();
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);

		const b = makeClient('@b:hs');
		displayFilterStore.attachClient(b as any);
		await flush();
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		expect(b.stored()).toEqual(DEFAULT_DISPLAY_FILTERS);
	});

	it('write pending at logout: completion is ignored, mirror stays absent, B gets defaults', async () => {
		const a = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS,
			deferWrites: true
		});
		displayFilterStore.attachClient(a as any);
		displayFilterStore.setSection('timeline', hideCalls);
		displayFilterStore.detachClient();
		a.pending.shift()!();
		await flush();
		expect(localStorage.getItem(mirrorKey('@a:hs'))).toBeNull();
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);

		const b = makeClient('@b:hs');
		displayFilterStore.attachClient(b as any);
		await flush();
		expect(b.stored()).toEqual(DEFAULT_DISPLAY_FILTERS);
	});

	it('another tab removes the mirror key: pending write ignored, defaults, no key recreated', async () => {
		const a = makeClient('@a:hs', {
			initial: DEFAULT_DISPLAY_FILTERS,
			deferWrites: true
		});
		displayFilterStore.attachClient(a as any);
		displayFilterStore.setSection('timeline', hideCalls);
		localStorage.removeItem(mirrorKey('@a:hs'));
		window.dispatchEvent(
			new StorageEvent('storage', {
				key: mirrorKey('@a:hs'),
				newValue: null
			})
		);
		expect(displayFilterStore.getState().filters).toEqual(
			DEFAULT_DISPLAY_FILTERS
		);
		a.pending.shift()!();
		await flush();
		expect(localStorage.getItem(mirrorKey('@a:hs'))).toBeNull();
	});

	it("detach removes exactly the detached user's key", () => {
		localStorage.setItem(mirrorKey('@other:hs'), '{"version":1}');
		const a = makeClient('@a:hs', { initial: DEFAULT_DISPLAY_FILTERS });
		displayFilterStore.attachClient(a as any);
		displayFilterStore.detachClient();
		expect(localStorage.getItem(mirrorKey('@a:hs'))).toBeNull();
		expect(localStorage.getItem(mirrorKey('@other:hs'))).not.toBeNull();
	});
});
