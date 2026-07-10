import { describe, expect, it } from 'vitest';
import {
	canModerateGroupChat,
	shouldShowGroupChatJoinView
} from './groupChatHelpers';

describe('canModerateGroupChat', () => {
	it('allows the primary owner and explicitly invited Series moderators only', () => {
		const activeSession = {
			consultant: { id: 'owner' },
			item: { moderators: ['owner', 'co-mod'] }
		};

		expect(canModerateGroupChat(activeSession, { userId: 'owner' })).toBe(
			true
		);
		expect(canModerateGroupChat(activeSession, { userId: 'co-mod' })).toBe(
			true
		);
		expect(
			canModerateGroupChat(activeSession, { userId: 'participant' })
		).toBe(false);
		expect(canModerateGroupChat(activeSession, undefined)).toBe(false);
	});
});

describe('shouldShowGroupChatJoinView', () => {
	it('keeps a subscribed moderator on the start view while the chat is inactive', () => {
		expect(
			shouldShowGroupChatJoinView({
				isGroup: true,
				active: false,
				subscribed: true,
				isBanned: false
			})
		).toBe(true);
	});

	it('opens the stream only for an active subscribed non-banned member', () => {
		expect(
			shouldShowGroupChatJoinView({
				isGroup: true,
				active: true,
				subscribed: true,
				isBanned: false
			})
		).toBe(false);
	});
});
