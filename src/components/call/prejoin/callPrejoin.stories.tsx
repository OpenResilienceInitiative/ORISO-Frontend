import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useMediaQuery } from '@mui/material';
import {
	desktop1440Globals,
	MessageStoryShell,
	phone390Globals
} from '../../message/messageStoryShell';
import { CallTimelineMessage } from '../../message/CallTimelineMessage';
import '../../message/message.styles.scss';
import type { CallLifecycleMessage } from '../../../utils/callLifecycleMessage';
import { JoinGroupChatView } from '../../groupChat/JoinGroupChatView';
import {
	buildGroupStageListItem,
	GroupChatStage,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	groupStageAsker
} from '../../groupChat/groupChatStageStoryShell';
import { useGroupChatInfoFixture } from '../../groupChat/groupChatInfoStoryFixture';
import type { GroupChatItemInterface } from '../../../globalState/interfaces';
import { expectWaitingRoomLayout } from '../../app/registrationLoader/waitingRoomLayoutContract';
import { forgetAllJoinMedia, peekJoinMedia } from './callPrejoin';
import {
	DIRECT_LINK_ADMITTED_KEY,
	joinOrKnock
} from '../../directLinkEntry/callMessageKnock';
import type { CallKnockStatus } from '../../../api/apiDirectLinks';
import {
	forgetPendingKnock,
	PendingKnock,
	rememberDirectLinkSession,
	rememberPendingKnock
} from '../../directLinkEntry/directLinkEntryFlow';
import { DirectLinkKnockGate } from '../../directLinkEntry/DirectLinkKnockGate';
import {
	directLinkMock,
	installDirectLinkMockApi
} from '../../directLinkEntry/__storybook__/directLinkMockApi';

/* ---------- The browser's devices, faked ---------- */

type DeviceCase = 'ok' | 'permissionDenied' | 'noCamera' | 'noMicrophone';

const LABELS: [MediaDeviceKind, string, string][] = [
	['videoinput', 'cam-1', 'FaceTime HD-Kamera'],
	['videoinput', 'cam-2', 'Logitech C920'],
	['audioinput', 'mic-1', 'MacBook Pro-Mikrofon'],
	['audioinput', 'mic-2', 'Jabra Evolve2 Headset'],
	['audiooutput', 'spk-1', 'MacBook Pro-Lautsprecher']
];

/**
 * Stands in for `navigator.mediaDevices`, so the real check
 * (`useLiveCallDevices`) runs without a permission prompt: a painted canvas
 * as the camera, a silent tone as the microphone, or the browser's refusals.
 */
const fakeMediaDevices = (which: DeviceCase) => {
	const tracks: MediaStreamTrack[] = [];
	const contexts: AudioContext[] = [];
	const refuse = (name: string) =>
		Promise.reject(new DOMException(name, name));
	const mediaDevices = {
		getUserMedia: async ({ video }: MediaStreamConstraints) => {
			if (which === 'permissionDenied') return refuse('NotAllowedError');
			if (which === 'noMicrophone') return refuse('NotFoundError');
			if (video && which === 'noCamera') return refuse('NotFoundError');
			const context = new AudioContext();
			contexts.push(context);
			const own = context.createMediaStreamDestination().stream;
			if (video) {
				const canvas = document.createElement('canvas');
				canvas.width = 640;
				canvas.height = 360;
				const paint = canvas.getContext('2d')!;
				const light = paint.createRadialGradient(
					200,
					90,
					20,
					320,
					180,
					420
				);
				light.addColorStop(0, '#8a7f74');
				light.addColorStop(1, '#2b2a2e');
				paint.fillStyle = light;
				paint.fillRect(0, 0, 640, 360);
				canvas
					.captureStream()
					.getTracks()
					.forEach((t) => own.addTrack(t));
			}
			tracks.push(...own.getTracks());
			return own;
		},
		enumerateDevices: async () =>
			LABELS.filter(
				([kind]) => !(which === 'noCamera' && kind === 'videoinput')
			).map(([kind, deviceId, label]) => ({
				kind,
				deviceId,
				label,
				groupId: deviceId
			})),
		addEventListener: () => undefined,
		removeEventListener: () => undefined
	} as unknown as MediaDevices;
	return { mediaDevices, tracks, contexts };
};

let fake: ReturnType<typeof fakeMediaDevices> | undefined;

