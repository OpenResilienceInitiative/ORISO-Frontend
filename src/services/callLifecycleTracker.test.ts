import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLifecycleTracker } from './callLifecycleTracker';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import type { CallData } from './CallManager';

describe('terminal call timeline persistence', () => {
	let sequence = 0;
	let call: CallData;
	let sendMessage: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		vi.useFakeTimers();
		call = {
			callId: `retry-call-${++sequence}`,
			roomId: '!media:example',
			signalRoomId: '!source:example',
			isVideo: true,
			isIncoming: false,
			isGroup: false,
			usesElementCall: true,
			state: 'connecting'
		};
		sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		const client = {
			sendMessage,
			getRoom: () => null,
			on: vi.fn(),
			off: vi.fn()
		};
		setMatrixClientServiceRef({ getClient: () => client } as never);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		setMatrixClientServiceRef(null);
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('retries a failed terminal edit with its original transaction and root event', async () => {
		await callLifecycleTracker.begin(call);
		sendMessage.mockRejectedValueOnce(new Error('temporary outage'));
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(1000);
		expect(sendMessage).toHaveBeenCalledTimes(3);
		expect(sendMessage.mock.calls[2][2]).toBe(sendMessage.mock.calls[1][2]);
		expect(sendMessage.mock.calls[2][1]['m.relates_to'].event_id).toBe(
			'$root'
		);
		expect(sendMessage.mock.calls[2][1]['org.oriso.call'].state).toBe(
			'missed'
		);
	});

	it('bounds retries when terminal persistence keeps failing', async () => {
		await callLifecycleTracker.begin(call);
		sendMessage.mockRejectedValue(new Error('offline'));
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(60000);
		expect(sendMessage).toHaveBeenCalledTimes(5);
		expect(console.warn).toHaveBeenCalledTimes(1);
	});

	it('does not retry through a replacement login client', async () => {
		await callLifecycleTracker.begin(call);
		sendMessage.mockRejectedValueOnce(new Error('temporary outage'));
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		const replacementSend = vi.fn();
		setMatrixClientServiceRef({
			getClient: () => ({ sendMessage: replacementSend })
		} as never);
		await vi.advanceTimersByTimeAsync(60000);
		expect(sendMessage).toHaveBeenCalledTimes(2);
		expect(replacementSend).not.toHaveBeenCalled();
	});
});

describe('live presence', () => {
	const ACTOR = '@counsellor:example';
	let sequence = 0;
	let call: CallData;
	let sendMessage: ReturnType<typeof vi.fn>;
	let emit: () => void;

	/** A room session whose memberships we can change between emissions. */
	const session = { memberships: [] as { sender: string }[] };

	beforeEach(() => {
		call = {
			callId: `presence-call-${++sequence}`,
			roomId: '!media:example',
			signalRoomId: '!source:example',
			isVideo: true,
			isIncoming: false,
			isGroup: true,
			usesElementCall: true,
			state: 'connecting'
		};
		session.memberships = [];
		sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		let refresh: (() => void) | undefined;
		const room = {
			getMember: (userId: string) => ({ name: `Name of ${userId}` })
		};
		const client = {
			sendMessage,
			// Whoever starts the call. The tracker records it as the actor,
			// and "answered" is defined against it.
			getUserId: () => ACTOR,
			getRoom: () => room,
			matrixRTC: {
				getRoomSession: () => ({
					...session,
					get memberships() {
						return session.memberships;
					},
					on: (_event: string, handler: () => void) => {
						refresh = handler;
					},
					off: vi.fn()
				})
			},
			on: vi.fn(),
			off: vi.fn()
		};
		emit = () => refresh?.();
		setMatrixClientServiceRef({ getClient: () => client } as never);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		setMatrixClientServiceRef(null);
		vi.restoreAllMocks();
	});

	const lastPayload = () =>
		sendMessage.mock.calls.at(-1)?.[1]['org.oriso.call'];

	/*
	 * The writer publishes asynchronously and the tracker does not await it,
	 * so a membership change is not on the wire by the time `emit` returns.
	 * Two turns: one for the writer's own await, one for the send.
	 */
	const settled = async (): Promise<void> => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	};

	it('publishes who is in the call as they arrive', async () => {
		session.memberships = [{ sender: '@alex:example' }];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		expect(lastPayload().present).toEqual([
			{ userId: '@alex:example', displayName: 'Name of @alex:example' }
		]);
	});

	it('removes somebody who leaves, while keeping them in attendance', async () => {
		// This is the behaviour neither prior pull request had: the
		// attendance list is a union that never shrinks, so on its own it
		// says Sam is still there long after Sam has gone.
		session.memberships = [
			{ sender: '@alex:example' },
			{ sender: '@sam:example' }
		];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		expect(lastPayload().present).toHaveLength(2);

		session.memberships = [{ sender: '@alex:example' }];
		emit();
		await settled();
		expect(lastPayload().present).toEqual([
			{ userId: '@alex:example', displayName: 'Name of @alex:example' }
		]);
		expect(
			lastPayload().participants.map(
				(participant: { userId: string }) => participant.userId
			)
		).toEqual(['@alex:example', '@sam:example']);
	});

	it('leaves nobody present once the call has ended', async () => {
		session.memberships = [{ sender: '@alex:example' }];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		callLifecycleTracker.finish(call.callId);
		await settled();
		expect(lastPayload().state).toBe('ended');
		expect(lastPayload().present).toEqual([]);
		expect(lastPayload().participants).toHaveLength(1);
	});

	it('does not call a ringing phone an answered call', async () => {
		/*
		 * The caller's own MatrixRTC membership appears as soon as its iframe
		 * opens, so any membership at all used to count as "started". An
		 * unanswered call the caller then hung up was written as `ended`,
		 * with the ringing time as its duration — which is exactly the
		 * distinction `missed` exists to make.
		 */
		session.memberships = [{ sender: ACTOR }];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		expect(lastPayload().state).toBe('running');
		expect(lastPayload().started_at).toBeUndefined();
		// The caller is still shown as waiting in there.
		expect(lastPayload().present).toEqual([
			{ userId: ACTOR, displayName: `Name of ${ACTOR}` }
		]);

		callLifecycleTracker.finishIfUnattended(call.callId);
		await settled();
		expect(lastPayload().state).toBe('missed');
		expect(lastPayload().duration_seconds).toBeUndefined();
	});

	it('starts the call when somebody else arrives', async () => {
		session.memberships = [{ sender: ACTOR }];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		expect(lastPayload().started_at).toBeUndefined();

		session.memberships = [{ sender: ACTOR }, { sender: '@alex:example' }];
		emit();
		await settled();
		expect(lastPayload().started_at).toBeDefined();
	});

	it('counts one person on two devices once', async () => {
		// MatrixRTC publishes a membership per device, so the card showed two
		// avatars, an attendee count one too high, and two React children
		// under the same key.
		session.memberships = [
			{ sender: '@alex:example' },
			{ sender: '@alex:example' }
		];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		expect(lastPayload().present).toEqual([
			{ userId: '@alex:example', displayName: 'Name of @alex:example' }
		]);
		expect(lastPayload().participants).toHaveLength(1);
	});

	it('closes a group call nobody ever joined', async () => {
		/*
		 * A group call belongs to the room rather than to whoever invited
		 * everybody, so `endCall` deliberately does not end one when a
		 * participant leaves — the tracker waits for memberships to drop to
		 * zero instead. For a call nobody joined there is no such moment, so
		 * the card said "running" for as long as the conversation was open,
		 * offering a Join button that could only answer `unavailable`.
		 */
		await callLifecycleTracker.begin(call);
		callLifecycleTracker.finishIfUnattended(call.callId);
		await settled();
		expect(lastPayload().state).toBe('missed');
		expect(lastPayload().present).toEqual([]);
	});

	it('leaves a group call somebody is in alone', async () => {
		// The other half of the same rule: one person leaving a call that is
		// under way must not end it for everybody still in it.
		session.memberships = [{ sender: '@alex:example' }];
		await callLifecycleTracker.begin(call);
		emit();
		await settled();
		callLifecycleTracker.finishIfUnattended(call.callId);
		await settled();
		expect(lastPayload().state).toBe('running');
	});
});

