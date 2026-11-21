// @vitest-environment oriso-jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import type { CallData } from '../../services/CallManager';
import { FloatingCallWidget } from './FloatingCallWidget';

const mocks = vi.hoisted(() => ({
	manager: {
		subscribe: vi.fn(),
		getCurrentCall: vi.fn(),
		answerCall: vi.fn(),
		setMatrixCall: vi.fn(),
		endCall: vi.fn()
	},
	matrix: {
		startCall: vi.fn(),
		answerCall: vi.fn(),
		getActiveCall: vi.fn(),
		attachMediaElements: vi.fn()
	},
	clientService: { getClient: vi.fn() },
	getUserMedia: vi.fn()
}));

vi.mock('../../services/CallManager', () => ({ callManager: mocks.manager }));
vi.mock('../../services/matrixCallService', () => ({
	matrixCallService: mocks.matrix
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => mocks.clientService
}));
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: mocks.clientService })
}));
vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t }) };
});

const roomId = '!room:example.test';
const callData = (callId: string, isIncoming = true): CallData => ({
	callId,
	roomId,
	isIncoming,
	isVideo: false,
	state: isIncoming ? 'ringing' : 'connecting'
});
const sdkCall = (callId: string) => ({
	callId,
	roomId,
	direction: 'inbound',
	state: 'ringing'
});
const sdkClient = (...calls: ReturnType<typeof sdkCall>[]) => ({
	callEventHandler: {
		calls: new Map(calls.map((call) => [call.callId, call]))
	},
	getRoom: () => null
});

let updateCall: ((call: CallData) => void) | undefined;
const originalMedia = Object.getOwnPropertyDescriptor(
	navigator,
	'mediaDevices'
);
const selectCall = (call: CallData) => {
	mocks.manager.getCurrentCall.mockReturnValue(call);
	act(() => updateCall?.(call));
};
const answer = () => fireEvent.click(screen.getByTitle('calls.answer'));

beforeEach(() => {
	vi.resetAllMocks();
	mocks.manager.subscribe.mockImplementation(
		(listener: (call: CallData) => void) => {
			updateCall = listener;
			return () => {
				updateCall = undefined;
			};
		}
	);
	mocks.clientService.getClient.mockReturnValue(sdkClient());
	mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] });
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia: mocks.getUserMedia }
	});
	vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	if (originalMedia)
		Object.defineProperty(navigator, 'mediaDevices', originalMedia);
	else Reflect.deleteProperty(navigator, 'mediaDevices');
});

it.each(['manager call', 'SDK client', 'active SDK call'])(
	'ignores a late outgoing result after the %s changes',
	async (changed) => {
		const call = sdkCall('outgoing');
		const pending = Promise.withResolvers<typeof call>();
		mocks.matrix.startCall.mockReturnValue(pending.promise);
		mocks.matrix.getActiveCall.mockReturnValue(call);
		selectCall(callData('manager-outgoing', false));
		render(<FloatingCallWidget />);
		expect(mocks.matrix.startCall).toHaveBeenCalledOnce();

		if (changed === 'manager call') selectCall(callData('replacement'));
		else if (changed === 'SDK client')
			mocks.clientService.getClient.mockReturnValue(sdkClient());
		else mocks.matrix.getActiveCall.mockReturnValue(sdkCall('replacement'));

		await act(async () => {
			pending.resolve(call);
			await pending.promise;
		});
		expect(mocks.matrix.attachMediaElements).not.toHaveBeenCalled();
		expect(mocks.manager.setMatrixCall).not.toHaveBeenCalled();
	}
);

it('keeps the replacement intact when an old outgoing request fails', async () => {
	const pending = Promise.withResolvers<never>();
	mocks.matrix.startCall.mockReturnValue(pending.promise);
	selectCall(callData('outgoing', false));
	render(<FloatingCallWidget />);
	expect(mocks.matrix.startCall).toHaveBeenCalledOnce();
	selectCall(callData('replacement'));

	await act(async () => {
		pending.reject(new Error('Old start failed'));
		await pending.promise.catch(() => undefined);
	});
	expect(window.alert).not.toHaveBeenCalled();
	expect(mocks.manager.endCall).not.toHaveBeenCalled();
});

it('releases permission-only tracks and skips answering when the SDK changes', async () => {
	const pending = Promise.withResolvers<{
		getTracks: () => { stop: () => void }[];
	}>();
	const stop = vi.fn();
	mocks.getUserMedia.mockReturnValue(pending.promise);
	mocks.clientService.getClient.mockReturnValue(
		sdkClient(sdkCall('incoming'))
	);
	selectCall(callData('incoming'));
	render(<FloatingCallWidget />);
	answer();
	expect(mocks.getUserMedia).toHaveBeenCalledOnce();
	mocks.clientService.getClient.mockReturnValue(sdkClient());

	await act(async () => {
		pending.resolve({ getTracks: () => [{ stop }] });
		await pending.promise;
	});
	expect(stop).toHaveBeenCalledOnce();
	expect(mocks.manager.answerCall).not.toHaveBeenCalled();
	expect(mocks.matrix.answerCall).not.toHaveBeenCalled();
});

it.each(['resolved', 'rejected'])(
	'ignores a %s answer after the manager moves to another call',
	async (result) => {
		const call = sdkCall('incoming');
		const pending = Promise.withResolvers<void>();
		mocks.matrix.answerCall.mockReturnValue(pending.promise);
		mocks.matrix.getActiveCall.mockReturnValue(call);
		mocks.clientService.getClient.mockReturnValue(sdkClient(call));
		selectCall(callData('incoming'));
		render(<FloatingCallWidget />);
		await act(async () => {
			answer();
		});
		expect(mocks.matrix.answerCall).toHaveBeenCalledOnce();
		selectCall(callData('replacement'));

		await act(async () => {
			if (result === 'resolved') pending.resolve();
			else pending.reject(new Error('Old answer failed'));
			await pending.promise.catch(() => undefined);
		});
		expect(mocks.matrix.attachMediaElements).not.toHaveBeenCalled();
		expect(mocks.manager.setMatrixCall).not.toHaveBeenCalled();
		expect(mocks.manager.endCall).not.toHaveBeenCalled();
		expect(window.alert).not.toHaveBeenCalled();
	}
);

it('answers and publishes the current SDK call by ID when another call rings in the same room', async () => {
	const wanted = sdkCall('incoming');
	mocks.clientService.getClient.mockReturnValue(
		sdkClient(sdkCall('other'), wanted)
	);
	mocks.matrix.answerCall.mockResolvedValue(undefined);
	mocks.matrix.getActiveCall.mockReturnValue(wanted);
	selectCall(callData('incoming'));
	render(<FloatingCallWidget />);

	await act(async () => {
		answer();
	});
	expect(mocks.matrix.answerCall).toHaveBeenCalledWith(
		wanted,
		false,
		expect.anything(),
		expect.anything()
	);
	expect(mocks.manager.setMatrixCall).toHaveBeenCalledExactlyOnceWith(wanted);
});

it('still reports a current SDK answer error and ends that call', async () => {
	const call = sdkCall('incoming');
	mocks.clientService.getClient.mockReturnValue(sdkClient(call));
	mocks.matrix.answerCall.mockRejectedValue(
		new Error('Current answer failed')
	);
	selectCall(callData('incoming'));
	render(<FloatingCallWidget />);

	await act(async () => {
		answer();
	});
	expect(window.alert).toHaveBeenCalledExactlyOnceWith(
		'calls.widget.answerFailed'
	);
	expect(mocks.manager.endCall).toHaveBeenCalledOnce();
});
