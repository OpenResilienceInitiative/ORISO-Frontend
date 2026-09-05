import { describe, expect, it } from 'vitest';
import {
	INITIAL_SUPERVISION_PANEL_STATE,
	SupervisionPanelState,
	countUnreadSideRoomMessages,
	excludeSideRoomMessages,
	findUnseenMessages,
	lastSideRoomSnippet,
	readCollapsedPreference,
	readMiniPosition,
	readSecondaryWidth,
	reduceSupervisionPanel,
	writeCollapsedPreference,
	writeMiniPosition,
	writeSecondaryWidth
} from './supervisionPanelState';

const NOW = 1_700_000_000_000;

const resolved = (rememberedCollapsed = false): SupervisionPanelState =>
	reduceSupervisionPanel(INITIAL_SUPERVISION_PANEL_STATE, {
		type: 'ROOM_RESOLVED',
		rememberedCollapsed,
		now: NOW
	});

describe('reduceSupervisionPanel (WP-B2 state machine)', () => {
	it('opens expanded when the side room resolves and nothing is remembered', () => {
		const state = resolved();
		expect(state.status).toBe('expanded');
		expect(state.lastExpandedAt).toBe(NOW);
		expect(state.hasNewMessage).toBe(false);
	});

	it('respects a remembered collapsed state per session', () => {
		expect(resolved(true).status).toBe('collapsed');
	});

	it('ignores ROOM_RESOLVED once the panel is already visible', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		const again = reduceSupervisionPanel(collapsed, {
			type: 'ROOM_RESOLVED',
			rememberedCollapsed: false,
			now: NOW + 1
		});
		expect(again).toBe(collapsed);
	});

	it('goes back to hidden when the side room is gone', () => {
		expect(
			reduceSupervisionPanel(resolved(), { type: 'ROOM_LOST' })
		).toEqual(INITIAL_SUPERVISION_PANEL_STATE);
	});

	it('does nothing while hidden except ROOM_RESOLVED', () => {
		const hidden = INITIAL_SUPERVISION_PANEL_STATE;
		expect(
			reduceSupervisionPanel(hidden, { type: 'EXPAND', now: NOW })
		).toBe(hidden);
		expect(reduceSupervisionPanel(hidden, { type: 'COLLAPSE' })).toBe(
			hidden
		);
		expect(
			reduceSupervisionPanel(hidden, {
				type: 'INCOMING',
				layout: 'desktop',
				isOwn: false,
				now: NOW
			})
		).toBe(hidden);
	});

	it('collapse then expand resets unread bookkeeping', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		expect(collapsed.status).toBe('collapsed');
		const reopened = reduceSupervisionPanel(collapsed, {
			type: 'EXPAND',
			now: NOW + 5000
		});
		expect(reopened.status).toBe('expanded');
		expect(reopened.lastExpandedAt).toBe(NOW + 5000);
		expect(reopened.hasNewMessage).toBe(false);
	});

	it('re-expands on desktop when a foreign side-room message arrives while collapsed', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		const next = reduceSupervisionPanel(collapsed, {
			type: 'INCOMING',
			layout: 'desktop',
			isOwn: false,
			now: NOW + 10
		});
		expect(next.status).toBe('expanded');
		expect(next.lastExpandedAt).toBe(NOW + 10);
	});

	it('only pulses on phone when a foreign side-room message arrives while collapsed', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		const next = reduceSupervisionPanel(collapsed, {
			type: 'INCOMING',
			layout: 'phone',
			isOwn: false,
			now: NOW + 10
		});
		expect(next.status).toBe('collapsed');
		expect(next.hasNewMessage).toBe(true);
	});

	it('ignores own messages and messages arriving while expanded', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		expect(
			reduceSupervisionPanel(collapsed, {
				type: 'INCOMING',
				layout: 'desktop',
				isOwn: true,
				now: NOW
			})
		).toBe(collapsed);
		const open = resolved();
		expect(
			reduceSupervisionPanel(open, {
				type: 'INCOMING',
				layout: 'desktop',
				isOwn: false,
				now: NOW
			})
		).toBe(open);
	});

	it('yields the side slot to a thread and takes it back when the thread closes', () => {
		const yielded = reduceSupervisionPanel(resolved(), {
			type: 'THREAD_OPENED'
		});
		expect(yielded.status).toBe('collapsed');
		expect(yielded.yieldedToThread).toBe(true);

		// A message while the thread holds the slot must not steal it back.
		const pulsed = reduceSupervisionPanel(yielded, {
			type: 'INCOMING',
			layout: 'desktop',
			isOwn: false,
			now: NOW + 1
		});
		expect(pulsed.status).toBe('collapsed');
		expect(pulsed.hasNewMessage).toBe(true);

		const restored = reduceSupervisionPanel(pulsed, {
			type: 'THREAD_CLOSED',
			now: NOW + 2
		});
		expect(restored.status).toBe('expanded');
		expect(restored.yieldedToThread).toBe(false);
		expect(restored.hasNewMessage).toBe(false);
	});

	it('does not re-expand after a thread closes when the user collapsed it themselves', () => {
		const collapsed = reduceSupervisionPanel(resolved(), {
			type: 'COLLAPSE'
		});
		expect(
			reduceSupervisionPanel(collapsed, {
				type: 'THREAD_CLOSED',
				now: NOW
			})
		).toBe(collapsed);
		// THREAD_OPENED on an already collapsed panel keeps the user's choice.
		expect(
			reduceSupervisionPanel(collapsed, { type: 'THREAD_OPENED' })
				.yieldedToThread
		).toBe(false);
	});
});

