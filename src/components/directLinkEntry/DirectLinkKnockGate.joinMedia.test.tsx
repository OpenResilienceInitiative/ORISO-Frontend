// @vitest-environment oriso-jsdom

import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	forgetAllJoinMedia,
	peekJoinMedia,
	rememberJoinMedia
} from '../call/prejoin/callPrejoin';

const blocker = vi.hoisted(() => ({ current: undefined as unknown }));
/* The device check as the knock dialog sees it: `settled` once the browser
   answered, `cameraAvailable` optimistic (`true`) until then. */
const devices = vi.hoisted(() => ({ settled: true, cameraAvailable: true }));
vi.mock('./useDirectLinkKnock', () => ({
	useDirectLinkKnock: () => ({
		knockId: 21,
		phase: 'admitted',
		gone: false,
		inactive: false,
		cancel: vi.fn(),
		knockAgain: vi.fn(),
		close: vi.fn()
	})
}));
vi.mock('../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: () => null
}));
vi.mock('../waitingRoom/callEntry/useCallDeviceCheck', () => ({
	useCallDeviceCheck: () => ({
		check: { devices: { microphone: [], camera: [] } },
		controls: { micOn: true, cameraOn: true, selection: {} },
		cameraAvailable: devices.cameraAvailable,
		settled: devices.settled,
		blocker: blocker.current,
		retry: vi.fn()
	})
}));

const { DirectLinkKnock } = await import('./DirectLinkKnockGate');

const ROOM = '!room:oriso';
const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: ROOM,
	medium: 'VIDEO' as const,
	status: 'ADMITTED' as const
};

const admit = () =>
	render(
		<DirectLinkKnock knock={knock} onDone={vi.fn()} onAdmitted={vi.fn()} />
	);

describe('DirectLinkKnock when let in', () => {
	afterEach(() => {
		cleanup();
		forgetAllJoinMedia();
		sessionStorage.clear();
		blocker.current = undefined;
		devices.settled = true;
		devices.cameraAvailable = true;
		vi.useRealTimers();
	});

	it('takes the switches into the call', () => {
		admit();
		expect(peekJoinMedia(ROOM)).toEqual({
			audio_enabled: true,
			video_enabled: true
		});
	});

	it('passes nothing when the check could not run, so the call asks the browser', () => {
		blocker.current = 'permissionDenied';
		rememberJoinMedia(ROOM, { audio_enabled: true, video_enabled: true });
		admit();
		expect(peekJoinMedia(ROOM)).toBeNull();
	});

	describe('let in before the device check has settled', () => {
		const handOver = (settle?: () => void) => {
			vi.useFakeTimers();
			devices.settled = false;
			devices.cameraAvailable = true;
			let atHandover: unknown = 'not handed over';
			const onAdmitted = vi.fn(() => {
				atHandover = peekJoinMedia(ROOM);
			});
			const view = render(
				<DirectLinkKnock
					knock={knock}
					onDone={vi.fn()}
					onAdmitted={onAdmitted}
				/>
			);
			if (settle) {
				settle();
				view.rerender(
					<DirectLinkKnock
						knock={knock}
						onDone={vi.fn()}
						onAdmitted={onAdmitted}
					/>
				);
			}
			act(() => {
				vi.advanceTimersByTime(2_000);
			});
			expect(onAdmitted).toHaveBeenCalledOnce();
			return atHandover;
		};

		it('starts a video knock on a device without a camera with video off', () => {
			expect(
				handOver(() => {
					devices.settled = true;
					devices.cameraAvailable = false;
				})
			).toEqual({ audio_enabled: true, video_enabled: false });
		});

		it('takes the camera once the check finds one', () => {
			expect(
				handOver(() => {
					devices.settled = true;
				})
			).toEqual({ audio_enabled: true, video_enabled: true });
		});

		it('does not ask for a camera nobody has found yet', () => {
			expect(handOver()).toEqual({
				audio_enabled: true,
				video_enabled: false
			});
		});
	});
});
