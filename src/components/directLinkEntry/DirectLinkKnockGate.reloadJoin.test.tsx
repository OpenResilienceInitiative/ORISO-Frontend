// @vitest-environment oriso-jsdom

import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { forgetAllJoinMedia, peekJoinMedia } from '../call/prejoin/callPrejoin';
import type { CallJoinResult } from './callMessageKnock';
import type { PendingKnock } from './directLinkEntryFlow';

vi.mock('./useDirectLinkKnock', () => ({
	useDirectLinkKnock: () => ({
		knockId: 21,
		phase: 'admitted',
		gone: false,
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
		controls: { micOn: false, cameraOn: true, selection: {} },
		cameraAvailable: true,
		settled: true,
		retry: vi.fn()
	})
}));

const { DirectLinkKnockGate } = await import('./DirectLinkKnockGate');
const { readPendingKnock, rememberPendingKnock } = await import(
	'./directLinkEntryFlow'
);

const ROOM = '!room:oriso';
const call = {
	callId: 'c1',
	state: 'running',
	roomRef: ROOM,
	callRoomId: '!call:oriso',
	callType: 'video',
	isGroup: false
} as PendingKnock['joinCall'];

const knock: PendingKnock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: ROOM,
	medium: 'VIDEO',
	status: 'PENDING',
	joinExisting: true
};

const letIn = (
	pending: PendingKnock,
	joinRunningCall: (knock: PendingKnock) => Promise<CallJoinResult>
) => {
	rememberPendingKnock(pending);
	const addNotification = vi.fn();
	render(
		<NotificationsContext.Provider value={{ addNotification } as never}>
			<MemoryRouter initialEntries={['/sessions/user/view']}>
				<DirectLinkKnockGate
					deps={{
						joinRunningCall,
						startCall: vi.fn(() => Promise.resolve())
					}}
				/>
			</MemoryRouter>
		</NotificationsContext.Provider>
	);
	expect(readPendingKnock()).toBeNull();
	return addNotification;
};

const settled = () =>
	new Promise((done) => {
		window.setTimeout(done, 1_300);
	});

describe('DirectLinkKnockGate when the person is let in after a reload', () => {
	afterEach(() => {
		cleanup();
		forgetAllJoinMedia();
		sessionStorage.clear();
	});

	it('keeps the switches for the call it joins', async () => {
		const join = vi.fn(() => Promise.resolve('joined' as const));
		const addNotification = letIn({ ...knock, joinCall: call }, join);
		await waitFor(() => expect(join).toHaveBeenCalled(), {
			timeout: 2_000
		});
		await settled();
		expect(addNotification).not.toHaveBeenCalled();
		expect(peekJoinMedia(ROOM)?.audio_enabled).toBe(false);
	});

	it.each([
		['refused', () => Promise.resolve<CallJoinResult>('ended')],
		['failed', () => Promise.reject(new Error('no room'))]
	])('says so and keeps no choice when the join %s', async (_, outcome) => {
		const addNotification = letIn({ ...knock, joinCall: call }, outcome);
		await waitFor(() => expect(addNotification).toHaveBeenCalledTimes(1), {
			timeout: 2_000
		});
		expect(addNotification.mock.calls[0][0].notificationType).toBe('error');
		expect(peekJoinMedia(ROOM)).toBeNull();
	});

	it('keeps no choice when no call is on record to join', async () => {
		const join = vi.fn(() => Promise.resolve('joined' as const));
		letIn(knock, join);
		await settled();
		expect(join).not.toHaveBeenCalled();
		expect(peekJoinMedia(ROOM)).toBeNull();
	});
});
