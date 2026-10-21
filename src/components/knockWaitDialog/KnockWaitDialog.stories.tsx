import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useMediaQuery } from '@mui/material';
import {
	desktop1440Globals,
	MessageStoryShell,
	phone390Globals
} from '../message/messageStoryShell';
import { CallTimelineMessage } from '../message/CallTimelineMessage';
import '../message/message.styles.scss';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { KnockWaitDialog, KnockWaitDialogProps } from './KnockWaitDialog';
import {
	initialKnockWaitPhase,
	KnockWaitPhase,
	useKnockWaitPhase
} from './knockWaitPhase';
import {
	CallDeviceKind,
	CallDevices,
	CallDeviceSelection,
	CallModality
} from '../waitingRoom/callEntry/callEntryTypes';
import { useLiveCallDevices } from '../waitingRoom/callEntry/useLiveCallDevices';
import type { Avatar } from '../../utils/pseudonymGenerator';

const devices: CallDevices = {
	camera: [
		{ id: 'cam-1', label: 'FaceTime HD-Kamera' },
		{ id: 'cam-2', label: 'Logitech C920' }
	],
	microphone: [
		{ id: 'mic-1', label: 'MacBook Pro-Mikrofon' },
		{ id: 'mic-2', label: 'AirPods Pro' }
	],
	speaker: [{ id: 'spk-1', label: 'MacBook Pro-Lautsprecher' }]
};

/** Fixed animal, so screenshots and tests do not reroll. */
const owl: Avatar = { file: 'owl.svg', bg: '#FCE2C4', iconColor: '#1b1b1c' };

/** Stands in for the Beratungsstelle's sentence from `useGroupConsent`. */
const sentence = (
	<>
		Ich stimme der <a href="#datenschutz">Datenschutzerklärung</a> der
		Beratungsstelle Lichtenberg zu und weiß, dass meine Nachrichten in der
		Gruppe von allen Teilnehmenden gelesen werden.
	</>
);

type DemoProps = Omit<KnockWaitDialogProps, 'phase' | 'media'> & {
	initialPhase?: KnockWaitPhase;
	/** Group only: the account has not agreed yet. */
	consentRequired?: boolean;
	/** Call only. Without it the call has no preview (never in the app). */
	modality?: CallModality;
	cameraAvailable?: boolean;
	initialCameraOn?: boolean;
	micLevel?: number;
	onToggleMic?: () => void;
	onSelectDevice?: (kind: CallDeviceKind, id: string) => void;
};

/**
 * The dialog with its phase machine and fixture devices, as the chat would
 * hold it. Every callback is also reported to the story's spies.
 */
const KnockWaitDemo = ({
	initialPhase,
	consentRequired,
	modality,
	cameraAvailable = true,
	initialCameraOn = true,
	micLevel = 0.45,
	onToggleMic,
	onSelectDevice,
	onAcceptConsent,
	onCancel,
	onKnockAgain,
	...props
}: DemoProps) => {
	const { phase, dispatch } = useKnockWaitPhase(
		initialPhase ?? initialKnockWaitPhase(props.variant, consentRequired)
	);
	const [open, setOpen] = useState(true);
	const [micOn, setMicOn] = useState(true);
	const [cameraOn, setCameraOn] = useState(initialCameraOn);
	const [selection, setSelection] = useState<CallDeviceSelection>({});
	return (
		<KnockWaitDialog
			{...props}
			phase={phase}
			media={
				modality && {
					modality,
					name: 'eule_mika_4821',
					avatar: owl,
					devices,
					selection,
					micLevel,
					micOn,
					cameraOn,
					cameraAvailable,
					onToggleMic: () => {
						onToggleMic?.();
						setMicOn((on) => !on);
					},
					onToggleCamera: () => setCameraOn((on) => !on),
					onSelectDevice: (kind, id) => {
						onSelectDevice?.(kind, id);
						setSelection((current) => ({ ...current, [kind]: id }));
					}
				}
			}
			onAcceptConsent={() =>
				Promise.resolve(onAcceptConsent?.()).then(() =>
					dispatch('consentAccepted')
				)
			}
			open={open}
			onCancel={() => {
				onCancel();
				setOpen(false);
			}}
			onKnockAgain={() => {
				onKnockAgain();
				dispatch('knockAgain');
			}}
		/>
	);
};

