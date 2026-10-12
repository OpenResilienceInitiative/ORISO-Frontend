import { describe, expect, it } from 'vitest';
import { resolveLiveChatRailTarget } from './liveChatRailTarget';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';

const liveChat = (id: number, roomId: string) =>
	({
		session: {
			id,
			registrationType: 'ANONYMOUS',
			matrixRoomId: roomId
		},
		user: { username: `Anonymous-${id}` }
	}) as unknown as ListItemInterface;

const registered = () =>
	({
		session: { id: 7, registrationType: 'REGISTERED', postcode: '50667' },
		user: { username: 'lisa' }
	}) as unknown as ListItemInterface;

describe('rail live-chat button target (Frank 2026-09-16, Variante 1)', () => {
	it('turning on without an open live chat goes to the queue with the chip active, as before', () => {
		expect(
			resolveLiveChatRailTarget({
				nextActive: true,
				sessions: [registered()]
			})
		).toBe('/sessions/consultant/sessionPreview?chip=liveChat');
	});

	it('turning on while a live chat is open brings the consultant back into that conversation', () => {
		expect(
			resolveLiveChatRailTarget({
				nextActive: true,
				sessions: [registered(), liveChat(4711, '!live:oriso')]
			})
		).toBe('/sessions/consultant/sessionView/!live%3Aoriso/4711');
	});

	it('picks the first open live chat when there are several', () => {
		expect(
			resolveLiveChatRailTarget({
				nextActive: true,
				sessions: [liveChat(1, '!a:oriso'), liveChat(2, '!b:oriso')]
			})
		).toBe('/sessions/consultant/sessionView/!a%3Aoriso/1');
	});

	it('turning off never navigates', () => {
		expect(
			resolveLiveChatRailTarget({
				nextActive: false,
				sessions: [liveChat(4711, '!live:oriso')]
			})
		).toBeNull();
	});
});