/** The app reads `navigator.mediaDevices`; so does this story. */
const withDevices = (which: DeviceCase) => () => {
	fake = fakeMediaDevices(which);
	Object.defineProperty(navigator, 'mediaDevices', {
		value: fake.mediaDevices,
		configurable: true
	});
	return () => {
		// Back to the browser's own (the prototype's getter).
		delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
		fake?.contexts.forEach((context) => void context.close());
		fake = undefined;
		forgetAllJoinMedia();
	};
};

/* ---------- Variant 1: the call message in the chat ---------- */

/** A running video call a counsellor started, as the room records it. */
const runningCall: CallLifecycleMessage = {
	callId: 'call-prejoin',
	roomRef: '!conversation:example',
	callRoomId: '!media:example',
	state: 'running',
	callType: 'video',
	actorUserId: '@berger:example',
	participants: [{ userId: '@berger:example', displayName: 'Frau Berger' }],
	present: [{ userId: '@berger:example', displayName: 'Frau Berger' }]
};

/**
 * The existing chat row with the running call, as the app renders it.
 * `deviceCheck` answers what `MessageItemComponent` asks
 * `shouldShowDeviceCheck`; `onJoin` stands in for `callManager`.
 */
const FromCallMessage = ({ onJoin }: { onJoin: () => void }) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	return (
		<div style={{ display: 'flex', justifyContent: 'center' }}>
			<div style={{ width: '100%', maxWidth: 900 }}>
				<MessageStoryShell compact={phone}>
					<CallTimelineMessage
						call={runningCall}
						deviceCheck={() => true}
						onJoin={(hooks) => {
							// As `joinOrKnock` does: the check closes first.
							hooks?.beforeJoin?.();
							onJoin();
							return Promise.resolve('joined' as const);
						}}
					/>
				</MessageStoryShell>
			</div>
		</div>
	);
};

/* ---------- Variant 2: the circle's pre-lobby ---------- */

const FUTURE_SECONDS = 2 * 86400 + 3 * 3600 + 21 * 60 + 50;

/**
 * The existing circle pre-lobby of a signed-in advice seeker (clock, start
 * time, "Mehr erfahren", locked "Beitreten"), as `JoinGroupChatView` renders
 * it, now with "Kamera & Mikrofon" in its quiet row.
 */
const CircleLobby = ({
	layout,
	modality = 'VIDEO'
}: {
	layout: 'desktop' | 'mobile';
	/** How the circle meets (`UserChatDTO.modality`). */
	modality?: GroupChatItemInterface['modality'];
}) => {
	const listItem = React.useMemo(() => {
		const item = buildGroupStageListItem(FUTURE_SECONDS);
		const chat = item.chat as GroupChatItemInterface;
		chat.assignedAgencies = [
			{ id: 0, name: 'Beratungsstelle Lichtenberg' }
		] as GroupChatItemInterface['assignedAgencies'];
		chat.modality = modality;
		return item;
	}, [modality]);
	useGroupChatInfoFixture(listItem.chat as GroupChatItemInterface);
	return (
		<GroupChatStage
			listItem={listItem}
			layout={layout}
			viewer={groupStageAsker}
		>
			<JoinGroupChatView />
		</GroupChatStage>
	);
};

/* ---------- Checks ---------- */

/** The dialog lives in a portal, outside the story's canvas. */
const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const dialog = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId('knock-wait-dialog');

const callJoin = (canvasElement: HTMLElement) =>
	page(canvasElement).findByRole('button', { name: /Beitreten|Join call/ });

const circleOption = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId('group-entry-devices');

/** MUI fades the dialog in; screenshots and axe need it settled. */
const expectSettled = async (canvasElement: HTMLElement) => {
	const container = (await dialog(canvasElement)).closest(
		'.MuiDialog-container'
	)!;
	await waitFor(() => expect(getComputedStyle(container).opacity).toBe('1'));
};

const expectClosed = (canvasElement: HTMLElement) =>
	waitFor(() =>
		expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull()
	);

/** The camera and microphone are let go once the dialog closes. */
const expectReleased = () =>
	waitFor(() =>
		expect(fake!.tracks.every((t) => t.readyState === 'ended')).toBe(true)
	);

/** Phone: a bottom sheet, flush with the bottom and both sides. */
const expectBottomSheet = async (canvasElement: HTMLElement) => {
	const surface = await dialog(canvasElement);
	const view = canvasElement.ownerDocument.defaultView!;
	const box = surface.getBoundingClientRect();
	await expect(Math.round(box.bottom)).toBe(view.innerHeight);
	await expect(Math.round(box.width)).toBe(view.innerWidth);
	await expect(surface.scrollWidth).toBeLessThanOrEqual(
		surface.clientWidth + 1
	);
};

