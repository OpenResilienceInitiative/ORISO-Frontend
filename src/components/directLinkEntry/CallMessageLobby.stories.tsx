import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test';
import { AUTHORITIES } from '../../globalState';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { callManager } from '../../services/CallManager';
import { MessageItemComponent } from '../message/MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockMessageItemComponentProps,
	mockUserData
} from '../message/MessageItemComponent.mocks';
import {
	desktop1440Globals,
	MessageContextShell,
	phone390Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';
import { DIRECT_LINK_ADMITTED_KEY } from './callMessageKnock';
import { DirectLinkKnockGate } from './DirectLinkKnockGate';
import {
	DIRECT_LINK_SESSIONS_KEY,
	forgetPendingKnock,
	rememberDirectLinkSession
} from './directLinkEntryFlow';
import {
	directLinkMock,
	installDirectLinkMockApi,
	type DirectLinkMockOptions
} from './__storybook__/directLinkMockApi';

/**
 * **Call message lobby, signed in** (FE#1893) — a signed-in person in their
 * own conversation sees a running call as a message and presses
 * "Beitreten". These stories render the production chat row
 * (`MessageItemComponent`, which wires the card's "Beitreten") and the
 * production knock gate mounted in `app.tsx`; only the API and the call
 * window are stand-ins.
 *
 * Who waits in the lobby is the server's call policy (ORISO-UserService
 * `MatrixRtcCallPolicyService`): only an advice seeker whose latest
 * direct-link knock in this conversation is not ADMITTED. A counsellor, a
 * group member and an advice seeker in an ordinary conversation join
 * directly.
 *
 * The API is an in-memory stand-in for ORISO-UserService#1479 on `fetch`;
 * `callManager.joinExistingCall` (opening the call window) is a spy.
 */
const SESSION_ID = 4711;
const ROOM = '!direct:oriso.org';

const runningCall: CallLifecycleMessage = {
	callId: 'call-lobby',
	roomRef: ROOM,
	callRoomId: '!media-lobby:oriso.org',
	state: 'running',
	callType: 'video',
	actorUserId: '@berater:oriso.org',
	participants: [{ userId: '@berater:oriso.org', displayName: 'Frau Berger' }]
};

const asker = mockUserData({
	userId: 'asker-4711',
	userName: 'eule_mika_4821',
	displayName: 'Eule Mika',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
});

const counsellor = mockUserData();

const conversation = mockActiveSession1on1({
	rid: ROOM,
	item: {
		...mockActiveSession1on1().item,
		id: SESSION_ID,
		matrixRoomId: ROOM,
		directLinkMedium: 'VIDEO'
	} as never
});

/** A real, silent microphone track and a camera that is not there. */
const scriptedDevices = () =>
	({
		getUserMedia: (constraints: MediaStreamConstraints) =>
			constraints.video
				? Promise.reject(
						Object.assign(new Error('NotFoundError'), {
							name: 'NotFoundError'
						})
					)
				: Promise.resolve(
						new AudioContext().createMediaStreamDestination().stream
					),
		enumerateDevices: () =>
			Promise.resolve([
				{
					kind: 'audioinput',
					deviceId: 'mic-1',
					label: 'Headset-Mikrofon'
				},
				{ kind: 'audiooutput', deviceId: 'spk-1', label: 'Headset' }
			] as MediaDeviceInfo[])
	}) as unknown as MediaDevices;

/** The server confirms the card: the call is still running. */
const installRunningCallState = () => {
	const inner = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = String(
			typeof input === 'string' || input instanceof URL
				? input
				: input.url
		);
		if (url.includes('/service/matrix/calls/state')) {
			return new Response(
				JSON.stringify({
					sourceRoomId: runningCall.roomRef,
					callId: runningCall.callId,
					callRoomId: runningCall.callRoomId,
					callType: runningCall.callType,
					invitedAt: Date.now() - 60_000,
					durationSeconds: 60,
					state: 'running'
				}),
				{
					status: 200,
					headers: { 'content-type': 'application/json' }
				}
			);
		}
		return inner(input, init);
	};
	return () => {
		globalThis.fetch = inner;
	};
};

const spyOnJoin = () =>
	spyOn(callManager, 'joinExistingCall').mockResolvedValue('joined');
let joinSpy: ReturnType<typeof spyOnJoin> | null = null;
const joinCalls = () => joinSpy?.mock.calls ?? [];

interface LobbySetup {
	api?: DirectLinkMockOptions;
	/** The direct link this device opened the conversation with. */
	linkOnThisDevice?: boolean;
}

const setUp = ({ api = {}, linkOnThisDevice = true }: LobbySetup = {}) => {
	forgetPendingKnock();
	localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
	localStorage.removeItem(DIRECT_LINK_SESSIONS_KEY);
	if (linkOnThisDevice) {
		rememberDirectLinkSession(SESSION_ID, {
			token: 'tok7',
			medium: 'VIDEO'
		});
	}
	const restoreApi = installDirectLinkMockApi(api);
	const restoreState = installRunningCallState();
	joinSpy = spyOnJoin();
	return () => {
		joinSpy?.mockRestore();
		joinSpy = null;
		restoreState();
		restoreApi();
		forgetPendingKnock();
		localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		localStorage.removeItem(DIRECT_LINK_SESSIONS_KEY);
	};
};

