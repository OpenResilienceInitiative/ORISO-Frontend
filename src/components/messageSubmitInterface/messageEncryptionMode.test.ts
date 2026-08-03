import { describe, expect, it, vi } from 'vitest';
import {
	createEnquirySubmissionGuard,
	dispatchAskerMessageTransport,
	isAskerEnquirySubmission,
	resolveAskerMessageTransport,
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
