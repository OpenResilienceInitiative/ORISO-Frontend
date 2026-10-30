// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	joinOrKnock,
	rememberAdmittedConversation,
	wasAdmittedTo,
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

/** The server's answer to `GET /users/call-knocks/mine?sessionId=`. */
let mine = vi.fn().mockResolvedValue(null);

beforeEach(() => {
	mine = vi.fn().mockResolvedValue(null);
	sessionStorage.clear();
	localStorage.clear();
	takeAdmittedJoin(9);
});

describe('joinOrKnock (FE#1893)', () => {
	it('joins as before where no direct link is on record', async () => {
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn();
		await expect(joinOrKnock(9, join, { start, mine })).resolves.toBe(
			'joined'
		);
		expect(join).toHaveBeenCalledOnce();
		expect(start).not.toHaveBeenCalled();
	});

	it('knocks through the link first and joins only once let in', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn().mockResolvedValue(conversation('PENDING'));
		const announced = vi.fn();
		window.addEventListener(PENDING_KNOCK_EVENT, announced);

		await expect(joinOrKnock(9, join, { start, mine })).resolves.toBe(
			'joined'
		);

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
		await joinOrKnock(9, join, { start, mine });
		expect(join).toHaveBeenCalledOnce();
		expect(readPendingKnock()).toBeNull();
	});

	it('leaves the decision to the server when the link refuses', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('unavailable');
		const start = vi
			.fn()
			.mockRejectedValue(new Response('', { status: 410 }));
		await expect(joinOrKnock(9, join, { start, mine })).resolves.toBe(
			'unavailable'
		);
		expect(join).toHaveBeenCalledOnce();
	});

	it('lets in once: later calls join without a knock', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		rememberAdmittedConversation(9);
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn();
		await joinOrKnock(9, join, { start, mine });
		await joinOrKnock(9, join, { start, mine });
		// Never asks the link again: that would open a new pending knock.
		expect(start).not.toHaveBeenCalled();
		expect(join).toHaveBeenCalledTimes(2);
		expect(readPendingKnock()).toBeNull();
	});

	it('remembers an admission the server already reports', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn().mockResolvedValue(conversation('ADMITTED'));
		await joinOrKnock(9, join, { start, mine });
		expect(wasAdmittedTo(9)).toBe(true);
		await joinOrKnock(9, join, { start, mine });
		expect(start).toHaveBeenCalledOnce();
	});

	it('keeps the admission per conversation', () => {
		rememberAdmittedConversation(9);
		expect(wasAdmittedTo(9)).toBe(true);
		expect(wasAdmittedTo(10)).toBe(false);
		expect(wasAdmittedTo(undefined)).toBe(false);
	});

	it('asks the server: let in on another device, the card joins directly', async () => {
		mine.mockResolvedValue({
			id: 31,
			sessionId: 9,
			status: 'ADMITTED',
			medium: 'VIDEO'
		});
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn();
		// No link and no admission on this device.
		await joinOrKnock(9, join, { start, mine });
		expect(mine).toHaveBeenCalledWith(9);
		expect(join).toHaveBeenCalledOnce();
		expect(start).not.toHaveBeenCalled();
		// Cached: the next call needs no lookup.
		expect(wasAdmittedTo(9)).toBe(true);
		await joinOrKnock(9, join, { start, mine });
		expect(mine).toHaveBeenCalledOnce();
	});

	it('waits on a knock still open from another device', async () => {
		mine.mockResolvedValue({
			id: 44,
			sessionId: 9,
			status: 'PENDING',
			medium: 'AUDIO'
		});
		const join = vi.fn().mockResolvedValue('joined');
		await expect(
			joinOrKnock(9, join, { start: vi.fn(), mine })
		).resolves.toBe('joined');
		expect(join).not.toHaveBeenCalled();
		expect(readPendingKnock()).toMatchObject({
			knockId: 44,
			sessionId: 9,
			joinExisting: true
		});
	});

	it('takes callAdmitted from the link as an admission', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		mine.mockRejectedValue(new Error('offline'));
		const join = vi.fn().mockResolvedValue('joined');
		const start = vi.fn().mockResolvedValue({
			...conversation('ADMITTED'),
			callAdmitted: true
		});
		await joinOrKnock(9, join, { start, mine });
		expect(join).toHaveBeenCalledOnce();
		expect(readPendingKnock()).toBeNull();
		expect(wasAdmittedTo(9)).toBe(true);
	});

	it('knocks again through the link after a turn-down', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		mine.mockResolvedValue({
			id: 30,
			sessionId: 9,
			status: 'DECLINED',
			medium: 'VIDEO'
		});
		const join = vi.fn();
		const start = vi.fn().mockResolvedValue(conversation('PENDING'));
		await joinOrKnock(9, join, { start, mine });
		expect(start).toHaveBeenCalledWith('tok');
		expect(join).not.toHaveBeenCalled();
	});

	it('never gates a counsellor', async () => {
		rememberDirectLinkSession(9, { token: 'tok', medium: 'VIDEO' });
		const join = vi.fn().mockResolvedValue('joined');
		await joinOrKnock(9, join, { start: vi.fn(), mine, asker: false });
		expect(mine).not.toHaveBeenCalled();
		expect(join).toHaveBeenCalledOnce();
	});
});
