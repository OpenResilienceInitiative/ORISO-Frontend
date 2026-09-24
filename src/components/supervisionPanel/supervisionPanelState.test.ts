import { describe, expect, it } from 'vitest';
import {
	countUnreadSideRoomMessages,
	excludeSideRoomMessages,
	findUnseenMessages
} from './supervisionPanelState';

const NOW = 1_700_000_000_000;

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

describe('findUnseenMessages', () => {
	it('returns only ids not seen before', () => {
		const known = new Set(['a']);
		expect(
			findUnseenMessages([{ _id: 'a' }, { _id: 'b' }], known).map(
				(m) => m._id
			)
		).toEqual(['b']);
	});
});