type LobbyParameters = {
	userData?: typeof asker;
	compactShell?: boolean;
};

/** The conversation: a message from the counsellor, then the call. */
const ChatRoom = () => (
	<>
		<MessageItemComponent
			{...mockMessageItemComponentProps({
				_id: 'msg-lobby-1',
				rid: ROOM,
				message: 'Ich starte jetzt den Videoanruf, kommen Sie dazu.',
				displayName: 'Frau Berger',
				username: 'berger',
				userId: '@berater:oriso.org',
				askerMatrixUserId: MOCK_ASKER_MATRIX_ID
			})}
		/>
		<MessageItemComponent
			{...mockMessageItemComponentProps({
				_id: 'msg-lobby-call',
				rid: ROOM,
				callLifecycle: runningCall
			})}
		/>
		<DirectLinkKnockGate
			pollMs={400}
			deps={{ mediaDevices: scriptedDevices() }}
		/>
	</>
);

const meta: Meta = {
	title: 'Entry flows/Call message lobby (signed in)',
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: `/sessions/user/view/session/${SESSION_ID}` }
	},
	decorators: [
		(Story, { parameters }) => (
			<MessageContextShell
				compact={Boolean((parameters as LobbyParameters).compactShell)}
				activeSession={conversation}
				userData={(parameters as LobbyParameters).userData ?? asker}
			>
				<Story />
			</MessageContextShell>
		)
	],
	render: () => <ChatRoom />
};
export default meta;

type Story = StoryObj;

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const pressJoin = async (canvasElement: HTMLElement) =>
	userEvent.click(
		await within(canvasElement).findByRole('button', {
			name: /Beitreten|Join call/
		})
	);

const WAITING = 'Kurz warten, bis Sie hereingelassen werden';

const lobby = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId('knock-wait-dialog');

/** Visible once the open fade (dialog) or enter animation (chat row) is over. */
const expectVisible = async (element: HTMLElement | Promise<HTMLElement>) => {
	const el = await element;
	await waitFor(() => expect(el).toBeVisible());
};

/** The fade has finished, so the audit reads the dialog, not the chat behind. */
const expectSettled = async (canvasElement: HTMLElement) => {
	const container = (await lobby(canvasElement)).closest(
		'.MuiDialog-container'
	)!;
	await waitFor(() => expect(getComputedStyle(container).opacity).toBe('1'));
};

/** Phone: the lobby sits on the bottom edge, full width. */
const expectBottomSheet = async (canvasElement: HTMLElement) => {
	const box = (await lobby(canvasElement)).getBoundingClientRect();
	const view = canvasElement.ownerDocument.defaultView!;
	await expect(Math.round(box.bottom)).toBe(view.innerHeight);
	await expect(Math.round(box.width)).toBe(view.innerWidth);
};

/** Desktop: a dialog in the middle of the screen, not a sheet. */
const expectCentred = async (canvasElement: HTMLElement) => {
	const box = (await lobby(canvasElement)).getBoundingClientRect();
	const view = canvasElement.ownerDocument.defaultView!;
	await expect(box.width).toBeLessThan(view.innerWidth / 2);
	await expect(
		Math.abs(box.left + box.width / 2 - view.innerWidth / 2)
	).toBeLessThan(2);
	await expect(box.bottom).toBeLessThan(view.innerHeight);
};

const knockRequests = () =>
	directLinkMock().requests.map(
		(request) => `${request.method} ${request.path}`
	);

export const WaitThenLetIn: Story = {
	name: '1 · Beitreten → lobby → let in → the call opens (desktop)',
	globals: desktop1440Globals,
	beforeEach: () =>
		setUp({ api: { knockAnswers: ['PENDING', 'PENDING', 'ADMITTED'] } }),
	play: async ({ canvasElement }) => {
		const body = page(canvasElement);
		await pressJoin(canvasElement);
		await expectVisible(
			await body.findByRole('heading', { name: WAITING })
		);
		// Desktop: a centred dialog, not the phone's bottom sheet.
		await expectSettled(canvasElement);
		await expectCentred(canvasElement);
		// Minimal controls: mic and camera, nothing else.
		await expectVisible(body.getByTestId('toggle-mic'));
		await expect(body.getByTestId('toggle-camera')).toBeInTheDocument();
		await expect(joinCalls()).toHaveLength(0);
		await waitFor(
			() =>
				expect(
					body.getByRole('heading', {
						name: 'Sie wurden hereingelassen'
					})
				).toBeVisible(),
			{ timeout: 5000 }
		);
		await waitFor(() => expect(joinCalls()).toHaveLength(1), {
			timeout: 4000
		});
		// The running call is joined, never a new one started.
		await expect(joinCalls()[0][0]).toMatchObject({
			callId: runningCall.callId
		});
	}
};

