import { describe, expect, it } from 'vite-plus/test';
import {
	activityEventCaseHandoverRequestId,
	activityEventCategory,
	activityEventConversation,
	activityEventNamesCaseHandoverRequest,
	activityEventRoomId,
	activityEventRouteSessionId,
	activityEventSessionId,
	describeActivityEvent,
	isMessageActivityEvent
} from './activityEvent';

const row = (overrides: Record<string, unknown> = {}): any => ({
	id: 'a1',
	eventType: 'message.new',
	createdAt: '2026-10-22T10:00:00Z',
	category: 'message',
	...overrides
});

describe('activityEvent (#1824: one place for an activity event’s facts)', () => {
	describe('room', () => {
		it('prefers the room the backend sent', () => {
			expect(
				activityEventRoomId(
					row({
						params: { roomRef: '!sent:x' },
						actionPath:
							'/sessions/consultant/sessionView/!path:x/13'
					})
				)
			).toBe('!sent:x');
		});

		it.each([
			['/sessions/consultant/sessionView/!path:x/13', '!path:x'],
			['/sessions/user/view/%21enc%3Ax/13?channel=thread:$r', '!enc:x']
		])('falls back to the room segment of %s', (actionPath, room) => {
			expect(activityEventRoomId(row({ actionPath }))).toBe(room);
		});

		it('is null without either', () => {
			expect(activityEventRoomId(row())).toBeNull();
		});
	});

	describe('category', () => {
		it('follows the event descriptor for a known type', () => {
			expect(
				activityEventCategory(
					row({ eventType: 'supervisor.added', category: 'message' })
				)
			).toBe('system');
			expect(
				activityEventCategory(
					row({
						eventType: 'team.discussion.new',
						category: 'system'
					})
				)
			).toBe('message');
		});

		it('an unknown type is a message when it says so or points into a thread', () => {
			expect(
				activityEventCategory(
					row({ eventType: 'x.unknown', category: 'message' })
				)
			).toBe('message');
			expect(
				activityEventCategory(
					row({
						eventType: 'x.unknown',
						category: 'system',
						actionPath:
							'/sessions/user/view/!r:x/13?channel=thread:$root'
					})
				)
			).toBe('message');
			expect(
				activityEventCategory(
					row({ eventType: 'x.unknown', category: 'system' })
				)
			).toBe('system');
		});

		it('isMessageActivityEvent matches the category', () => {
			expect(isMessageActivityEvent(row())).toBe(true);
			expect(
				isMessageActivityEvent(row({ eventType: 'supervisor.added' }))
			).toBe(false);
		});
	});

	describe('conversation', () => {
		it('room, session, thread and channel of a message event', () => {
			expect(
				activityEventConversation(
					row({
						params: { roomRef: '!r:x', sourceSessionId: 13 },
						actionPath:
							'/sessions/user/view/!r:x/13?channel=thread:$root'
					})
				)
			).toEqual({
				roomId: '!r:x',
				sessionId: 13,
				channelKind: 'thread',
				threadRootId: '$root'
			});
		});

		it('takes the session from the row before params, never from a series id', () => {
			expect(
				activityEventConversation(
					row({ sourceSessionId: '7', params: { seriesId: 99 } })
				).sessionId
			).toBe(7);
			expect(
				activityEventConversation(row({ params: { seriesId: 99 } }))
					.sessionId
			).toBeNull();
		});

		it('a team discussion event is the team channel', () => {
			expect(
				activityEventConversation(
					row({
						eventType: 'team.discussion.new',
						params: { roomRef: '!team:x', sourceSessionId: 13 },
						actionPath:
							'/sessions/consultant/sessionView/!main:x/13?teamDiscussion=1'
					})
				)
			).toMatchObject({
				roomId: '!team:x',
				sessionId: 13,
				channelKind: 'team'
			});
		});
	});

	it('a malformed stored path yields no room instead of throwing', () => {
		expect(
			activityEventRoomId(
				row({ actionPath: '/sessions/user/view/%21abc%ZZ/13' })
			)
		).toBeNull();
	});

	describe('session (#1888)', () => {
		it('is the counselling session from the row, then params', () => {
			expect(activityEventSessionId(row({ sourceSessionId: '7' }))).toBe(
				7
			);
			expect(
				activityEventSessionId(row({ params: { sourceSessionId: 8 } }))
			).toBe(8);
		});

		it('is never a series id or a guess from the path', () => {
			expect(
				activityEventSessionId(
					row({
						params: { seriesId: 99 },
						actionPath:
							'/sessions/consultant/sessionView/session/99'
					})
				)
			).toBeNull();
		});

		it.each(['', 'abc', '-3', '0', '1.5', '99999999999999999999'])(
			'is null for the unusable id %j',
			(sourceSessionId) => {
				expect(
					activityEventSessionId(row({ sourceSessionId }))
				).toBeNull();
			}
		);
	});

	it('falls back to params when the row’s own session id is unusable', () => {
		expect(
			activityEventSessionId(
				row({ sourceSessionId: '', params: { sourceSessionId: 8 } })
			)
		).toBe(8);
	});

	describe('route session (#1888: what the conversation route carries)', () => {
		it('is the session when there is one', () => {
			expect(
				activityEventRouteSessionId(
					row({ sourceSessionId: 7, params: { seriesId: 99 } })
				)
			).toBe('7');
		});

		it('is the series id a series card navigates to', () => {
			expect(
				activityEventRouteSessionId(row({ params: { seriesId: 99 } }))
			).toBe('99');
		});

		it('falls back to the trailing id of the stored path', () => {
			expect(
				activityEventRouteSessionId(
					row({
						actionPath:
							'/sessions/consultant/sessionView/!r:x/13?channel=team'
					})
				)
			).toBe('13');
			expect(activityEventRouteSessionId(row())).toBeNull();
		});
	});

	describe('case-handover request (#1888)', () => {
		it('prefers the id the backend sent', () => {
			expect(
				activityEventCaseHandoverRequestId(
					row({
						params: { caseHandoverRequestId: '5' },
						actionPath:
							'/sessions/user/view/!r:x/13?caseHandoverRequestId=6'
					})
				)
			).toBe(5);
		});

		it('falls back to the query of the stored path', () => {
			expect(
				activityEventCaseHandoverRequestId(
					row({
						actionPath:
							'/sessions/user/view/!r:x/13?channel=main&caseHandoverRequestId=6'
					})
				)
			).toBe(6);
		});

		it.each([
			[{}],
			[{ actionPath: '/sessions/user/view/!r:x/13' }],
			[
				{
					actionPath:
						'/sessions/user/view/!r:x/13?caseHandoverRequestId=x'
				}
			],
			[{ params: { caseHandoverRequestId: '1e3' } }]
		])('is null without a usable id (%j)', (overrides) => {
			expect(
				activityEventCaseHandoverRequestId(row(overrides))
			).toBeNull();
		});
	});

	describe('names a case-handover request', () => {
		it.each([
			[{ params: { caseHandoverRequestId: 5 } }, true],
			[{ params: { caseHandoverRequestId: 'abc' } }, true],
			[{ actionPath: '/x/13?caseHandoverRequestId=0' }, true],
			[{ params: { caseHandoverRequestId: '' } }, false],
			[{ actionPath: '/x/13' }, false]
		])('%j → %s', (overrides, names) => {
			expect(activityEventNamesCaseHandoverRequest(row(overrides))).toBe(
				names
			);
		});
	});

	describe('display (#1888)', () => {
		// An untranslated key renders its defaultValue, as with i18next.
		const translate = (key: string, options?: Record<string, unknown>) =>
			String(
				options?.defaultValue ||
					`${key}:${options?.senderDisplayName ?? ''}`
			);

		it('renders the descriptor templates with the params', () => {
			const { descriptor, title } = describeActivityEvent(
				row({ params: { senderDisplayName: 'Lisa' } }),
				translate,
				'de'
			);
			expect(descriptor.eventType).toBe('message.new');
			expect(title).toContain('Lisa');
		});

		it('falls back to the server text while a template is untranslated', () => {
			expect(
				describeActivityEvent(
					row({ eventType: 'legacy.thing', title: 'T', text: 'X' }),
					translate
				)
			).toMatchObject({ title: 'T', text: 'X' });
		});
	});
});
