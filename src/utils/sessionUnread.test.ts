// @vitest-environment jsdom
/**
 * Unread axis (#1147) — client-side unread derivation.
 *
 * The backend hard-codes `messagesRead: true` on every session DTO since the
 * Matrix-native refactor (344ac3ca); read state is owned by the frontend
 * Matrix client. These tests pin the single derivation that feeds the badge,
 * the "unread" chip filter and the chip counter.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { setMatrixClientServiceRef } from '../services/matrixClientRegistry';
import { isChatItemUnread, isRoomUnread } from './sessionUnread';

const serviceWithRoom = (room: unknown) =>
	({
		getRoom: () => room
	}) as any;

describe('isRoomUnread', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('is unread when the Matrix room reports unread notifications', () => {
		setMatrixClientServiceRef(
			serviceWithRoom({ getUnreadNotificationCount: () => 3 })
		);

		expect(isRoomUnread('!room:hs')).toBe(true);
	});

	it('is read when the room reports zero unread notifications', () => {
		setMatrixClientServiceRef(
			serviceWithRoom({ getUnreadNotificationCount: () => 0 })
		);

		expect(isRoomUnread('!room:hs')).toBe(false);
	});

	it('is read while the Matrix client is not available yet', () => {
		setMatrixClientServiceRef(null);

		expect(isRoomUnread('!room:hs')).toBe(false);
	});

	it('is read when the room is not (yet) known to the client', () => {
		setMatrixClientServiceRef(serviceWithRoom(null));

		expect(isRoomUnread('!room:hs')).toBe(false);
	});

	it('is read for sessions without a Matrix room id', () => {
		setMatrixClientServiceRef(
			serviceWithRoom({ getUnreadNotificationCount: () => 5 })
		);

		expect(isRoomUnread(undefined)).toBe(false);
		expect(isRoomUnread(null)).toBe(false);
		expect(isRoomUnread('')).toBe(false);
	});
});

describe('isChatItemUnread', () => {
	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('derives unread from the Matrix room even when the DTO claims messagesRead', () => {
		setMatrixClientServiceRef(
			serviceWithRoom({ getUnreadNotificationCount: () => 1 })
		);

		// The backend hard-codes messagesRead: true — it must be ignored.
		expect(
			isChatItemUnread({
				matrixRoomId: '!room:hs',
				messagesRead: true
			} as any)
		).toBe(true);
	});
});
