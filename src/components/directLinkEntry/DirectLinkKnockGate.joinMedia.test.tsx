// @vitest-environment oriso-jsdom

import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	forgetAllJoinMedia,
	peekJoinMedia,
	rememberJoinMedia
} from '../call/prejoin/callPrejoin';

const blocker = vi.hoisted(() => ({ current: undefined as unknown }));
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
		cameraAvailable: true,
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
});
