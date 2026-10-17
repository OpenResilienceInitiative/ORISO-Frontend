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

	it('keeps a call that a token refresh replaced the client under', async () => {
		/*
		 * A refresh for the SAME account, mid-startup.
		 *
		 * The check after the root write compared client OBJECTS, so an
		 * ordinary token refresh read as an account change and aborted — but
		 * `publish()` had already resolved, so the room held a durable
		 * `running` card while the tracker threw its record away and the
		 * outer `finish()` became a no-op. The card stayed `running`, and
		 * joinable-looking, for good.
		 */
		const mine = '@counsellor:example';
		const refreshedSend = vi.fn().mockResolvedValue({ event_id: '$root' });
		const refreshed = {
			sendMessage: refreshedSend,
			getUserId: () => mine,
			getRoom: () => null,
			on: vi.fn(),
			off: vi.fn()
		};
		const firstSend = vi.fn().mockImplementation(() => {
			// The refresh lands while the root write is in flight.
			setMatrixClientServiceRef({ getClient: () => refreshed } as never);
			return Promise.resolve({ event_id: '$root' });
		});
		setMatrixClientServiceRef({
			getClient: () => ({
				sendMessage: firstSend,
				getUserId: () => mine,
				getRoom: () => null,
				on: vi.fn(),
				off: vi.fn()
			})
		} as never);

		await expect(callLifecycleTracker.begin(call)).resolves.not.toThrow();

		// And the card can still be ended, which is what being tracked means.
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		expect(refreshedSend).toHaveBeenCalled();
	});

	it('finishes a terminal write through a client installed after the retry was scheduled', async () => {
		/*
		 * `finish` unsubscribes from `onClientChange` before the terminal
		 * write has succeeded, so a refresh during the retry delay left the
		 * captured client pointing at the discarded instance. Every retry was
		 * then abandoned by its own guard and the card stayed `running` —
		 * the same ending as the bug above, by a different road.
		 */
		const mine = '@counsellor:example';
		const firstSend = vi
			.fn()
			.mockResolvedValueOnce({ event_id: '$root' })
			.mockRejectedValueOnce(new Error('temporary outage'));
		setMatrixClientServiceRef({
			getClient: () => ({
				sendMessage: firstSend,
				getUserId: () => mine,
				getRoom: () => null,
				on: vi.fn(),
				off: vi.fn()
			})
		} as never);
		await callLifecycleTracker.begin(call);
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);

		// The refresh happens while the retry is still waiting on its timer.
		const refreshedSend = vi.fn().mockResolvedValue({ event_id: '$edit' });
		setMatrixClientServiceRef({
			getClient: () => ({
				sendMessage: refreshedSend,
				getUserId: () => mine,
				getRoom: () => null,
				on: vi.fn(),
				off: vi.fn()
			})
		} as never);
		await vi.advanceTimersByTimeAsync(60000);

		expect(refreshedSend).toHaveBeenCalled();
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

	it('waits for the replacement client to be able to encrypt', async () => {
		/*
		 * `MatrixClientService.initializeClient` announces the replacement
		 * BEFORE `initRustCrypto()` resolves, on purpose, so room listeners
		 * re-attach without missing events. A WRITE in that window reaches a
		 * client that cannot encrypt yet — and this card carries the
		 * participants' display names into a counselling room.
		 *
		 * So the write waits, and because it waits it must also be retried:
		 * a running card is normally re-sent by the next membership change,
		 * and in this window there may not be another one.
		 */
		const before = clientDouble(ME);
		const service = rotatingService(before);
		await callLifecycleTracker.begin(call);

		let crypto: object | undefined = undefined;
		const after = Object.assign(clientDouble(ME), {
			getCrypto: () => crypto
		});
		service.rotateTo(after);

		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		// Nothing goes out while the answer is "not yet".
		expect(after.sendMessage).not.toHaveBeenCalled();

		crypto = { ready: true };
		await vi.advanceTimersByTimeAsync(1000);
		expect(after.sendMessage).toHaveBeenCalledTimes(1);
		expect(after.sendMessage.mock.calls[0][1]['org.oriso.call'].state).toBe(
			'missed'
		);
	});

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

	it('follows a refresh that lands while the root write is in flight', async () => {
		/*
		 * The one window `onClientChange` cannot cover.
		 *
		 * The subscription is registered AFTER the root write, and it does
		 * not replay. A same-account refresh completing inside that await
		 * therefore passed the account check and was never heard about: the
		 * captured client stayed the stopped instance, the membership
		 * listeners attached to it, and nobody joining or leaving ever
		 * reached the card.
		 */
		const before = clientDouble(ME);
		let acknowledge!: (value: { event_id: string }) => void;
		before.sendMessage.mockReturnValueOnce(
			new Promise((resolve) => {
				acknowledge = resolve;
			})
		);
		const service = rotatingService(before);

		// Only the replacement can see the call room, so a listener on the
		// old client is a listener that will never fire.
		const memberships: { sender: string }[] = [];
		let refreshMemberships: (() => void) | undefined;
		const after = Object.assign(clientDouble(ME), {
			getRoom: () => ({
				getMember: (userId: string) => ({ name: `Name of ${userId}` })
			}),
			matrixRTC: {
				getRoomSession: () => ({
					get memberships() {
						return memberships;
					},
					on: (_event: string, handler: () => void) => {
						refreshMemberships = handler;
					},
					off: vi.fn()
				})
			}
		});

		const begun = callLifecycleTracker.begin(call);
		await vi.advanceTimersByTimeAsync(0);
		service.rotateTo(after);
		acknowledge({ event_id: '$root' });
		await begun;

		memberships.push({ sender: '@alex:example' });
		refreshMemberships?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(after.sendMessage).toHaveBeenCalled();
		expect(
			after.sendMessage.mock.calls.at(-1)?.[1]['org.oriso.call'].present
		).toEqual([
			{ userId: '@alex:example', displayName: 'Name of @alex:example' }
		]);
	});

	it("does not let a retried presence update spend the hangup's budget", async () => {
		/*
		 * `retryAttempts` counts for the whole call, and until now it only
		 * ever grew. Harmless while a terminal write was the only thing
		 * retried — there is one per call — and not harmless once a RUNNING
		 * update retries too, which it must in order to survive the window
		 * where a replacement client cannot encrypt yet.
		 *
		 * The sequence: somebody arrives inside that window, so the presence
		 * update spends all three delays before it lands; then the hangup
		 * fails once, the way a blip makes it fail. With a budget that was
		 * never returned, that single failure indexed past the end of the
		 * delay table and the card stayed `running` for good.
		 */
		const memberships: { sender: string }[] = [];
		let refreshMemberships: (() => void) | undefined;
		let crypto: object | undefined = { ready: true };
		const client = Object.assign(clientDouble(ME), {
			getCrypto: () => crypto,
			getRoom: () => ({
				getMember: (userId: string) => ({ name: `Name of ${userId}` })
			}),
			matrixRTC: {
				getRoomSession: () => ({
					get memberships() {
						return memberships;
					},
					on: (_event: string, handler: () => void) => {
						refreshMemberships = handler;
					},
					off: vi.fn()
				})
			}
		});
		rotatingService(client);
		await callLifecycleTracker.begin(call);
		const afterRoot = client.sendMessage.mock.calls.length;

		// The refresh window opens, and somebody arrives inside it.
		crypto = undefined;
		memberships.push({ sender: '@alex:example' });
		refreshMemberships?.();
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(1000);
		await vi.advanceTimersByTimeAsync(2000);
		// Nothing could be written while the client could not encrypt.
		expect(client.sendMessage.mock.calls.length).toBe(afterRoot);

		crypto = { ready: true };
		await vi.advanceTimersByTimeAsync(4000);
		expect(client.sendMessage.mock.calls.length).toBe(afterRoot + 1);

		// And now the hangup, failing once.
		client.sendMessage
			.mockRejectedValueOnce(new Error('synthetic'))
			.mockResolvedValue({ event_id: '$root' });
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		const afterFirstTry = client.sendMessage.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1000);
		expect(client.sendMessage.mock.calls.length).toBeGreaterThan(
			afterFirstTry
		);
		expect(
			client.sendMessage.mock.calls.at(-1)?.[1]['org.oriso.call'].state
		).toBe('ended');
	});

	it('closes a card whose root write lost its acknowledgement', async () => {
		/*
		 * The event lands, the response does not.
		 *
		 * Indistinguishable here from a request that never arrived, and the
		 * difference matters: dropping the tracked call made the caller's
		 * `finish` a no-op on a call id nothing knew any more, so an accepted
		 * card stayed `running` for good — with a Join button for a call room
		 * startup had already discarded.
		 */
		const client = clientDouble(ME);
		client.sendMessage
			.mockRejectedValueOnce(new Error('synthetic acknowledgement loss'))
			.mockResolvedValue({ event_id: '$root' });
		rotatingService(client);

		await expect(callLifecycleTracker.begin(call)).rejects.toThrow();
		// Attempted again under the transaction id the writer retained, which
		// is what stops the second attempt producing a second card.
		expect(client.sendMessage).toHaveBeenCalledTimes(2);
		expect(client.sendMessage.mock.calls[1][2]).toBe(
			client.sendMessage.mock.calls[0][2]
		);

		// And the card is now something the caller's cleanup can close.
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		expect(client.sendMessage).toHaveBeenCalledTimes(3);
		expect(
			client.sendMessage.mock.calls[2][1]['org.oriso.call'].state
		).toBe('missed');
		expect(
			client.sendMessage.mock.calls[2][1]['m.relates_to'].event_id
		).toBe('$root');
	});

	it('closes a card the immediate retry could not confirm either', async () => {
		/*
		 * One outage, both attempts.
		 *
		 * They are milliseconds apart, so a failed immediate retry says
		 * almost nothing about whether the first event is on the server — it
		 * says the connection is still down. Dropping the tracked call on it
		 * put the lost acknowledgement straight back: `finish` had nothing to
		 * finish, and the card the server kept stayed `running` with a Join
		 * button for a room startup had discarded.
		 *
		 * An earlier version of this file asserted the opposite ("drops a
		 * call whose root write never reached the server"), to keep a start
		 * that published nothing from leaving a phantom card behind. That
		 * trade is the wrong way round. Which world this is cannot be known
		 * from here, and they are not equally bad: one `missed` notice
		 * against a card that offers to join a dead call for ever. A failure
		 * that is NOT transient — no client, no permission, no room — fails
		 * the delayed retries too and writes nothing at all.
		 */
		const client = clientDouble(ME);
		client.sendMessage
			.mockRejectedValueOnce(new Error('synthetic outage'))
			.mockRejectedValueOnce(new Error('synthetic outage'))
			.mockRejectedValueOnce(new Error('synthetic outage'))
			.mockResolvedValue({ event_id: '$terminal' });
		rotatingService(client);

		await expect(callLifecycleTracker.begin(call)).rejects.toThrow();
		expect(client.sendMessage).toHaveBeenCalledTimes(2);

		// The caller's cleanup, with the outage still on: its write fails too
		// and goes to the retry chain, which has the seconds the immediate
		// attempt did not.
		callLifecycleTracker.finish(call.callId);
		await vi.advanceTimersByTimeAsync(0);
		expect(client.sendMessage).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000);
		expect(client.sendMessage).toHaveBeenCalledTimes(4);
		expect(
			client.sendMessage.mock.calls[3][1]['org.oriso.call'].state
		).toBe('missed');
		/*
		 * A second root rather than an edit, because no root event id was
		 * ever acknowledged. The reader folds two roots with the same
		 * `[roomRef, callId]` from the same sender and takes the terminal one
		 * — `collapseCallLifecycleMessages`, "keeps the first durable
		 * identity through three revisions" — so whichever of the two the
		 * server kept, the card ends up closed.
		 */
		expect(
			client.sendMessage.mock.calls[3][1]['m.relates_to']
		).toBeUndefined();
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
