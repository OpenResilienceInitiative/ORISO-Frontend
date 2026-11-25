// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { answerOrKnock } from './answerOrKnock';
import {
	directLinkSessionIdOfRoom,
	isKnockingOnCall,
	readPendingKnock,
	rememberDirectLinkSession
} from './directLinkEntryFlow';
import { admissionAction, takeAdmittedJoin } from './callMessageKnock';
import type { CallData } from '../../services/CallManager';

vi.mock('../registration/autoLogin', () => ({ redirectToApp: vi.fn() }));

const ROOM = '!room:oriso';
const ringing = {
	callId: 'call-1',
	roomId: '!call:oriso',
	signalRoomId: ROOM,
	isIncoming: true,
	state: 'ringing'
} as unknown as CallData;

const manager = (current: CallData | null = ringing) => ({
	getCurrentCall: vi.fn(() => current),
	answerCall: vi.fn()
});

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
});

describe('directLinkSessionIdOfRoom', () => {
	it('finds the conversation of an audio or video direct link by its room', () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		expect(directLinkSessionIdOfRoom([undefined, ROOM])).toBe(9);
		expect(directLinkSessionIdOfRoom(['!other:oriso'])).toBeNull();
		expect(directLinkSessionIdOfRoom([null, undefined])).toBeNull();
	});
});

describe('answerOrKnock ("Annehmen")', () => {
	it('answers at once for a counsellor', async () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		const calls = manager();
		const mine = vi.fn();
		await expect(
			answerOrKnock(ringing, calls, { asker: false, mine })
		).resolves.toBe('joined');
		expect(calls.answerCall).toHaveBeenCalledTimes(1);
		expect(mine).not.toHaveBeenCalled();
	});

	it('answers at once in a conversation without a direct link', async () => {
		const calls = manager();
		const mine = vi.fn();
		await expect(
			answerOrKnock(ringing, calls, { asker: true, mine })
		).resolves.toBe('joined');
		expect(calls.answerCall).toHaveBeenCalledTimes(1);
		expect(mine).not.toHaveBeenCalled();
	});

	it('answers once the counsellor let the person in', async () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		const calls = manager();
		const mine = vi
			.fn()
			.mockResolvedValue({ id: 31, medium: 'VIDEO', status: 'ADMITTED' });
		await expect(
			answerOrKnock(ringing, calls, { asker: true, mine })
		).resolves.toBe('joined');
		expect(mine).toHaveBeenCalledWith(9);
		expect(calls.answerCall).toHaveBeenCalledTimes(1);
	});

	it('waits in the lobby instead of opening a refused call while the knock is pending', async () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		const calls = manager();
		const mine = vi
			.fn()
			.mockResolvedValue({ id: 31, medium: 'VIDEO', status: 'PENDING' });
		await answerOrKnock(ringing, calls, { asker: true, mine });
		// No call window: the media server would answer 403.
		expect(calls.answerCall).not.toHaveBeenCalled();
		// The knock is on record with its room, so the ringing card gives way.
		const pending = readPendingKnock();
		expect(pending).toMatchObject({ knockId: 31, sessionId: 9 });
		expect(isKnockingOnCall(pending, [ROOM])).toBe(true);
		// The call is on record too: a reloaded waiting tab still joins it.
		expect(pending?.joinCall).toMatchObject({
			callId: 'call-1',
			roomRef: ROOM,
			callRoomId: '!call:oriso',
			state: 'running',
			isGroup: false
		});
		expect(admissionAction(pending!, undefined)).toBe('joinRunningCall');
		// Let in: the stored join answers the call that still rings.
		takeAdmittedJoin(9)?.();
		expect(calls.answerCall).toHaveBeenCalledTimes(1);
	});

	it('joins the running call when the person is let in after the ringing stopped', async () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		let current: CallData | null = ringing;
		const calls = {
			getCurrentCall: vi.fn(() => current),
			answerCall: vi.fn(),
			joinExistingCall: vi.fn().mockResolvedValue('joined')
		};
		const mine = vi
			.fn()
			.mockResolvedValue({ id: 31, medium: 'VIDEO', status: 'PENDING' });
		await answerOrKnock(ringing, calls, { asker: true, mine });
		// The invitation's lifetime is over; the counsellor admits afterwards.
		current = null;
		takeAdmittedJoin(9)?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(calls.answerCall).not.toHaveBeenCalled();
		// The same call, by id and rooms: a later call is never joined.
		expect(calls.joinExistingCall).toHaveBeenCalledWith(
			expect.objectContaining({
				callId: 'call-1',
				roomRef: ROOM,
				callRoomId: '!call:oriso',
				state: 'running'
			}),
			false
		);
	});

	it('does not answer a call that stopped ringing while the person waited', async () => {
		rememberDirectLinkSession(9, {
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: ROOM
		});
		const calls = manager(null);
		const mine = vi
			.fn()
			.mockResolvedValue({ id: 31, medium: 'VIDEO', status: 'ADMITTED' });
		await expect(
			answerOrKnock(ringing, calls, { asker: true, mine })
		).resolves.toBe('ended');
		expect(calls.answerCall).not.toHaveBeenCalled();
	});
});
