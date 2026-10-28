import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Stage } from '../stage/stage';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { AgencySpecificContext, UserDataContext } from '../../globalState';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { storyLegalLinks as legalLinks } from '../waitingRoom/storyLegalLinks';
import {
	desktop1440Globals,
	phone390Globals,
	withMessageShell
} from '../message/messageStoryShell';
import { CallTimelineMessage } from '../message/CallTimelineMessage';
import '../message/message.styles.scss';
import {
	DIRECT_LINK_ADMITTED_KEY,
	joinOrKnock,
	rememberAdmittedConversation,
	wasAdmittedTo
} from './callMessageKnock';
import { DirectLinkCallEntry } from './DirectLinkCallEntry';
import { DirectLinkKnock, DirectLinkKnockGate } from './DirectLinkKnockGate';
import {
	forgetPendingKnock,
	rememberDirectLinkSession,
	type PendingKnock
} from './directLinkEntryFlow';
import {
	directLinkMock,
	installDirectLinkMockApi
} from './__storybook__/directLinkMockApi';

/**
 * **Direct link, wired** (#1795, FE#1893) — the person's side of a
 * counsellor's audio or video direct link, on the built parts only:
 *
 * 1. Without an account: the call entry (#1386) on real (here scripted)
 *    devices. "Beitreten" creates the account and opens the person's own
 *    conversation.
 * 2. In the app, over that conversation: the knock wait dialog (#1834),
 *    polling `GET /users/call-knocks/mine/{id}` until the counsellor lets the
 *    person in (then the call starts) or turns them down.
 * 3. Later, a running call's card in that conversation knocks the same way
 *    and joins that call once the person is let in (FE#1893).
 *
 * The API is an in-memory stand-in for ORISO-UserService#1479 on `fetch`;
 * account creation and entering the app are spies.
 */
const meta: Meta = {
	title: 'Entry flows/Direct link/Wired (mocked API)',
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<GlobalComponentContext.Provider value={{ Stage } as never}>
				<LegalLinksContext.Provider value={legalLinks}>
					<AgencySpecificContext.Provider
						value={{
							specificAgency: null,
							setSpecificAgency: () => undefined
						}}
					>
						<UserDataContext.Provider
							value={
								{
									userData: {
										userId: 'u-1',
										userName: 'eule_mika_4821'
									},
									setUserData: () => undefined
								} as never
							}
						>
							<Box sx={{ minHeight: '100vh' }}>
								<Story />
							</Box>
						</UserDataContext.Provider>
					</AgencySpecificContext.Provider>
				</LegalLinksContext.Provider>
			</GlobalComponentContext.Provider>
		)
	]
};
export default meta;

type Story = StoryObj;

/** A real, silent microphone track; no webcam. */
const silentMicrophone = () =>
	new AudioContext().createMediaStreamDestination().stream;

const scriptedDevices = () =>
	({
		getUserMedia: (constraints: MediaStreamConstraints) =>
			constraints.video
				? Promise.reject(
						Object.assign(new Error('NotFoundError'), {
							name: 'NotFoundError'
						})
					)
				: Promise.resolve(silentMicrophone()),
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

const knock: PendingKnock = {
	token: 'tok7',
	knockId: 501,
	sessionId: 4711,
	matrixRoomId: '!direct:oriso.org',
	medium: 'VIDEO',
	status: 'PENDING'
};

const dialog = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

/* ---------- Call guest without an account ---------- */

const callGuestRegister = fn();
const callGuestOpen = fn();

export const CallGuestVideo: Story = {
	name: '1 · Video link, no account: call entry creates it',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => (
		<DirectLinkCallEntry
			token="tok7"
			modality="video"
			context={{
				tenantId: 1,
				agencyId: null,
				consultingTypeId: 3,
				topicId: 4,
				chatType: 'VIDEO',
				temporaryAccount: true,
				admission: 'KNOCK'
			}}
			deps={{
				register: async (account) => {
					callGuestRegister(account.username, account.password);
				},
				open: async (token) => {
					callGuestOpen(token);
				},
				mediaDevices: scriptedDevices()
			}}
		/>
	),
	play: async ({ canvasElement, canvas }) => {
		const body = dialog(canvasElement);
		const gate = () =>
			canvasElement.ownerDocument.querySelector<HTMLElement>(
				'[data-cy="call-entry-gate"]'
			)!;
		await canvas.findByTestId('call-entry-room');
		// The built room: identity, then the device check on real devices.
		await userEvent.click(canvas.getByRole('button', { name: 'Passwort' }));
		// A silent fixture microphone is never "heard": muted on purpose.
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Mikrofon',
				pressed: true
			})
		);
		await waitFor(() =>
			expect(gate().getAttribute('data-cy-state')).toBe('ready')
		);
		await userEvent.click(gate());
		await userEvent.click(await body.findByRole('checkbox'));
		await userEvent.click(gate());
		await waitFor(() => expect(callGuestOpen).toHaveBeenCalledWith('tok7'));
		const [username, password] = callGuestRegister.mock.calls.at(-1)!;
		await expect(username).toMatch(/\S{3,}/);
		await expect(String(password).length).toBeGreaterThanOrEqual(8);
	}
};

