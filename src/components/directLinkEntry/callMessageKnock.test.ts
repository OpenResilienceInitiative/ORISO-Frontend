// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	joinOrKnock,
	rememberAdmittedCall,
	takeAdmittedJoin
} from './callMessageKnock';
import {
	PENDING_KNOCK_EVENT,
	readPendingKnock,
	rememberDirectLinkSession
} from './directLinkEntryFlow';

vi.mock('../registration/autoLogin', () => ({ redirectToApp: vi.fn() }));

const conversation = (knockStatus: string) => ({
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO',
	admission: 'KNOCK',
	created: false,
	knockId: 31,
	knockStatus
});

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
	takeAdmittedJoin(9);
});

describe('joinOrKnock (FE#1893)', () => {
	it('joins as before where no direct link is on record', async () => {
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn();
		await expect(joinOrKnock(9, join, { start })).resolves.toBe('joined');
		expect(join).toHaveBeenCalledOnce();
		expect(start).not.toHaveBeenCalled();
	});

	it('knocks through the link first and joins only once let in', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn().mockResolvedValue(conversation('PENDING'));
		const announced = vi.fn();
		window.addEventListener(PENDING_KNOCK_EVENT, announced);

		await expect(joinOrKnock(9, join, { start })).resolves.toBe('joined');

		expect(start).toHaveBeenCalledWith('tok');
		expect(join).not.toHaveBeenCalled();
		expect(readPendingKnock()).toMatchObject({
			knockId: 31,
			sessionId: 9,
			joinExisting: true
		});
		expect(announced).toHaveBeenCalledOnce();
		window.removeEventListener(PENDING_KNOCK_EVENT, announced);

		takeAdmittedJoin(9)?.();
		expect(join).toHaveBeenCalledOnce();
		expect(takeAdmittedJoin(9)).toBeUndefined();
	});

	it('joins right away when the server already let the person in', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'AUDIO' });
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn().mockResolvedValue(conversation('ADMITTED'));
		await joinOrKnock(9, join, { start });
		expect(join).toHaveBeenCalledOnce();
		expect(readPendingKnock()).toBeNull();
	});

	it('leaves the decision to the server when the link refuses', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('unavailable');
		const start = vi
			.fn()
			.mockRejectedValue(new Response('', { status: 410 }));
		await expect(joinOrKnock(9, join, { start })).resolves.toBe(
			'unavailable'
		);
		expect(join).toHaveBeenCalledOnce();
	});

	it('does not knock twice after a reload during the admission', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		rememberAdmittedCall(9);
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn();
		await joinOrKnock(9, join, { start });
		expect(start).not.toHaveBeenCalled();
		expect(join).toHaveBeenCalledOnce();
		// Used once: the next call knocks again.
		start.mockResolvedValue(conversation('PENDING'));
		await joinOrKnock(9, join, { start });
		expect(start).toHaveBeenCalledOnce();
	});
});
