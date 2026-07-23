// @vitest-environment jsdom
/**
 * FE#514 — the message-event producer carries team-discussion metadata
 * (teamDiscussion flag + mentionedUserIds) so the backend hybrid fan-out
 * (US#473) can route it. Never any message content (FE-H01 privacy boundary).
 */
import { describe, expect, it } from 'vitest';
import { buildMessageEventNotificationBody } from './apiPostMessageEventNotification';

describe('buildMessageEventNotificationBody', () => {
	it('carries the teamDiscussion flag and mentioned user ids', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!discussion:oriso',
			matrixRoom: true,
			teamDiscussion: true,
			mentionedUserIds: ['consultant-a', 'consultant-b'],
			senderDisplayName: 'Kim'
		});

		expect(body.teamDiscussion).toBe(true);
		expect(body.mentionedUserIds).toEqual(['consultant-a', 'consultant-b']);
		expect(body.senderDisplayName).toBe('Kim');
	});

	it('defaults teamDiscussion to false and mentions to null', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!room:oriso',
			matrixRoom: true
		});

		expect(body.teamDiscussion).toBe(false);
		expect(body.mentionedUserIds).toBeNull();
	});

	it('never includes plaintext previews for matrix rooms, also for team discussions', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!discussion:oriso',
			matrixRoom: true,
			teamDiscussion: true,
			messagePreview: 'secret case detail'
		});

		expect(body.messagePreview).toBe('');
	});
});
