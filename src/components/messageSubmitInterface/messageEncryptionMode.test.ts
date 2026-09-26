import { describe, expect, it, vi } from 'vitest';
import {
	createEnquirySubmissionGuard,
	dispatchAskerMessageTransport,
	isAskerEnquirySubmission,
	resolveAskerMessageTransport,
	resolveEnquiryMatrixRoom,
	sendEncryptedInitialEnquiry
} from './messageEncryptionMode';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

describe('messageEncryptionMode', () => {
	it('detects asker enquiry submissions from the enquiry list type', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: undefined,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false
			})
		).toBe(true);
	});

	it('detects redirected asker enquiry submissions from the session status', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: false,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false
			})
		).toBe(true);
	});

	it('does not treat anonymous live chat as an asker enquiry submission', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: true
			})
		).toBe(false);
	});

	it('classifies the first message as an enquiry even when registration pre-created a Matrix room', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: false,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false,
				hasEnquiryMessage: false
			})
		).toBe(true);
	});

	it('classifies a recorded enquiry message as a follow-up', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: false,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false,
				hasEnquiryMessage: true
			})
		).toBe(false);
	});

	it('requires asker authority for enquiry submissions', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: false,
				isAnonymousLiveChat: false
			})
		).toBe(false);
	});

	it('dispatches the first message to the enquiry endpoint exactly once even with a Matrix room', async () => {
		const sendEnquiry = vi.fn().mockResolvedValue(undefined);
		const sendMatrix = vi.fn().mockResolvedValue(undefined);
		const onBlocked = vi.fn();
		const transport = resolveAskerMessageTransport({
			isEnquiryListType: false,
			sessionStatus: STATUS_ENQUIRY,
			hasAskerAuthority: true,
			isAnonymousLiveChat: false,
			hasEnquiryMessage: false,
			isMatrixSession: true,
			matrixRoomId: '!precreated:example.org'
		});

		await dispatchAskerMessageTransport({
			transport,
			sendEnquiry,
			sendMatrix,
			onBlocked
		});

		expect(sendEnquiry).toHaveBeenCalledOnce();
		expect(sendMatrix).not.toHaveBeenCalled();
		expect(onBlocked).not.toHaveBeenCalled();
	});

	it('dispatches a recorded enquiry follow-up through Matrix', async () => {
		const sendEnquiry = vi.fn().mockResolvedValue(undefined);
		const sendMatrix = vi.fn().mockResolvedValue(undefined);
		const onBlocked = vi.fn();
		const transport = resolveAskerMessageTransport({
			isEnquiryListType: false,
			sessionStatus: STATUS_ENQUIRY,
			hasAskerAuthority: true,
			isAnonymousLiveChat: false,
			hasEnquiryMessage: true,
			isMatrixSession: true,
			matrixRoomId: '!ready:example.org'
		});

		await dispatchAskerMessageTransport({
			transport,
			sendEnquiry,
			sendMatrix,
			onBlocked
		});

		expect(sendMatrix).toHaveBeenCalledOnce();
		expect(sendEnquiry).not.toHaveBeenCalled();
		expect(onBlocked).not.toHaveBeenCalled();
	});

	it('blocks a recorded enquiry follow-up until its Matrix room is ready', async () => {
		const sendEnquiry = vi.fn().mockResolvedValue(undefined);
		const sendMatrix = vi.fn().mockResolvedValue(undefined);
		const onBlocked = vi.fn();
		const transport = resolveAskerMessageTransport({
			isEnquiryListType: false,
			sessionStatus: STATUS_ENQUIRY,
			hasAskerAuthority: true,
			isAnonymousLiveChat: false,
			hasEnquiryMessage: true,
			isMatrixSession: false
		});

		await dispatchAskerMessageTransport({
			transport,
			sendEnquiry,
			sendMatrix,
			onBlocked
		});

		expect(onBlocked).toHaveBeenCalledOnce();
		expect(sendEnquiry).not.toHaveBeenCalled();
		expect(sendMatrix).not.toHaveBeenCalled();
	});

	it('keeps a successful one-shot enquiry locked until the session changes', () => {
		const guard = createEnquirySubmissionGuard();

		expect(guard.tryStart()).toBe(true);
		expect(guard.tryStart()).toBe(false);
		guard.markSucceeded();
		expect(guard.tryStart()).toBe(false);
	});

	it('allows a retry when the one-shot enquiry request fails', () => {
		const guard = createEnquirySubmissionGuard();

		expect(guard.tryStart()).toBe(true);
		guard.markFailed();
		expect(guard.tryStart()).toBe(true);
	});

	it('sends the initial enquiry through Matrix before finalizing only its event ID', async () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) || null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key)
		};
		const calls: string[] = [];
		const sendEncryptedMatrixMessage = vi.fn(async () => {
			calls.push('matrix');
			return { event_id: '$encrypted' };
		});
		const finalizeEnquiry = vi.fn(async (eventId: string) => {
			calls.push(`finalize:${eventId}`);
			return { sessionId: 42 };
		});

		await sendEncryptedInitialEnquiry({
			sessionId: 42,
			sendEncryptedMatrixMessage,
			finalizeEnquiry,
			storage
		});

		expect(calls).toEqual(['matrix', 'finalize:$encrypted']);
		expect(sendEncryptedMatrixMessage).toHaveBeenCalledWith(
			'oriso.enquiry.42'
		);
		expect(values.size).toBe(0);
	});

	it('reuses the homeserver transaction when retry storage is unavailable', async () => {
		const storage = {
			getItem: vi.fn(() => {
				throw new Error('storage unavailable');
			}),
			setItem: vi.fn(() => {
				throw new Error('storage unavailable');
			}),
			removeItem: vi.fn(() => {
				throw new Error('storage unavailable');
			})
		};
		const sendEncryptedMatrixMessage = vi
			.fn()
			.mockResolvedValue({ event_id: '$encrypted' });
		const finalizeEnquiry = vi
			.fn()
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValueOnce({ sessionId: 42 });

		await expect(
			sendEncryptedInitialEnquiry({
				sessionId: 42,
				sendEncryptedMatrixMessage,
				finalizeEnquiry,
				storage
			})
		).rejects.toThrow('temporary');
		await sendEncryptedInitialEnquiry({
			sessionId: 42,
			sendEncryptedMatrixMessage,
			finalizeEnquiry,
			storage
		});

		expect(sendEncryptedMatrixMessage).toHaveBeenNthCalledWith(
			1,
			'oriso.enquiry.42'
		);
		expect(sendEncryptedMatrixMessage).toHaveBeenNthCalledWith(
			2,
			'oriso.enquiry.42'
		);
	});

	it('retries finalization without sending a duplicate encrypted message', async () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) || null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key)
		};
		const sendEncryptedMatrixMessage = vi
			.fn()
			.mockResolvedValue({ event_id: '$encrypted' });
		const finalizeEnquiry = vi
			.fn()
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValueOnce({ sessionId: 42 });

		await expect(
			sendEncryptedInitialEnquiry({
				sessionId: 42,
				sendEncryptedMatrixMessage,
				finalizeEnquiry,
				storage
			})
		).rejects.toThrow('temporary');
		await sendEncryptedInitialEnquiry({
			sessionId: 42,
			sendEncryptedMatrixMessage,
			finalizeEnquiry,
			storage
		});

		expect(sendEncryptedMatrixMessage).toHaveBeenCalledOnce();
		expect(finalizeEnquiry).toHaveBeenCalledTimes(2);
		expect(values.size).toBe(0);
	});
});

