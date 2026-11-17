// @vitest-environment oriso-jsdom
/**
 * Only counsellors start calls (Frank, 17 Nov 2026). Let in after a knock,
 * the advice seeker never starts a call of their own: they join the call
 * the counsellor starts in the conversation, as soon as it rings.
 */
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CallData } from '../../services/CallManager';

const ROOM = '!room:oriso';

const startRoomCall = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../call/startRoomCall', () => ({ startRoomCall }));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		getClient: () => ({
			getRoom: () => ({ getMyMembership: () => 'join' })
		})
	})
}));
const startCall = vi.hoisted(() => vi.fn());
vi.mock('../../services/CallManager', () => ({
	callManager: { startCall, joinExistingCall: vi.fn() }
}));

const { joinCounsellorsCall } = await import('./DirectLinkKnockGate');

const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: ROOM,
	medium: 'VIDEO' as const,
	status: 'ADMITTED' as const
};

const ringing = (signalRoomId: string): CallData => ({
	callId: 'call_1',
	roomId: '!call-room:oriso',
	elementCallRoomId: '!call-room:oriso',
	signalRoomId,
	isVideo: true,
	isIncoming: true,
	isGroup: false,
	usesElementCall: true,
	callerUserId: '@berater:oriso',
	state: 'ringing'
});