describe('countUnreadSideRoomMessages', () => {
	const isOwn = (userId: string) => userId === '@me:matrix';
	const messages = [
		{ _id: 'a', messageTime: String(NOW - 10), userId: '@sup:matrix' },
		{ _id: 'b', messageTime: String(NOW + 10), userId: '@sup:matrix' },
		{ _id: 'c', messageTime: String(NOW + 20), userId: '@me:matrix' },
		{ _id: 'd', messageTime: String(NOW + 30), userId: '@sup:matrix' }
	];

	it('counts foreign messages newer than the last expansion', () => {
		expect(
			countUnreadSideRoomMessages(
				messages,
				{ status: 'collapsed', lastExpandedAt: NOW },
				isOwn
			)
		).toBe(2);
	});

	it('is 0 while expanded and for empty input', () => {
		expect(
			countUnreadSideRoomMessages(
				messages,
				{ status: 'expanded', lastExpandedAt: 0 },
				isOwn
			)
		).toBe(0);
		expect(
			countUnreadSideRoomMessages(
				undefined,
				{ status: 'collapsed', lastExpandedAt: 0 },
				isOwn
			)
		).toBe(0);
	});

	it('treats unparsable timestamps as old', () => {
		expect(
			countUnreadSideRoomMessages(
				[{ _id: 'x', messageTime: 'nope', userId: '@sup:matrix' }],
				{ status: 'collapsed', lastExpandedAt: 0 },
				isOwn
			)
		).toBe(0);
	});
});

describe('excludeSideRoomMessages (client timeline safety net)', () => {
	const items = [
		{ _id: '1', rid: '!client:matrix' },
		{ _id: '2', rid: '!side:matrix' },
		{ _id: '3' }
	];

	it('drops every item stamped with the side room id', () => {
		expect(
			excludeSideRoomMessages(items, '!side:matrix').map((m) => m._id)
		).toEqual(['1', '3']);
	});

	it('keeps everything when there is no side room', () => {
		expect(excludeSideRoomMessages(items, undefined)).toHaveLength(3);
		expect(excludeSideRoomMessages(null, '!side:matrix')).toEqual([]);
	});
});

describe('findUnseenMessages / lastSideRoomSnippet', () => {
	it('returns only ids not seen before', () => {
		const known = new Set(['a']);
		expect(
			findUnseenMessages([{ _id: 'a' }, { _id: 'b' }], known).map(
				(m) => m._id
			)
		).toEqual(['b']);
	});

	it('strips markup and collapses whitespace for the snippet', () => {
		expect(
			lastSideRoomSnippet([
				{ message: 'first' },
				{ message: '<p>Bitte  nochmal\n<b>nachfragen</b></p>' }
			])
		).toBe('Bitte nochmal nachfragen');
		expect(lastSideRoomSnippet([])).toBeUndefined();
	});
});

describe('persistence helpers', () => {
	const memory = () => {
		const map = new Map<string, string>();
		return {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
			}
		};
	};

	it('remembers the collapsed flag per session', () => {
		const storage = memory();
		expect(readCollapsedPreference(storage, 42)).toBe(false);
		writeCollapsedPreference(storage, 42, true);
		expect(readCollapsedPreference(storage, 42)).toBe(true);
		expect(readCollapsedPreference(storage, 43)).toBe(false);
		writeCollapsedPreference(storage, 42, false);
		expect(readCollapsedPreference(storage, 42)).toBe(false);
	});

	it('remembers the secondary width per user with a fallback', () => {
		const storage = memory();
		expect(readSecondaryWidth(storage, 'u1', 420)).toBe(420);
		writeSecondaryWidth(storage, 'u1', 512.4);
		expect(readSecondaryWidth(storage, 'u1', 420)).toBe(512);
		expect(readSecondaryWidth(storage, 'u2', 420)).toBe(420);
	});

	it('round-trips the mini position and rejects garbage', () => {
		const storage = memory();
		expect(readMiniPosition(storage, 'u1')).toBeNull();
		writeMiniPosition(storage, 'u1', { right: 24, bottom: 96 });
		expect(readMiniPosition(storage, 'u1')).toEqual({
			right: 24,
			bottom: 96
		});
		storage.setItem('supervisionPanel.mini.u1', '{broken');
		expect(readMiniPosition(storage, 'u1')).toBeNull();
	});

	it('survives a throwing storage', () => {
		const broken = {
			getItem: () => {
				throw new Error('disabled');
			},
			setItem: () => {
				throw new Error('disabled');
			}
		};
		expect(() => writeCollapsedPreference(broken, 1, true)).not.toThrow();
		expect(readCollapsedPreference(broken, 1)).toBe(false);
		expect(readSecondaryWidth(broken, 1, 420)).toBe(420);
	});
});