/* ---------- Knock over the conversation ---------- */

const admitted = fn();
const done = fn();

export const KnockLetIn: Story = {
	name: '2 · Knock wait → let in → call starts',
	globals: desktop1440Globals,
	beforeEach: () => {
		admitted.mockClear();
		return installDirectLinkMockApi({
			knockAnswers: ['PENDING', 'PENDING', 'ADMITTED']
		});
	},
	render: () => (
		<DirectLinkKnock
			knock={knock}
			pollMs={400}
			deps={{ mediaDevices: scriptedDevices() }}
			onDone={done}
			onAdmitted={admitted}
		/>
	),
	play: async ({ canvasElement }) => {
		const body = dialog(canvasElement);
		await waitFor(() =>
			expect(
				body.getByText('Kurz warten, bis Sie hereingelassen werden')
			).toBeVisible()
		);
		await waitFor(
			() =>
				expect(
					body.getByText('Sie wurden hereingelassen')
				).toBeVisible(),
			{ timeout: 5000 }
		);
		await waitFor(() => expect(admitted).toHaveBeenCalledWith(knock), {
			timeout: 4000
		});
		const polls = directLinkMock().requests.filter(
			(request) => request.method === 'GET'
		);
		await expect(polls[0].path).toMatch(/\/call-knocks\/mine\/501$/);
	}
};

export const KnockTurnedDown: Story = {
	name: '3 · Knock wait → turned down → knock again',
	globals: phone390Globals,
	beforeEach: () =>
		installDirectLinkMockApi({ knockAnswers: ['DECLINED', 'PENDING'] }),
	render: () => (
		<DirectLinkKnock
			knock={knock}
			pollMs={400}
			deps={{ mediaDevices: scriptedDevices() }}
			onDone={done}
			onAdmitted={admitted}
		/>
	),
	play: async ({ canvasElement }) => {
		const body = dialog(canvasElement);
		await waitFor(
			() => expect(body.getByText('Gerade geht es nicht')).toBeVisible(),
			{ timeout: 4000 }
		);
		await userEvent.click(
			body.getByRole('button', { name: 'Erneut anklopfen' })
		);
		await waitFor(() =>
			expect(
				body.getByText('Kurz warten, bis Sie hereingelassen werden')
			).toBeVisible()
		);
		await waitFor(() =>
			expect(
				directLinkMock().requests.some(
					(request) =>
						request.method === 'POST' &&
						request.path.endsWith('/invitelinks/tok7/conversations')
				)
			).toBe(true)
		);
	}
};

const withdrawn = fn();

export const KnockWithdrawn: Story = {
	name: '4 · Knock wait → "Nicht mehr warten" withdraws the knock',
	globals: desktop1440Globals,
	beforeEach: () => {
		withdrawn.mockClear();
		return installDirectLinkMockApi({ knockAnswers: ['PENDING'] });
	},
	render: () => (
		<DirectLinkKnock
			knock={knock}
			pollMs={400}
			deps={{ mediaDevices: scriptedDevices() }}
			onDone={withdrawn}
			onAdmitted={admitted}
		/>
	),
	play: async ({ canvasElement }) => {
		const body = dialog(canvasElement);
		await userEvent.click(
			await body.findByRole('button', { name: 'Nicht mehr warten' })
		);
		await waitFor(() => expect(withdrawn).toHaveBeenCalled());
		await expect(
			directLinkMock().requests.some(
				(request) =>
					request.method === 'DELETE' &&
					request.path.endsWith('/call-knocks/mine/501')
			)
		).toBe(true);
	}
};

/* ---------- Running call's card in a direct-link conversation ---------- */

const joinRunningCall = fn(async () => 'joined' as const);
const startNewCall = fn(async () => undefined);

