import { describe, expect, it } from 'vitest';
import {
	activityEventCategory,
	activityEventConversation,
	activityEventRoomId,
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
});
