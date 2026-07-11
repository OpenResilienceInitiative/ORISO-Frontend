import { describe, expect, it } from 'vitest';
import {
	canModerateGroupChat,
	isV2GroupChatSession,
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

	it('never treats two missing identifiers as an owner match', () => {
		expect(
			canModerateGroupChat(
				{ consultant: {}, item: { moderators: [] } },
				{}
			)
		).toBe(false);
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

	it('keeps a banned member on the join view', () => {
		expect(
			shouldShowGroupChatJoinView({
				isGroup: true,
				active: true,
				subscribed: true,
				isBanned: true
			})
		).toBe(true);
	});

	it('never applies the group join view to a non-group session', () => {
		expect(
			shouldShowGroupChatJoinView({
				isGroup: false,
				active: false,
				subscribed: false,
				isBanned: true
			})
		).toBe(false);
	});
});

describe('isV2GroupChatSession', () => {
	it('recognizes a self-help Series even when consultingType is present', () => {
		expect(
			isV2GroupChatSession({
				isGroup: true,
				item: { modality: 'TEXT', consultingType: 1 }
			})
		).toBe(true);
	});
});