export const KnockFromCallMessage: Story = {
	name: "5 · Running call's card → knock → let in → joins that call",
	globals: desktop1440Globals,
	parameters: { router: { initialPath: '/sessions/user/view/4711' } },
	decorators: [(Story) => withMessageShell(Story, { parameters: {} })],
	beforeEach: () => {
		joinRunningCall.mockClear();
		startNewCall.mockClear();
		forgetPendingKnock();
		localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		rememberDirectLinkSession(4711, { token: 'tok7', medium: 'VIDEO' });
		return installDirectLinkMockApi({
			knockAnswers: ['PENDING', 'PENDING', 'ADMITTED']
		});
	},
	render: () => (
		<>
			<CallTimelineMessage
				call={{
					callId: 'call-direct',
					roomRef: '!direct:oriso.org',
					callRoomId: '!media:oriso.org',
					state: 'running',
					callType: 'video',
					participants: [
						{
							userId: '@berater:oriso.org',
							displayName: 'Frau Berger'
						}
					]
				}}
				onJoin={() => joinOrKnock(4711, joinRunningCall)}
			/>
			<DirectLinkKnockGate
				pollMs={400}
				deps={{
					mediaDevices: scriptedDevices(),
					startCall: startNewCall
				}}
			/>
		</>
	),
	play: async ({ canvasElement, canvas }) => {
		const body = dialog(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: /Beitreten|Join call/ })
		);
		await waitFor(() =>
			expect(
				body.getByText('Kurz warten, bis Sie hereingelassen werden')
			).toBeVisible()
		);
		await expect(joinRunningCall).not.toHaveBeenCalled();
		await expect(
			directLinkMock().requests.find((request) =>
				request.path.endsWith('/invitelinks/tok7/conversations')
			)
		).toMatchObject({ method: 'POST' });
		await waitFor(
			() =>
				expect(
					body.getByText('Sie wurden hereingelassen')
				).toBeVisible(),
			{ timeout: 5000 }
		);
		await waitFor(() => expect(joinRunningCall).toHaveBeenCalledOnce(), {
			timeout: 4000
		});
		await expect(startNewCall).not.toHaveBeenCalled();
		// Let in once: the next call in this conversation joins directly.
		await expect(wasAdmittedTo(4711)).toBe(true);
	}
};

const RunningCallCard = () => (
	<CallTimelineMessage
		call={{
			callId: 'call-direct-2',
			roomRef: '!direct:oriso.org',
			callRoomId: '!media2:oriso.org',
			state: 'running',
			callType: 'video',
			participants: [
				{ userId: '@berater:oriso.org', displayName: 'Frau Berger' }
			]
		}}
		onJoin={() => joinOrKnock(4711, joinRunningCall)}
	/>
);

export const CallMessageAfterAdmission: Story = {
	name: "6 · Let in before: a later call's card joins without knocking",
	globals: phone390Globals,
	parameters: { router: { initialPath: '/sessions/user/view/4711' } },
	decorators: [(Story) => withMessageShell(Story, { parameters: {} })],
	beforeEach: () => {
		joinRunningCall.mockClear();
		forgetPendingKnock();
		rememberDirectLinkSession(4711, { token: 'tok7', medium: 'VIDEO' });
		rememberAdmittedConversation(4711);
		const restore = installDirectLinkMockApi();
		return () => {
			restore();
			localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		};
	},
	render: () => (
		<>
			<RunningCallCard />
			<DirectLinkKnockGate deps={{ mediaDevices: scriptedDevices() }} />
		</>
	),
	play: async ({ canvasElement, canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', { name: /Beitreten|Join call/ })
		);
		await waitFor(() => expect(joinRunningCall).toHaveBeenCalledOnce());
		await expect(directLinkMock().requests).toHaveLength(0);
		await expect(
			dialog(canvasElement).queryByText(
				'Kurz warten, bis Sie hereingelassen werden'
			)
		).toBeNull();
	}
};

export const CallMessageAdmittedElsewhere: Story = {
	name: '7 · Let in on another device: the server says so, the card joins',
	globals: phone390Globals,
	parameters: { router: { initialPath: '/sessions/user/view/4711' } },
	decorators: [(Story) => withMessageShell(Story, { parameters: {} })],
	beforeEach: () => {
		joinRunningCall.mockClear();
		forgetPendingKnock();
		localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		localStorage.removeItem('oriso.directLinkSessions');
		const restore = installDirectLinkMockApi({ ownKnock: 'ADMITTED' });
		return () => {
			restore();
			localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		};
	},
	render: () => (
		<>
			<RunningCallCard />
			<DirectLinkKnockGate deps={{ mediaDevices: scriptedDevices() }} />
		</>
	),
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', { name: /Beitreten|Join call/ })
		);
		await waitFor(() => expect(joinRunningCall).toHaveBeenCalledOnce());
		await expect(
			directLinkMock().requests.map(
				(request) => request.method + ' ' + request.path
			)
		).toEqual([expect.stringMatching(/^GET .*\/call-knocks\/mine$/)]);
	}
};
