import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const CALL_ROOM = '!call:oriso.example';
const SIGNAL_ROOM = '!group:oriso.example';

describe('Element Call participant leave', () => {
	const sendEvent = vi.fn().mockResolvedValue({});

	beforeEach(() => {
		sendEvent.mockClear();
		setMatrixClientServiceRef({
			getClient: () => ({ sendEvent })
		} as never);
	});

	afterEach(() => {
		callManager.endCall(false);
	});

	it('does not end the group call for remote participants', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'group-call',
			'@patty:oriso.example',
			true,
			SIGNAL_ROOM,
			true
		);

		callManager.endCall();

		expect(callManager.getCurrentCall()).toBeNull();
		expect(sendEvent).not.toHaveBeenCalled();
	});

	it('still notifies the remote participant when a one-to-one call ends', () => {
		callManager.receiveCall(
			CALL_ROOM,
			false,
			'one-to-one-call',
			'@patty:oriso.example',
			false,
			SIGNAL_ROOM,
			true
		);

		callManager.endCall();

		expect(sendEvent).toHaveBeenCalledWith(
			SIGNAL_ROOM,
			'org.oriso.call.hangup',
			expect.objectContaining({ call_id: 'one-to-one-call' })
		);
	});
});