describe('a call that outlives the Matrix client it started on', () => {
	/*
	 * A token refresh builds a NEW `MatrixClient` for the same account and
	 * tears the old one down. Every guard in the tracker used to compare
	 * against the object captured at `begin()`, so after an ordinary refresh
	 * the card was stranded: the membership listener hung off a dead client
	 * and never fired again, the mismatch cleanup inside it was therefore
	 * never reached, and the terminal write found `isCurrentClient()` false
	 * and gave up. The durable card stayed `running` for good, after
	 * something the user can neither see nor avoid.
	 */
	const ME = '@me:example';
	let call: CallData;
	let sequence = 0;

	const clientDouble = (userId: string) => ({
		sendMessage: vi.fn().mockResolvedValue({ event_id: '$root' }),
		getUserId: () => userId,
		getRoom: () => null,
		on: vi.fn(),
		off: vi.fn()
	});

	beforeEach(() => {
		vi.useFakeTimers();
		call = {
			callId: `rotate-call-${++sequence}`,
			roomId: '!media:example',
			signalRoomId: '!source:example',
			isVideo: true,
			isIncoming: false,
			isGroup: false,
			usesElementCall: true,
			state: 'connecting'
		};
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		setMatrixClientServiceRef(null);
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	/** A service whose client can be swapped, as a token refresh swaps it. */
	const rotatingService = (initial: ReturnType<typeof clientDouble>) => {
		let current = initial;
		const listeners = new Set<(client: unknown) => void>();
		setMatrixClientServiceRef({
			getClient: () => current,
			onClientChange: (listener: (client: unknown) => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			}
		} as never);
		return {
			rotateTo: (next: ReturnType<typeof clientDouble>) => {
				current = next;
				listeners.forEach((listener) => listener(next));
			}
		};
	};

	it('writes the ending through the replacement client', async () => {
		const before = clientDouble(ME);
		const service = rotatingService(before);
		await callLifecycleTracker.begin(call);
		expect(before.sendMessage).toHaveBeenCalledTimes(1);

		// The token refresh: same account, new client object.
		const after = clientDouble(ME);
		service.rotateTo(after);

		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		expect(after.sendMessage).toHaveBeenCalledTimes(1);
		expect(after.sendMessage.mock.calls[0][1]['org.oriso.call'].state).toBe(
			'missed'
		);
	});

	it('writes nothing through a different account', async () => {
		// Not a refresh but a logout and a new login. Nothing may write this
		// card any more, and writing it as somebody else would be worse than
		// leaving it: the card names an actor.
		const before = clientDouble(ME);
		const service = rotatingService(before);
		await callLifecycleTracker.begin(call);

		const somebodyElse = clientDouble('@other:example');
		service.rotateTo(somebodyElse);

		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(60000);
		expect(somebodyElse.sendMessage).not.toHaveBeenCalled();
	});
});