/**
 * **Knock wait dialog** — "wait until you are let in", as a small popup over
 * the chat (Frank, 2026-10-21). Storybook only; nothing opens it yet.
 *
 * - **Call:** a signed-in person clicks the call message in the chat. The
 *   dialog shows their own preview with mic and camera switches, a device
 *   choice only where there is more than one device, and "Nicht mehr warten".
 * - **Self-help group (time-limited):** the lead lets people in. When the
 *   account has not agreed to the Beratungsstelle's statement yet, the
 *   dialog asks first (same copy as `GroupConsentGate`), then waits. No
 *   audio or video.
 *
 * Deliberately not a waiting room (no frame, bar or gate button): the house
 * `M3Dialog`, a bottom sheet on phones. Phases come from `knockWaitPhase.ts`.
 */
const meta = {
	title: 'Entry flows/Knock wait dialog',
	component: KnockWaitDemo,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' },
	args: {
		onCancel: fn(),
		onKnockAgain: fn(),
		onClose: fn(),
		onAcceptConsent: fn(),
		onToggleMic: fn(),
		onSelectDevice: fn()
	},
	decorators: [
		(Story) => (
			<div style={{ minHeight: '100vh' }}>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof KnockWaitDemo>;
export default meta;

type Story = StoryObj<typeof meta>;

const call = {
	variant: 'call',
	modality: 'video'
} satisfies Partial<DemoProps>;
const group = {
	variant: 'group',
	agencyName: 'Beratungsstelle Lichtenberg',
	consentSentence: sentence,
	openUntil: '19:30'
} satisfies Partial<DemoProps>;

/** The dialog lives in a portal, outside the story's canvas. */
const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const dialog = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId('knock-wait-dialog');

/** MUI fades the dialog in; wait until it is really there. */
const expectVisible = async (element: HTMLElement | Promise<HTMLElement>) => {
	const el = await element;
	await waitFor(() => expect(el).toBeVisible());
};

/** Gone: no dialog left in the page, no "cancelled" screen. */
const expectClosed = (canvasElement: HTMLElement) =>
	waitFor(() =>
		expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull()
	);

/** Fits the viewport: no sideways scroll, nothing cut at the edges. */
const expectFitsViewport = async (canvasElement: HTMLElement) => {
	const surface = await dialog(canvasElement);
	const view = canvasElement.ownerDocument.defaultView!;
	const box = surface.getBoundingClientRect();
	await expect(box.left).toBeGreaterThanOrEqual(0);
	await expect(box.right).toBeLessThanOrEqual(view.innerWidth + 0.5);
	await expect(surface.scrollWidth).toBeLessThanOrEqual(
		surface.clientWidth + 1
	);
};

/** Phone: a bottom sheet, flush with the bottom and both sides. */
const expectBottomSheet = async (canvasElement: HTMLElement) => {
	const surface = await dialog(canvasElement);
	const view = canvasElement.ownerDocument.defaultView!;
	const box = surface.getBoundingClientRect();
	await expect(Math.round(box.bottom)).toBe(view.innerHeight);
	await expect(Math.round(box.width)).toBe(view.innerWidth);
};

/* ---------- Call ---------- */

export const CallWaiting: Story = {
	name: 'Call · waiting (video)',
	globals: desktop1440Globals,
	args: { ...call },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await expectVisible(
			await p.findByRole('heading', {
				name: 'Kurz warten, bis Sie hereingelassen werden'
			})
		);
		await expect(p.getByTestId('knock-wait-status')).toHaveTextContent(
			'Ihre Beratung sieht, dass Sie warten'
		);
		await expectVisible(p.getByTestId('video-check'));
		// While waiting, the only way out is the labelled one.
		await expect(p.queryByTestId('m3-dialog-close')).toBeNull();
		const mic = p.getByTestId('toggle-mic');
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(mic);
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(args.onToggleMic).toHaveBeenCalledTimes(1);
		await userEvent.click(mic);
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await expectFitsViewport(canvasElement);
	}
};

export const CallWaitingPhone: Story = {
	name: 'Call · waiting (video) · phone 390',
	globals: phone390Globals,
	args: { ...call },
	play: async ({ canvasElement }) => {
		await expectVisible(
			await page(canvasElement).findByTestId('video-check')
		);
		await expectBottomSheet(canvasElement);
		await expectFitsViewport(canvasElement);
	}
};

export const CallWaitingCameraOff: Story = {
	name: 'Call · waiting, camera off',
	globals: desktop1440Globals,
	args: { ...call, initialCameraOn: false },
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await expectVisible(await p.findByTestId('video-avatar'));
		await expect(p.getByTestId('toggle-camera')).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	}
};

export const CallWaitingAudio: Story = {
	name: 'Call · waiting (phone call, no camera)',
	globals: desktop1440Globals,
	args: { ...call, modality: 'audio' },
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await expectVisible(await p.findByTestId('toggle-mic'));
		await expect(p.queryByTestId('video-check')).toBeNull();
		await expect(p.queryByTestId('device-picker-camera')).toBeNull();
		await expectVisible(p.getByRole('meter'));
		await userEvent.click(p.getByTestId('toggle-mic'));
		// Muted: no meter that could suggest it still listens.
		await expect(p.queryByRole('meter')).toBeNull();
	}
};

