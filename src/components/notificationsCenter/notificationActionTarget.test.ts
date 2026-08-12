import { describe, expect, it } from 'vitest';
import {
	EVENT_PARAM_KEYS,
	parseEventActionParams,
	resolveNotificationActionPath,
	toInterpolationValues
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

describe('shared params contract (#846)', () => {
	it('accepts the backend message params (sessionId, sender metadata)', () => {
		const params = parseEventActionParams(
			'{"sessionId":100,"roomRef":"!room-1:matrix.example","senderName":"Klient:in","contentClass":"TEXT","recipientRole":"consultant"}'
		);
		expect(params.sourceSessionId).toBe(100);
		expect(params.roomRef).toBe('!room-1:matrix.example');
		expect(params.senderName).toBe('Klient:in');
		expect(params.contentClass).toBe('TEXT');
		expect(params.recipientRole).toBe('consultant');
	});

	it('accepts team-discussion params (roomId as room ref, mentioned flag)', () => {
		const params = parseEventActionParams(
			'{"roomId":"!team:matrix.example","senderDisplayName":"Marge","mentioned":true}'
		);
		expect(params.roomRef).toBe('!team:matrix.example');
		expect(params.senderDisplayName).toBe('Marge');
		expect(params.mentioned).toBe(true);
	});

	it('accepts enquiry params (agency, topic, consulting type)', () => {
		const params = parseEventActionParams(
			'{"sessionId":100,"agencyId":42,"topicId":5,"consultingTypeId":1}'
		);
		expect(params.agencyId).toBe(42);
		expect(params.topicId).toBe(5);
		expect(params.consultingTypeId).toBe(1);
	});

	it('pins the shared key set mirrored by the backend contract test', () => {
		// ORISO-UserService EventNotificationServiceTest
		// .allEmittedParamKeysStayInsideTheSharedFrontendContract pins the
		// identical set — update BOTH sides together.
		//
		// `matrixEventId` is the one key the frontend accepts before the
		// backend emits it (#924 / ORISO-UserService#961). That direction is
		// safe: the backend test asserts every emitted key is *inside* this
		// contract, so a key we accept early cannot break it.
		expect([...EVENT_PARAM_KEYS].sort()).toEqual(
			[
				'sessionId',
				'sourceSessionId',
				'roomRef',
				'roomId',
				'agencyId',
				'topicId',
				'consultingTypeId',
				'senderName',
				'senderDisplayName',
				'contentClass',
				'recipientRole',
				'threadRootId',
				'mentioned',
				'seriesId',
				'occurrenceIndex',
				'start',
				'callRoomId',
				'isVideo',
				'forcedScopeKey',
				'matrixEventId'
			].sort()
		);
	});
});

describe('request-origin deep links (#846)', () => {
	it('routes a room-less waiting-room event to the enquiry list', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'waiting_room.client.joined',
					actionPath: null,
					params: {}
				},
				'/sessions/consultant/sessionView',
				'/sessions/consultant/sessionPreview'
			)
		).toBe('/sessions/consultant/sessionPreview');
	});

	it('keeps a stored enquiry action path authoritative', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'request.new',
					actionPath:
						'/sessions/consultant/sessionPreview/!room-1:matrix.example/100',
					params: {}
				},
				'/sessions/consultant/sessionView',
				'/sessions/consultant/sessionPreview'
			)
		).toBe(
			'/sessions/consultant/sessionPreview/!room-1:matrix.example/100'
		);
	});

	it('still returns null without any request base (no silent sessions-root)', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'request.new',
					actionPath: null,
					params: {}
				},
				'/sessions/consultant/sessionView'
			)
		).toBeNull();
	});
});

describe('interpolation values (#846)', () => {
	it('exposes string/number metadata and falls back senderDisplayName → senderName', () => {
		const values = toInterpolationValues({
			senderName: 'Marge',
			mentioned: true,
			sourceSessionId: 100
		});
		expect(values.senderDisplayName).toBe('Marge');
		expect(values.sourceSessionId).toBe(100);
		expect('mentioned' in values).toBe(false);
	});
});
