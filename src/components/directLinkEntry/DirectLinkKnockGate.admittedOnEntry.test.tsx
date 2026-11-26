// @vitest-environment oriso-jsdom
/**
 * FE#2542: let in while waiting on the link page, the person gets no knock
 * dialog a second time in the app: the call opens with that page's switches.
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsContext } from '../../globalState';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

vi.mock('../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: () => <div data-testid="knock-dialog" />
}));
vi.mock('./useDirectLinkKnock', () => ({
	useDirectLinkKnock: () => ({
		knockId: 21,
		phase: 'waiting',
		gone: false,
		inactive: false,
		paused: false,
		cancel: vi.fn(),
		knockAgain: vi.fn(),
		close: vi.fn()
	})
}));
vi.mock('../waitingRoom/callEntry/useCallDeviceCheck', () => ({
	useCallDeviceCheck: () => ({
		check: { devices: { microphone: [], camera: [], speaker: [] } },
		controls: { micOn: true, cameraOn: true, selection: {} },
		cameraAvailable: true,
		settled: true,
		blocker: undefined,
		retry: vi.fn()
	})
}));
const inCall = vi.hoisted(() => ({ current: false }));
vi.mock('../../services/CallManager', () => ({
	callManager: {
		hasActiveCall: () => inCall.current,
		getCurrentCall: () => null,
		getWaitingCall: () => null,
		subscribe: () => () => undefined,
		answerCall: vi.fn(),
		answerWaitingCall: vi.fn(),
		joinExistingCall: vi.fn()
	}
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { DirectLinkKnockGate } = await import('./DirectLinkKnockGate');
const { PENDING_KNOCK_KEY, readPendingKnock } = await import(
	'./directLinkEntryFlow'
);
const { wasAdmittedTo } = await import('./directLinkEntryFlow');
const { shouldAutoJoinCall } = await import(
	'../groupChat/waitingAdmission/callAutoJoin'
);
const { forgetAllJoinMedia, peekCameraSwitch, peekJoinMedia } = await import(
	'../call/prejoin/callPrejoin'
);

const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO',
	status: 'ADMITTED',
	admittedOnEntry: true,
	entryMedia: {
		media: { audio_enabled: true, video_enabled: false },
		cameraSwitch: false,
		selection: {}
	}
};

const addNotification = vi.fn();
const mount = (joinCounsellorsCall = vi.fn().mockResolvedValue('joined')) => {
	render(
		<NotificationsContext.Provider
			value={{ addNotification } as unknown as never}
		>
			<MemoryRouter initialEntries={['/sessions/user/view/abc/9']}>
				<DirectLinkKnockGate deps={{ joinCounsellorsCall }} />
			</MemoryRouter>
		</NotificationsContext.Provider>
	);
	return joinCounsellorsCall;
};

describe('the knock gate after a wait on the link page', () => {
	beforeEach(() => {
		sessionStorage.clear();
		localStorage.clear();
		forgetAllJoinMedia();
		inCall.current = false;
		addNotification.mockClear();
	});
	afterEach(cleanup);

	it('opens the call at once and shows no dialog', async () => {
		sessionStorage.setItem(PENDING_KNOCK_KEY, JSON.stringify(knock));
		const joinCounsellorsCall = mount();
		await waitFor(() => expect(joinCounsellorsCall).toHaveBeenCalledOnce());
		expect(joinCounsellorsCall.mock.calls[0][0]).toMatchObject({
			knockId: 21,
			sessionId: 9
		});
		expect(screen.queryByTestId('knock-dialog')).toBeNull();
		expect(readPendingKnock()).toBeNull();
		expect(wasAdmittedTo(9)).toBe(true);
		// A call that no longer rings is joined through its card.
		expect(shouldAutoJoinCall(9)).toBe(true);
	});

	it('gives the call the switches of the link page', async () => {
		sessionStorage.setItem(PENDING_KNOCK_KEY, JSON.stringify(knock));
		const joinCounsellorsCall = vi.fn(
			() => new Promise<'joined'>(() => undefined)
		);
		mount(joinCounsellorsCall);
		await waitFor(() => expect(joinCounsellorsCall).toHaveBeenCalled());
		expect(peekJoinMedia('!room:oriso')).toEqual({
			audio_enabled: true,
			video_enabled: false
		});
		expect(peekCameraSwitch('!room:oriso')).toBe(false);
	});

	it('does not report a missing call while the person is in one', async () => {
		sessionStorage.setItem(PENDING_KNOCK_KEY, JSON.stringify(knock));
		inCall.current = true;
		const joinCounsellorsCall = mount(
			vi.fn().mockResolvedValue('unavailable')
		);
		await waitFor(() => expect(joinCounsellorsCall).toHaveBeenCalled());
		await Promise.resolve();
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('says so when no call came at all', async () => {
		sessionStorage.setItem(PENDING_KNOCK_KEY, JSON.stringify(knock));
		mount(vi.fn().mockResolvedValue('unavailable'));
		await waitFor(() =>
			expect(addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'videoCall.timeline.counsellorCallPending'
				})
			)
		);
	});

	it('still shows the dialog for a knock from inside the app', () => {
		sessionStorage.setItem(
			PENDING_KNOCK_KEY,
			JSON.stringify({
				...knock,
				status: 'PENDING',
				admittedOnEntry: undefined,
				entryMedia: undefined
			})
		);
		const joinCounsellorsCall = mount();
		expect(screen.getByTestId('knock-dialog')).toBeTruthy();
		expect(joinCounsellorsCall).not.toHaveBeenCalled();
	});
});