export const CallChooseMicrophone: Story = {
	name: 'Call · choose another microphone',
	globals: desktop1440Globals,
	args: { ...call },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await p.findByTestId('device-picker-microphone'));
		await userEvent.click(
			await p.findByRole('menuitem', { name: 'AirPods Pro' })
		);
		await expect(args.onSelectDevice).toHaveBeenCalledWith(
			'microphone',
			'mic-2'
		);
		await waitFor(() =>
			expect(
				p.getByTestId('device-picker-microphone')
			).toHaveAccessibleName('Mikrofon: AirPods Pro')
		);
	}
};

export const CallStopWaiting: Story = {
	name: 'Call · stop waiting closes the dialog',
	globals: desktop1440Globals,
	args: { ...call },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await p.findByTestId('knock-wait-cancel'));
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
		await expectClosed(canvasElement);
		await expect(args.onKnockAgain).not.toHaveBeenCalled();
	}
};

export const CallEscapeStopsWaiting: Story = {
	name: 'Call · Escape stops waiting and closes',
	globals: desktop1440Globals,
	args: { ...call },
	play: async ({ canvasElement, args }) => {
		await dialog(canvasElement);
		await userEvent.keyboard('{Escape}');
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
		await expect(args.onClose).not.toHaveBeenCalled();
		await expectClosed(canvasElement);
	}
};

export const CallAdmitted: Story = {
	name: 'Call · admitted (joining)',
	globals: desktop1440Globals,
	args: { ...call, initialPhase: 'admitted' },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await expectVisible(
			await p.findByRole('heading', { name: 'Sie wurden hereingelassen' })
		);
		await expect(p.getByRole('status')).toHaveTextContent(
			'Das Gespräch wird verbunden'
		);
		await expect(p.queryByTestId('m3-dialog-close')).toBeNull();
		await userEvent.keyboard('{Escape}');
		await expect(args.onClose).not.toHaveBeenCalled();
		await expect(args.onCancel).not.toHaveBeenCalled();
	}
};

export const CallDeclined: Story = {
	name: 'Call · declined',
	globals: desktop1440Globals,
	args: { ...call, initialPhase: 'declined' },
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await expectVisible(
			await p.findByRole('heading', { name: 'Gerade geht es nicht' })
		);
		await expect(p.getByTestId('knock-wait-again')).toBeEnabled();
		await expect(p.queryByTestId('video-check')).toBeNull();
	}
};

export const CallDeclinedClose: Story = {
	name: 'Call · declined, close',
	globals: desktop1440Globals,
	args: { ...call, initialPhase: 'declined' },
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			await page(canvasElement).findByTestId('knock-wait-close')
		);
		await expect(args.onClose).toHaveBeenCalledTimes(1);
	}
};

/* ---------- Self-help group (time-limited) ---------- */

export const GroupConsent: Story = {
	name: 'Group · consent first',
	globals: desktop1440Globals,
	args: { ...group, consentRequired: true },
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await expectVisible(
			await p.findByRole('heading', { name: 'Bevor Sie schreiben' })
		);
		await expectVisible(
			p.getByText(/Diese Gruppe wird von Beratungsstelle Lichtenberg/)
		);
		await expect(p.getByTestId('knock-wait-consent-accept')).toBeEnabled();
		await expect(p.queryByTestId('knock-wait-status')).toBeNull();
	}
};

