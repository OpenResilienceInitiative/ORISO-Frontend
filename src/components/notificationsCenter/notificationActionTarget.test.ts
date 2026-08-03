import { describe, expect, it } from 'vitest';
import {
	parseEventActionParams,
	resolveNotificationActionPath
} from './notificationActionTarget';

describe('notification action targets', () => {
	it('opens a group-chat lifecycle event at its stable Series conversation', () => {
		const params = parseEventActionParams(
			'{"seriesId":42,"occurrenceIndex":3,"roomRef":"!room:matrix.example"}'
		);

		expect(
			resolveNotificationActionPath(
				{
					eventType: 'group_chat.opened',
					params
				},
				'/sessions/consultant/sessionView'
			)
		).toBe('/sessions/consultant/sessionView/session/42');
	});

	it('keeps a direct action path authoritative', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'message.new',
					actionPath: '/sessions/user/view/session/7',
					params: { seriesId: 42 }
				},
				'/sessions/consultant/sessionView'
			)
		).toBe('/sessions/user/view/session/7');
	});

	it('treats malformed params as absent instead of breaking the timeline', () => {
		expect(parseEventActionParams('{not-json')).toEqual({});
	});

	it('keeps typed non-content Matrix preview correlation metadata', () => {
		expect(
			parseEventActionParams(
				JSON.stringify({
					matrixEventId: '$event:oriso',
					senderName: 'Lisa',
					contentClass: 'TEXT',
					recipientRole: 'consultant'
				})
			)
		).toMatchObject({
			matrixEventId: '$event:oriso',
			senderName: 'Lisa',
			contentClass: 'TEXT',
			recipientRole: 'consultant'
		});
	});

	it('falls back to the nested source session id when the top-level id is absent', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'message.new',
					params: { sourceSessionId: 7 }
				},
				'/sessions/user/view'
			)
		).toBe('/sessions/user/view/session/7');
	});
});
