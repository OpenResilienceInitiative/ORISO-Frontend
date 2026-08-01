import { describe, expect, it } from 'vitest';
import { getNextNotificationId } from './notificationQueue';

const item = (id: string, read = false) => ({
	id,
	readAt: read ? '2026-08-01T10:00:00Z' : null
});

describe('getNextNotificationId (#845)', () => {
	it('returns null for an empty feed', () => {
		expect(getNextNotificationId([], null, true)).toBeNull();
	});

	it('advances to the next unread item after the anchor', () => {
		const feed = [item('a', true), item('b'), item('c')];
		expect(getNextNotificationId(feed, 'b', true)).toBe('c');
	});

	it('wraps around to unread items before the anchor', () => {
		const feed = [item('a'), item('b', true), item('c', true)];
		expect(getNextNotificationId(feed, 'c', true)).toBe('a');
	});

	it('NEVER returns the anchor itself on wrap-around (the dead-button bug)', () => {
		// Only the anchor is unread: the old inclusive wrap returned it,
		// which read as "the button works once and then stops".
		const feed = [item('a'), item('b', true), item('c', true)];
		expect(getNextNotificationId(feed, 'a', true)).toBeNull();
	});

	it('returns null when everything else is read', () => {
		const feed = [item('a', true), item('b', true)];
		expect(getNextNotificationId(feed, 'a', true)).toBeNull();
	});

	it('starts from the top without an anchor', () => {
		const feed = [item('a', true), item('b')];
		expect(getNextNotificationId(feed, null, true)).toBe('b');
	});

	it('treats an unknown anchor id like no anchor (feed refresh reshuffled)', () => {
		const feed = [item('a'), item('b')];
		expect(getNextNotificationId(feed, 'gone', true)).toBe('a');
	});

	it('ignores read state when unreadOnly is false', () => {
		const feed = [item('a', true), item('b', true)];
		expect(getNextNotificationId(feed, 'a', false)).toBe('b');
	});
});