export const WaitPhone: Story = {
	name: '2 · Beitreten → lobby as a bottom sheet (phone 390)',
	globals: phone390Globals,
	parameters: { compactShell: true },
	beforeEach: () => setUp(),
	play: async ({ canvasElement }) => {
		await pressJoin(canvasElement);
		await expectVisible(
			await page(canvasElement).findByRole('heading', { name: WAITING })
		);
		await expectSettled(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const TurnedDown: Story = {
	name: '3 · Beitreten → lobby → turned down → clear message, no call',
	globals: desktop1440Globals,
	beforeEach: () => setUp({ api: { knockAnswers: ['PENDING', 'DECLINED'] } }),
	play: async ({ canvasElement }) => {
		const body = page(canvasElement);
		await pressJoin(canvasElement);
		await waitFor(
			() =>
				expect(
					body.getByRole('heading', { name: 'Gerade geht es nicht' })
				).toBeVisible(),
			{ timeout: 5000 }
		);
		await userEvent.click(body.getByTestId('knock-wait-close'));
		await waitFor(() =>
			expect(body.queryByTestId('knock-wait-dialog')).toBeNull()
		);
		await expect(joinCalls()).toHaveLength(0);
		// The call message is still there to try again.
		await expectVisible(
			within(canvasElement).getByRole('button', {
				name: /Beitreten|Join call/
			})
		);
	}
};

export const StopWaiting: Story = {
	name: '4 · "Nicht mehr warten" closes the lobby; the call message stays',
	globals: phone390Globals,
	parameters: { compactShell: true },
	beforeEach: () => setUp(),
	play: async ({ canvasElement }) => {
		const body = page(canvasElement);
		await pressJoin(canvasElement);
		await userEvent.click(
			await body.findByRole('button', { name: 'Nicht mehr warten' })
		);
		await waitFor(() =>
			expect(body.queryByTestId('knock-wait-dialog')).toBeNull()
		);
		await expect(joinCalls()).toHaveLength(0);
		await expect(knockRequests()).toContainEqual(
			expect.stringMatching(/^DELETE .*\/call-knocks\/mine\/\d+$/)
		);
		await expectVisible(
			within(canvasElement).getByRole('button', {
				name: /Beitreten|Join call/
			})
		);
	}
};

export const TurnedDownBeforeOnAnotherDevice: Story = {
	name: '5 · Turned down before, link not on this device → the refusal, no dead "Erneut anklopfen"',
	globals: desktop1440Globals,
	beforeEach: () =>
		setUp({ api: { ownKnock: 'DECLINED' }, linkOnThisDevice: false }),
	play: async ({ canvasElement }) => {
		const body = page(canvasElement);
		await pressJoin(canvasElement);
		await expectVisible(
			await body.findByRole('heading', { name: 'Gerade geht es nicht' })
		);
		// Without the link this device cannot knock again: only "Schließen".
		await expect(body.queryByTestId('knock-wait-again')).toBeNull();
		// The server would refuse the call: it is never opened.
		await expect(joinCalls()).toHaveLength(0);
		await userEvent.click(body.getByTestId('knock-wait-close'));
		await waitFor(() =>
			expect(body.queryByTestId('knock-wait-dialog')).toBeNull()
		);
		await expect(joinCalls()).toHaveLength(0);
	}
};

export const WithdrewBeforeOnAnotherDevice: Story = {
	name: '6 · Stopped waiting on another device, link not here → no broken call',
	globals: desktop1440Globals,
	beforeEach: () =>
		setUp({ api: { ownKnock: 'CANCELLED' }, linkOnThisDevice: false }),
	play: async ({ canvasElement }) => {
		await pressJoin(canvasElement);
		// The card says it cannot join instead of opening a call the server refuses.
		await expectVisible(
			await within(canvasElement).findByText(
				/Der Beitritt ist gerade nicht möglich/
			)
		);
		await expect(joinCalls()).toHaveLength(0);
		await expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull();
	}
};

export const CounsellorJoinsDirectly: Story = {
	name: '7 · Counsellor → joins directly, no lobby',
	globals: desktop1440Globals,
	parameters: { userData: counsellor },
	beforeEach: () => setUp(),
	play: async ({ canvasElement }) => {
		await pressJoin(canvasElement);
		await waitFor(() => expect(joinCalls()).toHaveLength(1));
		await expect(knockRequests()).toHaveLength(0);
		await expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull();
	}
};

export const OrdinaryConversationJoinsDirectly: Story = {
	name: '8 · Advice seeker, never knocked here → joins directly, no lobby',
	globals: phone390Globals,
	parameters: { compactShell: true },
	beforeEach: () => setUp({ linkOnThisDevice: false }),
	play: async ({ canvasElement }) => {
		await pressJoin(canvasElement);
		await waitFor(() => expect(joinCalls()).toHaveLength(1));
		await expect(knockRequests()).toEqual([
			expect.stringMatching(/^GET .*\/call-knocks\/mine$/)
		]);
		await expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull();
	}
};
