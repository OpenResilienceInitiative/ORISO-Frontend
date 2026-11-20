// @vitest-environment oriso-jsdom
/**
 * While the knock waits, a device check that failed says so and can be run
 * again; and a reload join never guesses a call's group mode.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const retry = vi.fn();
const deviceBlocker = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('./useDirectLinkKnock', () => ({
	useDirectLinkKnock: () => ({
		knockId: 21,
		phase: 'waiting',
		gone: false,
		inactive: false,
		cancel: vi.fn(),
		knockAgain: vi.fn(),
		close: vi.fn()
	})
}));
vi.mock('../waitingRoom/callEntry/useCallDeviceCheck', () => ({
	useCallDeviceCheck: () => ({
		check: {
			modality: 'video',
			name: 'Kim',
			avatar: { animal: 'fox', color: '#000' },
			devices: { microphone: [], camera: [], speaker: [] },
			selection: {},
			stream: null,
			micLevel: 0,
			micOn: true,
			cameraOn: true,
			cameraAvailable: true,
			blocker: deviceBlocker.current,
			onToggleMic: vi.fn(),
			onToggleCamera: vi.fn(),
			onSelectDevice: vi.fn()
		},
		controls: { micOn: true, cameraOn: true, selection: {} },
		cameraAvailable: true,
		settled: true,
		blocker: deviceBlocker.current,
		retry
	})
}));
const joinExistingCall = vi.fn();
vi.mock('../../services/CallManager', () => ({
	callManager: { joinExistingCall, startCall: vi.fn() }
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		getClient: () => ({
			getRoom: () => ({ getMyMembership: () => 'join' })
		})
	})
}));

const { DirectLinkKnock, defaultJoinRunningCall } = await import(
	'./DirectLinkKnockGate'
);

const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO' as const,
	status: 'PENDING' as const
};

describe('the knock dialog while waiting', () => {
	afterEach(() => {
		cleanup();
		deviceBlocker.current = undefined;
		retry.mockClear();
	});

	it('shows why the device check failed and offers to run it again', () => {
		deviceBlocker.current = 'permissionDenied';
		render(
			<DirectLinkKnock
				knock={knock}
				onDone={vi.fn()}
				onAdmitted={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByTestId('knock-wait-retry'));
		expect(retry).toHaveBeenCalledOnce();
		// The switches give way to the notice.
		expect(screen.queryByTestId('toggle-mic')).toBeNull();
	});

	it('offers no retry while the check works', () => {
		render(
			<DirectLinkKnock
				knock={knock}
				onDone={vi.fn()}
				onAdmitted={vi.fn()}
			/>
		);
		expect(screen.queryByTestId('knock-wait-retry')).toBeNull();
	});
});

describe('joining the running call after a reload', () => {
	const call = {
		callId: 'c-1',
		state: 'running' as const,
		roomRef: '!room:oriso',
		callRoomId: '!media:oriso',
		callType: 'video' as const
	};

	afterEach(() => joinExistingCall.mockClear());

	it('joins in the mode recorded with the knock', async () => {
		await defaultJoinRunningCall({
			...knock,
			joinExisting: true,
			joinCall: { ...call, isGroup: true }
		});
		expect(joinExistingCall).toHaveBeenCalledWith(
			expect.objectContaining({ callId: 'c-1' }),
			true
		);
	});

	it('does not join a call whose mode is unknown as 1:1', async () => {
		await defaultJoinRunningCall({
			...knock,
			joinExisting: true,
			joinCall: call
		});
		expect(joinExistingCall).not.toHaveBeenCalled();
	});
});