/** The preview is live: the picture is on and the pickers are filled. */
const expectLivePreview = async (canvasElement: HTMLElement) => {
	const p = page(canvasElement);
	await waitFor(() => expect(fake!.tracks.length).toBeGreaterThan(1));
	await expect(await p.findByTestId('video-check')).toBeVisible();
	await expect(
		await p.findByRole('button', { name: /^Mikrofon: / })
	).toBeVisible();
};

/**
 * The name chip sits on the camera picture; axe cannot compute contrast over
 * a picture. Scoped exactly as in the knock wait dialog's stories (the phone
 * sheet's title over the chat included); everything else is audited.
 */
const textOnThePicture = {
	a11y: {
		config: {
			rules: [
				{
					id: 'color-contrast',
					selector:
						'*:not([data-testid="video-check"] p):not(.m3Dialog__title)'
				}
			]
		}
	}
};

const meta = {
	title: 'Entry flows/Pre-join device check (signed in)',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2016 — camera and microphone check for people who are already signed in. Nothing new is built: the knock wait dialog (#1834, phase `ready`) holds the guest waiting room\'s device check (`CallDeviceCheck`). **Call:** "Beitreten" on the call message in the chat opens it, "Jetzt beitreten" closes it and joins. **Circle:** the existing self-help pre-lobby offers the same check as an option ("Kamera & Mikrofon"); the choice waits for the group\'s next call. Desktop: centred dialog; phone: bottom sheet. The browser\'s devices are faked, so the stories never ask for a camera.'
			}
		}
	},
	args: { onJoin: fn() }
} satisfies Meta;
export default meta;

type Story = StoryObj<{ onJoin: () => void }>;

const callMessage: Story = {
	render: (args) => <FromCallMessage {...args} />
};