export const GroupConsentPhone: Story = {
	name: 'Group · consent first · phone 390',
	globals: phone390Globals,
	args: { ...group, consentRequired: true },
	play: async ({ canvasElement }) => {
		await expectBottomSheet(canvasElement);
		await expectFitsViewport(canvasElement);
	}
};

export const GroupConsentThenWait: Story = {
	name: 'Group · agree, then wait',
	globals: desktop1440Globals,
	args: { ...group, consentRequired: true },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(
			await p.findByTestId('knock-wait-consent-accept')
		);
		await expect(args.onAcceptConsent).toHaveBeenCalledTimes(1);
		await expect(
			await p.findByTestId('knock-wait-status')
		).toHaveTextContent('die Gruppenleitung sieht, dass Sie warten');
		await expect(p.queryByTestId('toggle-mic')).toBeNull();
	}
};

export const GroupConsentRejected: Story = {
	name: 'Group · consent declined by the person',
	globals: desktop1440Globals,
	args: { ...group, consentRequired: true },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(
			await p.findByTestId('knock-wait-consent-reject')
		);
		await expect(await p.findByRole('alert')).toHaveTextContent(
			'Ohne Ihre Zustimmung'
		);
		await expect(args.onAcceptConsent).not.toHaveBeenCalled();
		await expect(p.queryByTestId('knock-wait-status')).toBeNull();
	}
};

export const GroupConsentSaveFails: Story = {
	name: 'Group · consent not saved',
	globals: desktop1440Globals,
	args: {
		...group,
		consentRequired: true,
		onAcceptConsent: fn(() => Promise.reject(new Error('offline')))
	},
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await userEvent.click(
			await p.findByTestId('knock-wait-consent-accept')
		);
		await expect(await p.findByRole('alert')).toHaveTextContent(
			'nicht gespeichert'
		);
		await expect(p.getByTestId('knock-wait-consent-accept')).toBeEnabled();
		await expect(p.queryByTestId('knock-wait-status')).toBeNull();
	}
};

export const GroupWaiting: Story = {
	name: 'Group · waiting',
	globals: desktop1440Globals,
	args: { ...group },
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await expectVisible(await p.findByTestId('knock-wait-status'));
		await expectVisible(
			p.getByText('Der Gruppenchat ist bis 19:30 Uhr geöffnet.')
		);
		await expect(p.queryByTestId('toggle-mic')).toBeNull();
		await expect(p.getByTestId('knock-wait-cancel')).toBeEnabled();
	}
};

export const GroupStopWaiting: Story = {
	name: 'Group · stop waiting closes the dialog',
	globals: desktop1440Globals,
	args: { ...group },
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			await page(canvasElement).findByTestId('knock-wait-cancel')
		);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
		await expectClosed(canvasElement);
	}
};

export const GroupWaitingPhone: Story = {
	name: 'Group · waiting · phone 390',
	globals: phone390Globals,
	args: { ...group },
	play: async ({ canvasElement }) => {
		await expectBottomSheet(canvasElement);
		await expectFitsViewport(canvasElement);
	}
};

export const GroupAdmitted: Story = {
	name: 'Group · admitted',
	globals: desktop1440Globals,
	args: { ...group, initialPhase: 'admitted' },
	play: async ({ canvasElement }) => {
		await expect(
			await page(canvasElement).findByRole('status')
		).toHaveTextContent('Der Gruppenchat wird geöffnet');
	}
};

export const GroupDeclined: Story = {
	name: 'Group · declined',
	globals: desktop1440Globals,
	args: { ...group, initialPhase: 'declined' },
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await expectVisible(
			await p.findByText(/Die Gruppenleitung kann Sie im Moment nicht/)
		);
		await userEvent.click(p.getByTestId('knock-wait-again'));
		await expect(args.onKnockAgain).toHaveBeenCalledTimes(1);
		// Knocking again does not ask for consent a second time.
		await expectVisible(await p.findByTestId('knock-wait-status'));
	}
};

/* ---------- From the call message ---------- */

/** A running video call the counsellor started, as the room records it. */
const runningCall: CallLifecycleMessage = {
	callId: 'call-knock',
	roomRef: '!conversation:example',
	callRoomId: '!media:example',
	state: 'running',
	callType: 'video',
	actorUserId: '@berger:example',
	participants: [{ userId: '@berger:example', displayName: 'Frau Berger' }],
	present: [{ userId: '@berger:example', displayName: 'Frau Berger' }]
};

