// @vitest-environment oriso-jsdom

import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { forgetAllJoinMedia, peekJoinMedia } from '../call/prejoin/callPrejoin';
import type { CallJoinResult } from './callMessageKnock';
import type { PendingKnock } from './directLinkEntryFlow';
import type { ConfirmLeaveRunningCall } from './DirectLinkKnockGate';

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
	joinRunningCall: (knock: PendingKnock) => Promise<CallJoinResult>,
	joinCounsellorsCall: (
		knock: PendingKnock,
		options?: { confirmLeaveRunningCall?: ConfirmLeaveRunningCall }
	) => Promise<CallJoinResult> = () => Promise.resolve('joined')
) => {
	rememberPendingKnock(pending);
	const addNotification = vi.fn();
	render(
		<NotificationsContext.Provider value={{ addNotification } as never}>
			<MemoryRouter initialEntries={['/sessions/user/view']}>
				<DirectLinkKnockGate
					deps={{
						joinRunningCall,
						joinCounsellorsCall
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

describe('DirectLinkKnockGate when the person is let in from the direct link', () => {
	afterEach(() => {
		cleanup();
		forgetAllJoinMedia();
		sessionStorage.clear();
	});

	const fromLink: PendingKnock = { ...knock, joinExisting: false };

	it("joins the counsellor's call and says nothing when it came", async () => {
		const join = vi.fn(() => Promise.resolve<CallJoinResult>('joined'));
		const runningCall = vi.fn(() =>
			Promise.resolve<CallJoinResult>('joined')
		);
		const addNotification = letIn(fromLink, runningCall, join);
		await waitFor(
			() =>
				expect(join).toHaveBeenCalledWith(fromLink, expect.anything()),
			{
				timeout: 2_000
			}
		);
		await settled();
		expect(runningCall).not.toHaveBeenCalled();
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('says the counsellor starts the call when none came', async () => {
		const addNotification = letIn(fromLink, vi.fn(), () =>
			Promise.resolve<CallJoinResult>('unavailable')
		);
		await waitFor(() => expect(addNotification).toHaveBeenCalledTimes(1), {
			timeout: 2_000
		});
		expect(addNotification.mock.calls[0][0]).toMatchObject({
			notificationType: 'info',
			title: 'videoCall.timeline.counsellorCallPending',
			text: 'videoCall.timeline.counsellorCallPendingText'
		});
		expect(peekJoinMedia(ROOM)).toBeNull();
	});
});

describe('DirectLinkKnockGate when the person is let in during another call', () => {
	afterEach(() => {
		cleanup();
		forgetAllJoinMedia();
		sessionStorage.clear();
	});

	const fromLink: PendingKnock = { ...knock, joinExisting: false };

	/* The counsellor's call waits behind the running one: the join asks. */
	const askingJoin = () =>
		vi.fn(
			async (
				_: PendingKnock,
				options?: { confirmLeaveRunningCall?: ConfirmLeaveRunningCall }
			): Promise<CallJoinResult> =>
				(await options?.confirmLeaveRunningCall?.(
					new AbortController().signal
				))
					? 'joined'
					: 'unavailable'
		);

	it('asks first and joins on yes, without a notice', async () => {
		const join = askingJoin();
		const addNotification = letIn(fromLink, vi.fn(), join);
		const leave = await screen.findByTestId(
			'leave-running-call-confirm',
			{},
			{ timeout: 2_000 }
		);
		expect(
			screen.getByText('videoCall.timeline.leaveRunningCallTitle')
		).toBeTruthy();
		fireEvent.click(leave);
		await waitFor(() =>
			expect(screen.queryByTestId('leave-running-call-dialog')).toBeNull()
		);
		await expect(join.mock.results[0].value).resolves.toBe('joined');
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('stays on no and says the counsellor’s call has not started', async () => {
		const join = askingJoin();
		const addNotification = letIn(fromLink, vi.fn(), join);
		fireEvent.click(
			await screen.findByTestId(
				'leave-running-call-stay',
				{},
				{ timeout: 2_000 }
			)
		);
		await waitFor(() => expect(addNotification).toHaveBeenCalledTimes(1));
		expect(addNotification.mock.calls[0][0]).toMatchObject({
			title: 'videoCall.timeline.counsellorCallPending'
		});
		expect(screen.queryByTestId('leave-running-call-dialog')).toBeNull();
	});

	it('withdraws the question when it no longer applies', async () => {
		const asked = new AbortController();
		const join = vi.fn(
			async (
				_: PendingKnock,
				options?: { confirmLeaveRunningCall?: ConfirmLeaveRunningCall }
			): Promise<CallJoinResult> => {
				void options?.confirmLeaveRunningCall?.(asked.signal);
				return new Promise(() => undefined);
			}
		);
		letIn(fromLink, vi.fn(), join);
		await screen.findByTestId(
			'leave-running-call-dialog',
			{},
			{ timeout: 2_000 }
		);
		asked.abort();
		await waitFor(() =>
			expect(screen.queryByTestId('leave-running-call-dialog')).toBeNull()
		);
	});
});
