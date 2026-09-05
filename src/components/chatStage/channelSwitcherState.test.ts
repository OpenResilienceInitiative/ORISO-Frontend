import { describe, expect, it } from 'vitest';
import {
	deriveChannelSwitcherState,
	resolveChannelLabel,
	type SecondaryChannel
} from './channelSwitcherState';

const supervision: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: 'Bettina B.',
	unread: 0
};
const thread1: SecondaryChannel = {
	id: '$thread-1',
	kind: 'thread',
	label: 'Thread #1',
	unread: 0
};
const thread2: SecondaryChannel = {
	id: '$thread-2',
	kind: 'thread',
	label: 'Thread #2',
	unread: 0
};

describe('deriveChannelSwitcherState (FAB switcher, Figma 9748:60084)', () => {
	it('renders nothing switchable when there is no secondary channel', () => {
		const state = deriveChannelSwitcherState([]);
		expect(state.items).toEqual([]);
		expect(state.mode).toBe('single');
		expect(state.variant).toBe('idle');
		expect(state.totalUnread).toBe(0);
	});

	it('is a single-channel FAB (no menu) with exactly one channel', () => {
		const state = deriveChannelSwitcherState([supervision]);
		expect(state.mode).toBe('single');
		expect(state.items).toHaveLength(1);
		expect(state.items[0]).toMatchObject({
			id: 'supervision',
			kind: 'supervision',
			unread: 0
		});
	});

	it('stays grey (idle) while every secondary channel is read', () => {
		expect(deriveChannelSwitcherState([supervision, thread1]).variant).toBe(
			'idle'
		);
	});

	it('turns to the attention role as soon as any channel has unread messages', () => {
		const state = deriveChannelSwitcherState([
			supervision,
			{ ...thread1, unread: 2 }
		]);
		expect(state.variant).toBe('attention');
		expect(state.totalUnread).toBe(2);
	});

	it('opens a speed-dial menu with two or more channels', () => {
		expect(deriveChannelSwitcherState([supervision, thread1]).mode).toBe(
			'menu'
		);
	});

	it('lists the supervision chat first, then the threads (T20 order, shared with the panel menu)', () => {
		const state = deriveChannelSwitcherState([
			thread1,
			supervision,
			thread2
		]);
		expect(state.items.map((item) => item.id)).toEqual([
			'supervision',
			'$thread-1',
			'$thread-2'
		]);
	});

	it('orders threads by their most recent message, given order without one', () => {
		expect(
			deriveChannelSwitcherState([thread2, thread1]).items.map(
				(item) => item.id
			)
		).toEqual(['$thread-2', '$thread-1']);
		expect(
			deriveChannelSwitcherState([
				{ ...thread2, lastMessage: { author: 'A', text: 'x', ts: 1 } },
				{ ...thread1, lastMessage: { author: 'B', text: 'y', ts: 2 } }
			]).items.map((item) => item.id)
		).toEqual(['$thread-1', '$thread-2']);
	});

	it('clamps negative or missing unread counts to zero', () => {
		const state = deriveChannelSwitcherState([
			{ ...thread1, unread: -3 },
			{ id: 'x', kind: 'supervision', label: 'S' }
		]);
		expect(state.items.map((item) => item.unread)).toEqual([0, 0]);
		expect(state.variant).toBe('idle');
	});

	it('picks the icon of the first channel with attention, else the first item (supervision leads)', () => {
		expect(
			deriveChannelSwitcherState([thread1, supervision]).iconKind
		).toBe('supervision');
		expect(deriveChannelSwitcherState([thread1, thread2]).iconKind).toBe(
			'thread'
		);
		expect(
			deriveChannelSwitcherState([{ ...thread1, unread: 1 }, supervision])
				.iconKind
		).toBe('thread');
	});
});

describe('resolveChannelLabel (open question: topic vs. person name)', () => {
	const channel = {
		kind: 'supervision' as const,
		topic: 'Supervision',
		person: 'Bettina B.'
	};

	it('uses the person name in person mode', () => {
		expect(resolveChannelLabel(channel, 'person')).toBe('Bettina B.');
	});

	it('uses the topic in topic mode', () => {
		expect(resolveChannelLabel(channel, 'topic')).toBe('Supervision');
	});

	it('falls back to whichever is present', () => {
		expect(resolveChannelLabel({ ...channel, person: '' }, 'person')).toBe(
			'Supervision'
		);
		expect(
			resolveChannelLabel({ ...channel, topic: undefined }, 'topic')
		).toBe('Bettina B.');
	});
});