/**
 * The way in: the existing call message in the chat, unchanged. Its join
 * action opens the dialog instead of the call; the knock counts as sent
 * (`'joined'`), so the card shows no error. Composed here only.
 */
const FromCallMessage = ({ onCancel, ...props }: DemoProps) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	const [knocking, setKnocking] = useState(false);
	return (
		<div style={{ display: 'flex', justifyContent: 'center' }}>
			<div style={{ width: '100%', maxWidth: 900 }}>
				<MessageStoryShell compact={phone}>
					<CallTimelineMessage
						call={runningCall}
						onJoin={() => {
							setKnocking(true);
							return Promise.resolve('joined' as const);
						}}
					/>
				</MessageStoryShell>
			</div>
			{knocking && (
				<KnockWaitDemo
					{...props}
					onCancel={() => {
						onCancel();
						setKnocking(false);
					}}
				/>
			)}
		</div>
	);
};

const joinButton = (canvasElement: HTMLElement) =>
	page(canvasElement).findByRole('button', { name: /Beitreten|Join call/ });

/** Before the click: the chat with the running call and its join action. */
export const FromTheCallMessage: Story = {
	name: 'From the call message · chat before the click',
	globals: desktop1440Globals,
	args: { ...call },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement }) => {
		await expectVisible(joinButton(canvasElement));
		await expect(
			page(canvasElement).queryByTestId('knock-wait-dialog')
		).toBeNull();
	}
};

export const FromTheCallMessageOpen: Story = {
	name: 'From the call message · click opens the dialog, cancel closes it',
	globals: desktop1440Globals,
	args: { ...call },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectVisible(
			await p.findByRole('heading', {
				name: 'Kurz warten, bis Sie hereingelassen werden'
			})
		);
		await expectVisible(p.getByTestId('knock-wait-status'));
		await userEvent.click(p.getByTestId('knock-wait-cancel'));
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
		await expectClosed(canvasElement);
		// The message stays, ready for another knock.
		await expectVisible(joinButton(canvasElement));
	}
};

export const FromTheCallMessagePhone: Story = {
	name: 'From the call message · phone 390',
	globals: phone390Globals,
	args: { ...call },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await joinButton(canvasElement));
		await expectBottomSheet(canvasElement);
		await expectFitsViewport(canvasElement);
	}
};

/* ---------- Live devices ---------- */

const Live = (props: DemoProps) => {
	const [controls, setControls] = useState({
		micOn: true,
		cameraOn: true,
		selection: {} as CallDeviceSelection
	});
	const live = useLiveCallDevices('video', controls);
	const { phase, dispatch } = useKnockWaitPhase('waiting');
	const [open, setOpen] = useState(true);
	return (
		<KnockWaitDialog
			{...props}
			open={open}
			phase={phase}
			media={{
				modality: 'video',
				name: 'eule_mika_4821',
				avatar: owl,
				devices: live.devices,
				selection: controls.selection,
				stream: live.stream,
				micLevel: live.micLevel,
				micOn: controls.micOn,
				cameraOn: controls.cameraOn,
				cameraAvailable: !live.cameraMissing,
				onToggleMic: () =>
					setControls((c) => ({ ...c, micOn: !c.micOn })),
				onToggleCamera: () =>
					setControls((c) => ({ ...c, cameraOn: !c.cameraOn })),
				onSelectDevice: (kind, id) =>
					setControls((c) => ({
						...c,
						selection: { ...c.selection, [kind]: id }
					}))
			}}
			onCancel={() => setOpen(false)}
			onKnockAgain={() => dispatch('knockAgain')}
		/>
	);
};

/**
 * Real camera and microphone. In the headless test run nobody answers the
 * permission prompt; the dialog still waits, with the camera off.
 */
export const LiveDevices: Story = {
	name: 'Live devices · call (asks for camera and mic)',
	globals: desktop1440Globals,
	args: { variant: 'call' },
	render: (args) => <Live {...args} />,
	play: async ({ canvasElement }) => {
		await expectVisible(
			await page(canvasElement).findByTestId('knock-wait-status')
		);
	}
};
