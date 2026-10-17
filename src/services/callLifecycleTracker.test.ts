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