it('signals reminder eligibility only after backend finalization, including a successful retry', async () => {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		}
	};
	const finalized = vi.fn();
	const send = vi.fn(async () => ({ event_id: '$synthetic' }));
	const finalize = vi
		.fn()
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValueOnce({ sessionId: 7 });
	const input = {
		sessionId: 7,
		sendEncryptedMatrixMessage: send,
		finalizeEnquiry: finalize,
		onFinalized: finalized,
		storage
	};
	await expect(sendEncryptedInitialEnquiry(input)).rejects.toThrow('offline');
	expect(finalized).not.toHaveBeenCalled();
	await sendEncryptedInitialEnquiry(input);
	expect(finalized).toHaveBeenCalledOnce();
	expect(send).toHaveBeenCalledOnce();
});

describe('resolveEnquiryMatrixRoom (#1401)', () => {
	const noSleep = async () => undefined;

	it('sends straight away when the known room is already encrypted', async () => {
		const fetchSessionRoomId = vi.fn();
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: '!known:oriso',
			fetchSessionRoomId,
			isRoomEncrypted: () => true,
			sleep: noSleep
		});
		expect(result).toEqual({ status: 'ready', roomId: '!known:oriso' });
		expect(fetchSessionRoomId).not.toHaveBeenCalled();
	});

	it('re-reads the session when the list did not know the holding room yet', async () => {
		const fetchSessionRoomId = vi.fn().mockResolvedValue('!late:oriso');
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: null,
			fetchSessionRoomId,
			isRoomEncrypted: (roomId) => roomId === '!late:oriso',
			sleep: noSleep
		});
		expect(result).toEqual({ status: 'ready', roomId: '!late:oriso' });
		expect(fetchSessionRoomId).toHaveBeenCalledTimes(1);
	});

	it('names the missing room when the session has none even after re-reading', async () => {
		const isRoomEncrypted = vi.fn();
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: undefined,
			fetchSessionRoomId: async () => null,
			isRoomEncrypted,
			sleep: noSleep
		});
		expect(result).toEqual({ status: 'room-missing' });
		expect(isRoomEncrypted).not.toHaveBeenCalled();
	});

	it('treats a failed session re-read as a missing room instead of throwing', async () => {
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: '',
			fetchSessionRoomId: async () => {
				throw new Error('network');
			},
			isRoomEncrypted: () => true,
			sleep: noSleep
		});
		expect(result).toEqual({ status: 'room-missing' });
	});

	it('waits for /sync to deliver the encrypted room before sending', async () => {
		let polls = 0;
		let clock = 0;
		const sleep = vi.fn(async (ms: number) => {
			clock += ms;
		});
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: '!room:oriso',
			fetchSessionRoomId: async () => null,
			isRoomEncrypted: () => ++polls >= 3,
			waitMs: 8000,
			pollIntervalMs: 250,
			sleep,
			now: () => clock
		});
		expect(result).toEqual({ status: 'ready', roomId: '!room:oriso' });
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('gives up with the room named once the wait bound is exhausted', async () => {
		let clock = 0;
		const sleep = async (ms: number) => {
			clock += ms;
		};
		const result = await resolveEnquiryMatrixRoom({
			knownRoomId: '!room:oriso',
			fetchSessionRoomId: async () => null,
			isRoomEncrypted: () => false,
			waitMs: 1000,
			pollIntervalMs: 250,
			sleep,
			now: () => clock
		});
		expect(result).toEqual({
			status: 'room-not-encrypted',
			roomId: '!room:oriso'
		});
		expect(clock).toBe(1000);
	});
});