const circleParameters = {
	router: {
		initialPath: `/sessions/user/view/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
	}
};

/* ----- Call ----- */

export const CallDevicesOk: Story = {
	...callMessage,
	name: 'Call · devices OK · desktop 1440',
	globals: desktop1440Globals,
	parameters: textOnThePicture,
	beforeEach: withDevices('ok'),
	play: async ({ canvasElement, args }) => {
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		// Not joined yet: the check comes first.
		await expect(args.onJoin).not.toHaveBeenCalled();
		// The call now takes the picked devices (ORISO-ElementCall#116), so
		// the interim "the call uses your browser's default device" is gone.
		await expect(
			page(canvasElement).queryByText(
				'Der Anruf nutzt vorerst das Standardgerät Ihres Browsers.'
			)
		).toBeNull();
	}
};

export const CallCameraOffThenJoin: Story = {
	...callMessage,
	name: 'Call · camera off, join: the choice goes to the call',
	globals: desktop1440Globals,
	beforeEach: withDevices('ok'),
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await userEvent.click(p.getByTestId('toggle-camera'));
		await userEvent.click(p.getByTestId('knock-wait-join'));
		await expectClosed(canvasElement);
		// Closed before the call starts, so the call gets the camera.
		await expectReleased();
		await waitFor(() => expect(args.onJoin).toHaveBeenCalledTimes(1));
		await expect(peekJoinMedia(runningCall.roomRef)).toEqual({
			audio_enabled: true,
			video_enabled: false,
			// The devices the check showed go along (ElementCall#116).
			microphoneLabel: 'MacBook Pro-Mikrofon',
			cameraLabel: 'FaceTime HD-Kamera'
		});
	}
};

export const CallPickDevicesThenJoin: Story = {
	...callMessage,
	name: 'Call · headset and second camera picked, join: the call gets them',
	globals: desktop1440Globals,
	beforeEach: withDevices('ok'),
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await userEvent.click(p.getByTestId('device-picker-microphone'));
		await userEvent.click(
			await p.findByRole('menuitem', { name: 'Jabra Evolve2 Headset' })
		);
		await userEvent.click(p.getByTestId('device-picker-camera'));
		await userEvent.click(
			await p.findByRole('menuitem', { name: 'Logitech C920' })
		);
		await userEvent.click(p.getByTestId('knock-wait-join'));
		await expectClosed(canvasElement);
		await expectReleased();
		await waitFor(() => expect(args.onJoin).toHaveBeenCalledTimes(1));
		// By label: the call runs on another origin, where these devices
		// have other ids (ElementCall#116).
		await expect(peekJoinMedia(runningCall.roomRef)).toEqual({
			audio_enabled: true,
			video_enabled: true,
			microphoneLabel: 'Jabra Evolve2 Headset',
			cameraLabel: 'Logitech C920'
		});
	}
};

export const CallClose: Story = {
	...callMessage,
	name: 'Call · Escape closes without joining',
	globals: desktop1440Globals,
	beforeEach: withDevices('ok'),
	play: async ({ canvasElement, args }) => {
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await userEvent.keyboard('{Escape}');
		await expectClosed(canvasElement);
		await expectReleased();
		await expect(args.onJoin).not.toHaveBeenCalled();
		await expect(peekJoinMedia(runningCall.roomRef)).toBe(null);
	}
};

export const CallDevicesOkPhone: Story = {
	...callMessage,
	name: 'Call · devices OK · phone 390',
	globals: phone390Globals,
	parameters: textOnThePicture,
	beforeEach: withDevices('ok'),
	play: async ({ canvasElement }) => {
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const CallPermissionDenied: Story = {
	...callMessage,
	name: 'Call · permission denied',
	globals: desktop1440Globals,
	beforeEach: withDevices('permissionDenied'),
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expect(await p.findByTestId('call-notice')).toHaveAttribute(
			'data-blocker',
			'permissionDenied'
		);
		await expect(p.getByTestId('knock-wait-retry')).toBeVisible();
		// Joining stays possible; the call then asks the browser itself.
		await userEvent.click(p.getByTestId('knock-wait-join'));
		await waitFor(() => expect(args.onJoin).toHaveBeenCalledTimes(1));
		await expect(peekJoinMedia(runningCall.roomRef)).toBe(null);
	}
};

export const CallPermissionDeniedPhone: Story = {
	...callMessage,
	name: 'Call · permission denied · phone 390',
	globals: phone390Globals,
	parameters: textOnThePicture,
	beforeEach: withDevices('permissionDenied'),
	play: async ({ canvasElement }) => {
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await page(canvasElement).findByTestId('call-notice');
		await expectBottomSheet(canvasElement);
	}
};

export const CallNoCamera: Story = {
	...callMessage,
	name: 'Call · no camera',
	globals: desktop1440Globals,
	beforeEach: withDevices('noCamera'),
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await waitFor(() =>
			expect(p.getByTestId('toggle-camera')).toBeDisabled()
		);
		await userEvent.click(p.getByTestId('knock-wait-join'));
		await waitFor(() => expect(args.onJoin).toHaveBeenCalledTimes(1));
		await expect(peekJoinMedia(runningCall.roomRef)).toEqual({
			audio_enabled: true,
			video_enabled: false,
			microphoneLabel: 'MacBook Pro-Mikrofon'
		});
	}
};

export const CallNoMicrophone: Story = {
	...callMessage,
	name: 'Call · no microphone',
	globals: desktop1440Globals,
	beforeEach: withDevices('noMicrophone'),
	play: async ({ canvasElement }) => {
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expect(
			await page(canvasElement).findByTestId('call-notice')
		).toHaveAttribute('data-blocker', 'noDevice');
	}
};

/* ----- Circle ----- */

export const CircleLobbyOption: Story = {
	name: 'Circle · video circle: pre-lobby offers the check · desktop 1440',
	globals: desktop1440Globals,
	parameters: circleParameters,
	beforeEach: withDevices('ok'),
	render: () => <CircleLobby layout="desktop" />,
	play: async ({ canvasElement }) => {
		// The circle's own elements stay: clock, start time, locked join.
		await expectWaitingRoomLayout(canvasElement, { frame: 'card' });
		await expect(await circleOption(canvasElement)).toBeVisible();
		// An option: nothing is asked of the browser until it is opened.
		await expect(fake!.tracks).toHaveLength(0);
	}
};

export const CircleDevicesOk: Story = {
	name: 'Circle · device check open · desktop 1440',
	globals: desktop1440Globals,
	parameters: { ...circleParameters, ...textOnThePicture },
	beforeEach: withDevices('ok'),
	render: () => <CircleLobby layout="desktop" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await circleOption(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
	}
};

export const CircleMicOffDone: Story = {
	name: 'Circle · mic off, "Fertig": kept for the group\'s call',
	globals: desktop1440Globals,
	parameters: circleParameters,
	beforeEach: withDevices('ok'),
	render: () => <CircleLobby layout="desktop" />,
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await userEvent.click(await circleOption(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await userEvent.click(p.getByTestId('toggle-mic'));
		await userEvent.click(p.getByRole('button', { name: 'Fertig' }));
		await expectClosed(canvasElement);
		await expectReleased();
		await expect(peekJoinMedia(GROUP_STAGE_ROOM_ID)).toEqual({
			audio_enabled: false,
			video_enabled: true,
			microphoneLabel: 'MacBook Pro-Mikrofon',
			cameraLabel: 'FaceTime HD-Kamera'
		});
		// Back in the unchanged pre-lobby.
		await expectWaitingRoomLayout(canvasElement, { frame: 'card' });
	}
};

export const CircleDevicesOkPhone: Story = {
	name: 'Circle · device check open · phone 390',
	globals: phone390Globals,
	parameters: { ...circleParameters, ...textOnThePicture },
	beforeEach: withDevices('ok'),
	render: () => <CircleLobby layout="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await circleOption(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const CirclePermissionDenied: Story = {
	name: 'Circle · permission denied',
	globals: desktop1440Globals,
	parameters: circleParameters,
	beforeEach: withDevices('permissionDenied'),
	render: () => <CircleLobby layout="desktop" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await circleOption(canvasElement));
		await expectSettled(canvasElement);
		await expect(
			await page(canvasElement).findByTestId('call-notice')
		).toBeVisible();
	}
};

export const CircleNoCameraPhone: Story = {
	name: 'Circle · no camera · phone 390',
	globals: phone390Globals,
	parameters: { ...circleParameters, ...textOnThePicture },
	beforeEach: withDevices('noCamera'),
	render: () => <CircleLobby layout="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await circleOption(canvasElement));
		await expectSettled(canvasElement);
		await waitFor(() =>
			expect(
				page(canvasElement).getByTestId('toggle-camera')
			).toBeDisabled()
		);
	}
};

export const CircleTextNoOption: Story = {
	name: 'Circle · text circle: no device check',
	globals: desktop1440Globals,
	parameters: circleParameters,
	beforeEach: withDevices('ok'),
	render: () => <CircleLobby layout="desktop" modality="TEXT" />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement, { frame: 'card' });
		await expect(
			page(canvasElement).queryByTestId('group-entry-devices')
		).toBeNull();
	}
};

/* ----- Knock: one window (product owner, 2026-11-03) ----- */

const SESSION = 4711;
const knockCall: CallLifecycleMessage = {
	...runningCall,
	callId: 'call-direct',
	roomRef: '!direct:oriso.org',
	callRoomId: '!media:oriso.org'
};
const joinRunningCall = fn(async () => 'joined' as const);

/**
 * A direct-link conversation (#1893): "Beitreten" knocks. The device check
 * is the one window — it waits in place and joins once let in. The knock
 * gate is mounted too, as in the app, and must stay out of it.
 */
const KnockFromCallMessage = () => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	return (
		<>
			<MessageStoryShell compact={phone}>
				<CallTimelineMessage
					call={knockCall}
					deviceCheck={() => true}
					onJoin={(hooks) =>
						joinOrKnock(SESSION, joinRunningCall, {
							...hooks,
							call: knockCall
						})
					}
				/>
			</MessageStoryShell>
			<DirectLinkKnockGate pollMs={400} />
		</>
	);
};

const knockStory = (answers: CallKnockStatus[]): Partial<Story> => ({
	parameters: { router: { initialPath: `/sessions/user/view/${SESSION}` } },
	beforeEach: () => {
		const devicesCleanup = withDevices('ok')();
		joinRunningCall.mockClear();
		forgetPendingKnock();
		localStorage.removeItem(DIRECT_LINK_ADMITTED_KEY);
		rememberDirectLinkSession(SESSION, { token: 'tok7', medium: 'VIDEO' });
		const apiCleanup = installDirectLinkMockApi({ knockAnswers: answers });
		return () => {
			apiCleanup?.();
			devicesCleanup();
			forgetPendingKnock();
		};
	},
	render: () => <KnockFromCallMessage />
});

const knockAndWait = async (canvasElement: HTMLElement) => {
	const p = page(canvasElement);
	await userEvent.click(await callJoin(canvasElement));
	await expectSettled(canvasElement);
	await expectLivePreview(canvasElement);
	await userEvent.click(p.getByTestId('knock-wait-join'));
	await waitFor(() =>
		expect(p.getByTestId('knock-wait-join')).toHaveTextContent(
			'Anfrage gesendet, bitte warten …'
		)
	);
};

export const KnockOneWindow: Story = {
	...knockStory(['PENDING']),
	name: 'Knock · one window: waiting keeps preview and switches · 1440',
	globals: desktop1440Globals,
	parameters: {
		...knockStory([]).parameters,
		...textOnThePicture
	},
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await knockAndWait(canvasElement);
		await expect(p.getByTestId('knock-wait-join')).toBeDisabled();
		await expect(p.getByTestId('video-check')).toBeVisible();
		await expect(p.getByTestId('toggle-mic')).toBeEnabled();
		// No second dialog from the knock gate.
		await expect(p.getAllByTestId('knock-wait-dialog')).toHaveLength(1);
		await expect(joinRunningCall).not.toHaveBeenCalled();
	}
};

export const KnockOneWindowPhone: Story = {
	...knockStory(['PENDING']),
	name: 'Knock · one window · phone 390',
	globals: phone390Globals,
	parameters: {
		...knockStory([]).parameters,
		...textOnThePicture
	},
	play: async ({ canvasElement }) => {
		await knockAndWait(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const KnockStopWaiting: Story = {
	...knockStory(['PENDING']),
	name: 'Knock · "Nicht mehr warten" turns the button back',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await knockAndWait(canvasElement);
		await userEvent.click(p.getByTestId('knock-wait-cancel'));
		await waitFor(() =>
			expect(p.getByTestId('knock-wait-join')).toHaveTextContent(
				'Jetzt beitreten'
			)
		);
		await expect(p.getAllByTestId('knock-wait-dialog')).toHaveLength(1);
		await waitFor(() =>
			expect(
				directLinkMock().requests.some(
					(request) => request.method === 'DELETE'
				)
			).toBe(true)
		);
	}
};

export const KnockLetInJoins: Story = {
	...knockStory(['PENDING', 'ADMITTED']),
	name: 'Knock · let in: joins with exactly the switches from the check',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await userEvent.click(await callJoin(canvasElement));
		await expectSettled(canvasElement);
		await expectLivePreview(canvasElement);
		await userEvent.click(p.getByTestId('knock-wait-join'));
		// Switched while waiting: the switches stay the one truth.
		await waitFor(() =>
			expect(p.getByTestId('knock-wait-join')).toBeDisabled()
		);
		await userEvent.click(p.getByTestId('toggle-camera'));
		await waitFor(() => expect(joinRunningCall).toHaveBeenCalledOnce(), {
			timeout: 8000
		});
		await expectClosed(canvasElement);
		await expect(peekJoinMedia(knockCall.roomRef)).toEqual({
			audio_enabled: true,
			video_enabled: false,
			microphoneLabel: 'MacBook Pro-Mikrofon',
			cameraLabel: 'FaceTime HD-Kamera'
		});
	}
};

const joinAfterReload = fn(async (_knock: PendingKnock) => 'joined' as const);

export const KnockReloadThenLetIn: Story = {
	name: 'Knock · page reloaded while waiting: let in joins at once',
	globals: desktop1440Globals,
	parameters: {
		router: { initialPath: `/sessions/user/view/${SESSION}` },
		...textOnThePicture
	},
	beforeEach: () => {
		const devicesCleanup = withDevices('ok')();
		joinAfterReload.mockClear();
		// What the knock left in the tab before the reload.
		rememberPendingKnock({
			token: 'tok7',
			knockId: 501,
			sessionId: SESSION,
			medium: 'VIDEO',
			status: 'PENDING',
			joinExisting: true,
			joinCall: { ...knockCall, isGroup: false }
		});
		const apiCleanup = installDirectLinkMockApi({
			knockAnswers: ['PENDING', 'ADMITTED']
		});
		return () => {
			apiCleanup?.();
			devicesCleanup();
			forgetPendingKnock();
		};
	},
	render: () => (
		<DirectLinkKnockGate
			pollMs={400}
			deps={{ joinRunningCall: joinAfterReload }}
		/>
	),
	play: async () => {
		await waitFor(() => expect(joinAfterReload).toHaveBeenCalledOnce(), {
			timeout: 8000
		});
		await expect(joinAfterReload.mock.calls[0][0]).toMatchObject({
			joinCall: { callId: 'call-direct' }
		});
	}
};
