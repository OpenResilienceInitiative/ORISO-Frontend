import { describe, expect, it } from 'vitest';
import {
	canModerateGroupChat,
	getGroupChatWaitingAreaVisibility,
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

describe('getGroupChatWaitingAreaVisibility', () => {
	const plannedStart = new Date('2026-08-08T10:00:00.000Z');

	it('hides countdown, rules and headline for an internal team chat (#979)', () => {
		// No repeatCount/repetitive and no explicit conversationType — the
		// fallback in getModality resolves this to INTERNAL_GROUP.
		const internalTeamChat = {
			isGroup: true,
			item: { id: 1, topic: 'Absprachen' }
		} as any;

		expect(
			getGroupChatWaitingAreaVisibility(internalTeamChat, plannedStart)
		).toEqual({
			showCountdown: false,
			showRules: false,
			showRulesHeadline: false
		});
	});

	it('hides the waiting area for an explicitly typed internal team chat', () => {
		const internalTeamChat = {
			isGroup: true,
			item: { id: 1, conversationType: 'INTERNAL_GROUP', repetitive: true }
		} as any;

		expect(
			getGroupChatWaitingAreaVisibility(internalTeamChat, plannedStart)
				.showCountdown
		).toBe(false);
	});

	it('keeps the countdown for a scheduled self-help group chat', () => {
		const selfHelpChat = {
			isGroup: true,
			item: { id: 1, repetitive: true }
		} as any;

		expect(
			getGroupChatWaitingAreaVisibility(selfHelpChat, plannedStart)
		).toEqual({
			showCountdown: true,
			showRules: true,
			// The countdown brings its own headline.
			showRulesHeadline: false
		});
	});

	it('falls back to the rules headline when a self-help chat has no planned start', () => {
		const selfHelpChat = {
			isGroup: true,
			item: { id: 1, repeatCount: 0 }
		} as any;

		expect(getGroupChatWaitingAreaVisibility(selfHelpChat, null)).toEqual({
			showCountdown: false,
			showRules: true,
			showRulesHeadline: true
		});
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