/** A CallManager stand-in: one current call and its listeners. */
const fakeManager = (initial: CallData | null = null) => {
	let current = initial;
	let waiting: CallData | null = null;
	const listeners = new Set<(call: CallData | null) => void>();
	const manager = {
		getCurrentCall: () => current,
		getWaitingCall: () => waiting,
		answerWaitingCall: vi.fn((callId: string) => {
			if (waiting?.callId !== callId) return;
			current = { ...waiting, state: 'connecting' };
			waiting = null;
			listeners.forEach((listener) => listener(current));
		}),
		answerCall: vi.fn(() => {
			if (current) current = { ...current, state: 'connecting' };
			listeners.forEach((listener) => listener(current));
		}),
		subscribe: (listener: (call: CallData | null) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		ring: (call: CallData) => {
			current = call;
			listeners.forEach((listener) => listener(current));
		},
		/** A second call rings behind the running one. */
		waitBehind: (call: CallData) => {
			waiting = call;
			listeners.forEach((listener) => listener(current));
		},
		/** The running call ends: the waiting one rings as the current one. */
		promote: () => {
			current = waiting;
			waiting = null;
			listeners.forEach((listener) => listener(current));
		},
		/** A listener hears a call the manager does not hold as current. */
		emit: (call: CallData) => {
			listeners.forEach((listener) => listener(call));
		},
		listenerCount: () => listeners.size
	};
	return manager;
};

describe('joining the counsellor’s call after being let in', () => {
	afterEach(() => {
		vi.useRealTimers();
		startRoomCall.mockClear();
		startCall.mockClear();
	});

	it('answers the counsellor’s call that already rings', async () => {
		const manager = fakeManager(ringing(ROOM));

		await expect(joinCounsellorsCall(knock, { manager })).resolves.toBe(
			'joined'
		);
		expect(manager.answerCall).toHaveBeenCalledTimes(1);
		expect(startRoomCall).not.toHaveBeenCalled();
		expect(startCall).not.toHaveBeenCalled();
	});

	it('waits for the counsellor’s call and answers it when it rings', async () => {
		const manager = fakeManager();
		const joined = joinCounsellorsCall(knock, { manager });

		manager.ring(ringing(ROOM));

		await expect(joined).resolves.toBe('joined');
		expect(manager.answerCall).toHaveBeenCalledTimes(1);
		expect(manager.listenerCount()).toBe(0);
	});

	it('never answers a call from another conversation', async () => {
		vi.useFakeTimers();
		const manager = fakeManager();
		const joined = joinCounsellorsCall(knock, {
			manager,
			timeoutMs: 1_000
		});

		manager.ring(ringing('!other:oriso'));
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(joined).resolves.toBe('unavailable');
		expect(manager.answerCall).not.toHaveBeenCalled();
	});

	it('does not report "joined" for a ringing call that is not the current one', async () => {
		vi.useFakeTimers();
		// Another call runs and stays current: answering the counsellor's
		// call would do nothing, so the person must not be told they joined.
		const running: CallData = {
			...ringing('!elsewhere:oriso'),
			callId: 'call_running',
			isIncoming: false,
			state: 'connected'
		};
		const manager = fakeManager(running);
		const joined = joinCounsellorsCall(knock, {
			manager,
			timeoutMs: 1_000
		});

		manager.emit({ ...ringing(ROOM), callId: 'call_counsellor' });
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(joined).resolves.toBe('unavailable');
		expect(manager.answerCall).not.toHaveBeenCalled();
	});

	it('gives up when no counsellor calls, and never starts a call itself', async () => {
		vi.useFakeTimers();
		const manager = fakeManager();
		const joined = joinCounsellorsCall(knock, {
			manager,
			timeoutMs: 1_000
		});

		await vi.advanceTimersByTimeAsync(1_000);

		await expect(joined).resolves.toBe('unavailable');
		expect(manager.listenerCount()).toBe(0);
		expect(startRoomCall).not.toHaveBeenCalled();
		expect(startCall).not.toHaveBeenCalled();
	});
});

describe('let in while still in another call (Frank, 17 Nov 2026)', () => {
	const running: CallData = {
		...ringing('!elsewhere:oriso'),
		callId: 'call_running',
		isIncoming: false,
		state: 'connected'
	};
	const counsellors = { ...ringing(ROOM), callId: 'call_counsellor' };

	afterEach(() => vi.useRealTimers());

	it('asks first and, on yes, leaves the running call to join', async () => {
		const manager = fakeManager(running);
		const confirmLeaveRunningCall = vi.fn(async () => true);
		const joined = joinCounsellorsCall(knock, {
			manager,
			confirmLeaveRunningCall
		});

		manager.waitBehind(counsellors);

		await expect(joined).resolves.toBe('joined');
		expect(confirmLeaveRunningCall).toHaveBeenCalledOnce();
		expect(manager.answerWaitingCall).toHaveBeenCalledWith(
			'call_counsellor'
		);
		expect(manager.answerCall).not.toHaveBeenCalled();
		expect(manager.listenerCount()).toBe(0);
	});

	it('asks for a call that already waits when the person is let in', async () => {
		const manager = fakeManager(running);
		manager.waitBehind(counsellors);
		const confirmLeaveRunningCall = vi.fn(async () => true);

		await expect(
			joinCounsellorsCall(knock, { manager, confirmLeaveRunningCall })
		).resolves.toBe('joined');
		expect(manager.answerWaitingCall).toHaveBeenCalledOnce();
	});

	it('on no, stays in the running call and reports unavailable', async () => {
		const manager = fakeManager(running);
		const confirmLeaveRunningCall = vi.fn(async () => false);
		const joined = joinCounsellorsCall(knock, {
			manager,
			confirmLeaveRunningCall
		});

		manager.waitBehind(counsellors);
		manager.waitBehind(counsellors);

		await expect(joined).resolves.toBe('unavailable');
		expect(confirmLeaveRunningCall).toHaveBeenCalledOnce();
		expect(manager.answerWaitingCall).not.toHaveBeenCalled();
		expect(manager.getCurrentCall()?.callId).toBe('call_running');
	});

	it('never asks about a waiting call from another conversation', async () => {
		vi.useFakeTimers();
		const manager = fakeManager(running);
		const confirmLeaveRunningCall = vi.fn(async () => true);
		const joined = joinCounsellorsCall(knock, {
			manager,
			confirmLeaveRunningCall,
			timeoutMs: 1_000
		});

		manager.waitBehind({ ...counsellors, signalRoomId: '!other:oriso' });
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(joined).resolves.toBe('unavailable');
		expect(confirmLeaveRunningCall).not.toHaveBeenCalled();
	});

	it('does not give up while the person is still deciding', async () => {
		vi.useFakeTimers();
		const manager = fakeManager(running);
		let answer: (yes: boolean) => void = () => undefined;
		const confirmLeaveRunningCall = vi.fn(
			() => new Promise<boolean>((resolve) => (answer = resolve))
		);
		const joined = joinCounsellorsCall(knock, {
			manager,
			confirmLeaveRunningCall,
			timeoutMs: 1_000
		});

		manager.waitBehind(counsellors);
		await vi.advanceTimersByTimeAsync(5_000);
		answer(true);

		await expect(joined).resolves.toBe('joined');
		expect(manager.answerWaitingCall).toHaveBeenCalledOnce();
	});

	it('withdraws the question when the running call ends meanwhile', async () => {
		const manager = fakeManager(running);
		let signal: AbortSignal | undefined;
		const confirmLeaveRunningCall = vi.fn((asked: AbortSignal) => {
			signal = asked;
			return new Promise<boolean>(() => undefined);
		});
		const joined = joinCounsellorsCall(knock, {
			manager,
			confirmLeaveRunningCall
		});

		manager.waitBehind(counsellors);
		manager.promote();

		await expect(joined).resolves.toBe('joined');
		expect(manager.answerCall).toHaveBeenCalledOnce();
		expect(manager.answerWaitingCall).not.toHaveBeenCalled();
		expect(signal?.aborted).toBe(true);
	});

	it('without anyone to ask, never answers the waiting call', async () => {
		vi.useFakeTimers();
		const manager = fakeManager(running);
		const joined = joinCounsellorsCall(knock, {
			manager,
			timeoutMs: 1_000
		});

		manager.waitBehind(counsellors);
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(joined).resolves.toBe('unavailable');
		expect(manager.answerWaitingCall).not.toHaveBeenCalled();
	});
});
