// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	announceNotificationEvent,
	selectUnseenEvents
} from './announceNotificationEvent';
import { getEventDescriptor } from '../components/notificationsCenter/eventDescriptors';
import { sendNotification } from './notificationHelpers';
import { playNotificationSound } from './notificationSettings/soundPlayback';

vi.mock('./notificationHelpers', () => ({ sendNotification: vi.fn() }));
vi.mock('./notificationSettings/soundPlayback', () => ({
	playNotificationSound: vi.fn()
}));

const event = {
	id: '42',
	eventType: 'message.new',
	params: { roomRef: '!room:server', senderName: 'private name' },
	sourceSessionId: '73',
	title: 'private title',
	text: 'private message'
};
const translate = (key: string) => key;
beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState({}, '', '/notifications');
	vi.spyOn(document, 'hasFocus').mockReturnValue(false);
});

describe('event announcement', () => {
	it('uses the descriptor title without exposing server text or sender metadata', () => {
		announceNotificationEvent(event, translate, true);
		expect(sendNotification).toHaveBeenCalledWith(
			getEventDescriptor(event.eventType).titleTemplate,
			expect.objectContaining({
				family: 'messages',
				eventType: 'message.new',
				silent: true
			})
		);
		expect(
			JSON.stringify(vi.mocked(sendNotification).mock.calls)
		).not.toContain('private');
		expect(playNotificationSound).toHaveBeenCalledTimes(1);
	});
	it('keeps the focused conversation quiet without dropping its timeline event', () => {
		vi.spyOn(document, 'hasFocus').mockReturnValue(true);
		window.history.replaceState(
			{},
			'',
			'/sessions/user/view/%21room%3Aserver/73'
		);
		announceNotificationEvent(event, translate, true);
		expect(sendNotification).not.toHaveBeenCalled();
		expect(playNotificationSound).not.toHaveBeenCalled();
	});
	it('allows the same conversation to announce when the browser is unfocused', () => {
		window.history.replaceState(
			{},
			'',
			'/sessions/user/view/%21room%3Aserver/73'
		);
		announceNotificationEvent(event, translate, true);
		expect(sendNotification).toHaveBeenCalledTimes(1);
	});
	it('leaves browser delivery to legacy callers with the release toggle off', () => {
		announceNotificationEvent(event, translate, false);
		expect(sendNotification).not.toHaveBeenCalled();
		expect(playNotificationSound).toHaveBeenCalledTimes(1);
	});
	it('classifies first responses as messages with a conversation target', () => {
		const descriptor = getEventDescriptor('first_response.received');
		expect(descriptor.family).toBe('messages');
		expect(descriptor.category).toBe('message');
		expect(
			descriptor.resolveActionTarget({
				actionPath: '/sessions/user/view/73'
			})
		).toEqual({ kind: 'conversation', path: '/sessions/user/view/73' });
	});
	it('classifies the existing conversation-finished event and resolves its session', () => {
		const descriptor = getEventDescriptor('conversation.finished');
		expect(descriptor.family).toBe('messages');
		expect(descriptor.category).toBe('system');
		expect(
			descriptor.resolveActionTarget({
				sourceSessionId: 73,
				sessionsBasePath: '/sessions/consultant/sessionView'
			})
		).toEqual({
			kind: 'conversation',
			path: '/sessions/consultant/sessionView/session/73'
		});
	});
});

describe('batched event selection', () => {
	const feed = [
		{ id: '3', readAt: null },
		{ id: '2', readAt: null },
		{ id: '1', readAt: null }
	];
	it('seeds the initial backlog silently', () =>
		expect(selectUnseenEvents(feed, null)).toEqual([]));
	it('announces every newly arrived unread event, oldest first', () =>
		expect(selectUnseenEvents(feed, new Set(['1']))).toEqual([
			feed[1],
			feed[0]
		]));
	it('does not replay existing events or already-read arrivals', () =>
		expect(
			selectUnseenEvents(
				[{ id: '4', readAt: 'now' }, ...feed],
				new Set(['1', '2', '3'])
			)
		).toEqual([]));
});
