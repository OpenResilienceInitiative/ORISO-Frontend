// @vitest-environment jsdom
/**
 * FE#514 — the message-event producer carries team-discussion metadata
 * (teamDiscussion flag + mentionedUserIds) so the backend hybrid fan-out
 * (US#473) can route it. Never any message content (FE-H01 privacy boundary).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiPostMessageEventNotification,
	buildMessageEventNotificationBody
} from './apiPostMessageEventNotification';

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

	it('carries the matrix event id for backend deduplication (#942)', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!room:oriso',
			matrixRoom: true,
			matrixEventId: '$evt-42'
		});

		expect(body.matrixEventId).toBe('$evt-42');
	});

	it('defaults the matrix event id to null (legacy callers)', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!room:oriso',
			matrixRoom: true
		});

		expect(body.matrixEventId).toBeNull();
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

describe('explicit protected feedback intent', () => {
	it('carries only an explicit Matrix feedback hint without private previews', () => {
		const body = buildMessageEventNotificationBody({
			roomId: '!protected:example.org',
			matrixEventId: '$feedback',
			feedbackMailIntent: true,
			messagePreview: 'private feedback',
			threadParentPreview: 'private case'
		});
		expect(body.feedbackMailIntent).toBe(true);
		expect(body.messagePreview).toBe('');
		expect(body.threadParentPreview).toBeNull();
	});
	it('does not infer intent from supervisor or room metadata', () => {
		expect(
			buildMessageEventNotificationBody({
				roomId: '!protected:example.org',
				supervisorMessage: true
			}).feedbackMailIntent
		).toBe(false);
	});
	it('keeps legacy non-Matrix and team notifications out of feedback', () => {
		for (const extra of [{ matrixRoom: false }, { teamDiscussion: true }]) {
			expect(
				buildMessageEventNotificationBody({
					roomId: '!protected:example.org',
					feedbackMailIntent: true,
					...extra
				}).feedbackMailIntent
			).toBe(false);
		}
	});
});

afterEach(() => vi.unstubAllGlobals());
it('acknowledges the real metadata endpoint HTTP 204 through fetchData', async () => {
	// Match the established fetchData fixture: jsdom and Node AbortSignal differ.
	class TestRequest {
		constructor(
			public url: string,
			public init: RequestInit
		) {}
	}
	vi.stubGlobal('Request', TestRequest);
	const fetch = vi
		.fn()
		.mockResolvedValue(new Response(null, { status: 204 }));
	vi.stubGlobal('fetch', fetch);
	await expect(
		apiPostMessageEventNotification({
			roomId: '!protected:example.org',
			matrixEventId: '$event',
			feedbackMailIntent: true
		})
	).resolves.toEqual({});
	expect(JSON.parse(fetch.mock.calls[0][0].init.body)).toMatchObject({
		feedbackMailIntent: true,
		matrixEventId: '$event'
	});
});
