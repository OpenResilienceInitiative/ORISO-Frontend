// @vitest-environment jsdom
/**
 * Unread axis (#1147) — the "unread" toolbar chip.
 *
 * The chip must match sessions whose Matrix room has unread notifications.
 * It previously read the DTO's `messagesRead`, which the backend hard-codes
 * to `true`, so the chip could never match anything.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { sessionMatchesToolbar } from './sessionToolbarFilters';

const seedRoom = (unreadCount: number | null) => {
	setMatrixClientServiceRef({
		getRoom: () =>
			unreadCount === null
				? null
				: { getUnreadNotificationCount: () => unreadCount }
	} as any);
};

const rawSession = {
	session: {
		id: 1,
		matrixRoomId: '!room:hs',
		// What the backend actually sends — a hard-coded constant.
		messagesRead: true
	}
} as any;

const extendedSession = {
	isGroup: false,
	item: rawSession.session
} as any;

const matchesUnreadChip = () =>
	sessionMatchesToolbar(rawSession, extendedSession, '', 'unread', [], []);

describe('sessionMatchesToolbar — unread chip', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('matches a session whose Matrix room has unread notifications', () => {
		seedRoom(4);

		expect(matchesUnreadChip()).toBe(true);
	});

	it('does not match a session whose Matrix room is fully read', () => {
		seedRoom(0);

		expect(matchesUnreadChip()).toBe(false);
	});

	it('does not match while the Matrix room is not available', () => {
		seedRoom(null);

		expect(matchesUnreadChip()).toBe(false);
	});
});
