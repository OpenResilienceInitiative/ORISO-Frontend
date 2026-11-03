import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useMediaQuery } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import {
	desktop1440Globals,
	MessageStoryShell,
	phone390Globals
} from '../../message/messageStoryShell';
import { CallTimelineMessage } from '../../message/CallTimelineMessage';
import '../../message/message.styles.scss';
import '../../knockWaitDialog/knockWaitDialog.styles.scss';
import type { CallLifecycleMessage } from '../../../utils/callLifecycleMessage';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { VideoCheck } from '../../waitingRoom/callEntry/VideoCheck';
import { DeviceToggle } from '../../waitingRoom/callEntry/DeviceToggle';
import { DevicePicker } from '../../waitingRoom/callEntry/DevicePicker';
import { MicLevelMeter } from '../../waitingRoom/callEntry/MicLevelMeter';
import { CallNotice } from '../../waitingRoom/callEntry/CallNotice';
import {
	CallDeviceKind,
	CallDevices,
	CallDeviceSelection,
	CallEntryBlocker,
	CallModality
} from '../../waitingRoom/callEntry/callEntryTypes';
import type { Avatar } from '../../../utils/pseudonymGenerator';
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

/* ---------- Fixtures ---------- */

const devices: CallDevices = {
	camera: [
		{ id: 'cam-1', label: 'FaceTime HD-Kamera' },
		{ id: 'cam-2', label: 'Logitech C920' }
	],
	microphone: [
		{ id: 'mic-1', label: 'MacBook Pro-Mikrofon' },
		{ id: 'mic-2', label: 'Jabra Evolve2 Headset' }
	],
	speaker: [{ id: 'spk-1', label: 'MacBook Pro-Lautsprecher' }]
};

/** A laptop without a webcam: only the microphone is checked. */
const noCamera: CallDevices = { ...devices, camera: [] };

/** Fixed animal, so screenshots and tests do not reroll. */
const owl: Avatar = { file: 'owl.svg', bg: '#FCE2C4', iconColor: '#1b1b1c' };

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

/* ---------- The composition (Storybook only in this step) ---------- */

interface DeviceDialogProps {
	modality: CallModality;
	devices: CallDevices;
	blocker?: CallEntryBlocker;
	cameraAvailable?: boolean;
	/** `join`: from the call message. `check`: the circle's option. */
	mode: 'join' | 'check';
	onJoin: (state: { micOn: boolean; cameraOn: boolean }) => void;
	onCancel: () => void;
	onRetry?: () => void;
}

/**
 * Step 1 of #2016: nothing new, only arranged. The knock wait dialog's
 * shell (`M3Dialog` with its `knockWaitDialog` sheet styles, #1834) holding
 * the guest waiting room's device check (`VideoCheck`, `DeviceToggle`,
 * `MicLevelMeter`, `DevicePicker`, `CallNotice` from `waitingRoom/callEntry`).
 */
const DeviceDialog = ({
	modality,
	devices: list,
	blocker,
	cameraAvailable = true,
	mode,
	onJoin,
	onCancel,
	onRetry
}: DeviceDialogProps) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	const [micOn, setMicOn] = useState(true);
	const [cameraOn, setCameraOn] = useState(modality === 'video');
	const [selection, setSelection] = useState<CallDeviceSelection>({});
	const video = modality === 'video';
	const kinds: CallDeviceKind[] = video
		? ['microphone', 'camera']
		: ['microphone'];
	const pickers = kinds.filter((kind) => list[kind].length > 1);
	return (
		<M3Dialog
			onClose={onCancel}
			closeLabel="Schließen"
			width={480}
			title="Kamera und Mikrofon prüfen"
			description={
				mode === 'join'
					? 'Niemand sieht oder hört Sie, bevor Sie beitreten. Die Vorschau sehen nur Sie.'
					: 'Ihre Auswahl gilt, wenn Sie in dieser Gruppe einem Gespräch beitreten. Die Vorschau sehen nur Sie.'
			}
			actions={[
				...(blocker && onRetry
					? [
							{
								label: 'Erneut prüfen',
								onClick: onRetry,
								testId: 'call-prejoin-retry'
							}
						]
					: []),
				{
					label: mode === 'join' ? 'Jetzt beitreten' : 'Fertig',
					onClick: () =>
						onJoin({
							micOn,
							cameraOn: cameraOn && cameraAvailable
						}),
					primary: true,
					testId: 'call-prejoin-join'
				}
			]}
			showDivider={false}
			className={
				phone
					? 'knockWaitDialog knockWaitDialog--sheet'
					: 'knockWaitDialog'
			}
			data-testid="call-prejoin-dialog"
		>
			{blocker ? (
				<CallNotice blocker={blocker} />
			) : (
				<div className="knockWaitDialog__media">
					{video ? (
						<VideoCheck
							name="eule_mika_4821"
							avatar={owl}
							cameraOn={cameraOn && cameraAvailable}
							cameraAvailable={cameraAvailable}
							micOn={micOn}
							micLevel={0.45}
							onToggleCamera={() => setCameraOn((on) => !on)}
							onToggleMic={() => setMicOn((on) => !on)}
						/>
					) : (
						<div className="knockWaitDialog__voice">
							<DeviceToggle
								tone="onSurface"
								on={micOn}
								onToggle={() => setMicOn((on) => !on)}
								iconOn={<MicRoundedIcon />}
								iconOff={<MicOffRoundedIcon />}
								name="Mikrofon"
								labelOn="Mikrofon aus"
								labelOff="Mikrofon an"
								testId="toggle-mic"
							/>
							{micOn && (
								<MicLevelMeter
									level={0.45}
									label="Lautstärke Ihres Mikrofons"
								/>
							)}
						</div>
					)}
					{pickers.length > 0 && (
						<div className="knockWaitDialog__pickers">
							{pickers.map((kind) => (
								<DevicePicker
									key={kind}
									kind={kind}
									kindLabel={
										kind === 'camera'
											? 'Kamera'
											: 'Mikrofon'
									}
									devices={list[kind]}
									selectedId={selection[kind]}
									onSelect={(id) =>
										setSelection((now) => ({
											...now,
											[kind]: id
										}))
									}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</M3Dialog>
	);
};

/* ---------- Variant 1: the call message in the chat ---------- */

type CallArgs = Omit<DeviceDialogProps, 'mode' | 'onCancel'> & {
	onCancel: () => void;
	onCallJoin: () => void;
};

/**
 * The existing chat row with the running call. "Beitreten" opens the device
 * check first; "Jetzt beitreten" closes it and only then joins the call.
 */
const FromCallMessage = ({
	onCancel,
	onCallJoin,
	onJoin,
	...props
}: CallArgs) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	const [open, setOpen] = useState(false);
	return (
		<div style={{ display: 'flex', justifyContent: 'center' }}>
			<div
				style={{ width: '100%', maxWidth: 900 }}
				inert={open || undefined}
			>
				<MessageStoryShell compact={phone}>
					<CallTimelineMessage
						call={runningCall}
						onJoin={() => {
							setOpen(true);
							return Promise.resolve('joined' as const);
						}}
					/>
				</MessageStoryShell>
			</div>
			{open && (
				<DeviceDialog
					{...props}
					mode="join"
					onCancel={() => {
						onCancel();
						setOpen(false);
					}}
					onJoin={(state) => {
						onJoin(state);
						setOpen(false);
						onCallJoin();
					}}
				/>
			)}
		</div>
	);
};

/* ---------- Variant 2: the circle's pre-lobby ---------- */

const FUTURE_SECONDS = 2 * 86400 + 3 * 3600 + 21 * 60 + 50;

type CircleArgs = Omit<DeviceDialogProps, 'mode' | 'onCancel'> & {
	layout: 'desktop' | 'mobile';
	onCancel: () => void;
};

/**
 * The existing circle pre-lobby for a signed-in advice seeker (clock, start
 * time, "Mehr erfahren", locked "Beitreten"), unchanged, with the same device
 * check over it as an option.
 */
const CircleLobby = ({ layout, onCancel, onJoin, ...props }: CircleArgs) => {
	const listItem = React.useMemo(() => {
		const item = buildGroupStageListItem(FUTURE_SECONDS);
		(item.chat as GroupChatItemInterface).assignedAgencies = [
			{ id: 0, name: 'Beratungsstelle Lichtenberg' }
		] as GroupChatItemInterface['assignedAgencies'];
		return item;
	}, []);
	useGroupChatInfoFixture(listItem.chat as GroupChatItemInterface);
	const [open, setOpen] = useState(true);
	return (
		<>
			<GroupChatStage
				listItem={listItem}
				layout={layout}
				viewer={groupStageAsker}
			>
				<JoinGroupChatView />
			</GroupChatStage>
			{open && (
				<DeviceDialog
					{...props}
					mode="check"
					onCancel={() => {
						onCancel();
						setOpen(false);
					}}
					onJoin={(state) => {
						onJoin(state);
						setOpen(false);
					}}
				/>
			)}
		</>
	);
};

/* ---------- Checks ---------- */

/** The dialog lives in a portal, outside the story's canvas. */
const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const dialog = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId('call-prejoin-dialog');

const joinButton = (canvasElement: HTMLElement) =>
	page(canvasElement).findByRole('button', { name: /Beitreten|Join call/ });

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
			page(canvasElement).queryByTestId('call-prejoin-dialog')
		).toBeNull()
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

/**
 * The name chip sits on the camera picture; axe cannot compute contrast over
 * a picture. Scoped exactly as in the knock wait dialog's stories; the
 * camera-off and blocker stories keep the full check.
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
					'#2016 — camera and microphone check for people who are already signed in. Nothing new is built: the knock wait dialog (#1834) holds the guest waiting room\'s device check. **Call:** "Beitreten" on the call message in the chat opens it, "Jetzt beitreten" joins. **Circle:** the existing self-help pre-lobby with the same check as an option. Desktop: centred dialog; phone: bottom sheet.'
			}
		}
	},
	args: {
		onCancel: fn(),
		onJoin: fn(),
		onRetry: fn()
	}
} satisfies Meta;
export default meta;

type Story = StoryObj<CallArgs & CircleArgs>;

const video = { modality: 'video', devices } satisfies Partial<CallArgs>;

/* ----- Call ----- */

export const CallDevicesOk: Story = {
	name: 'Call · devices OK · desktop 1440',
	globals: desktop1440Globals,
	parameters: textOnThePicture,
	args: { ...video, onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expect(p.getByTestId('video-check')).toBeVisible();
		// Not joined yet: the check comes first.
		await expect(args.onCallJoin).not.toHaveBeenCalled();
		await userEvent.click(p.getByTestId('call-prejoin-join'));
		await expectClosed(canvasElement);
		await expect(args.onJoin).toHaveBeenCalledWith({
			micOn: true,
			cameraOn: true
		});
		await expect(args.onCallJoin).toHaveBeenCalledTimes(1);
	}
};

export const CallCameraOffThenJoin: Story = {
	name: 'Call · camera switched off before joining',
	globals: desktop1440Globals,
	args: { ...video, onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await userEvent.click(p.getByTestId('toggle-camera'));
		await userEvent.click(p.getByTestId('call-prejoin-join'));
		await expect(args.onJoin).toHaveBeenCalledWith({
			micOn: true,
			cameraOn: false
		});
	}
};

export const CallCancel: Story = {
	name: 'Call · close without joining',
	globals: desktop1440Globals,
	parameters: textOnThePicture,
	args: { ...video, onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await userEvent.click(p.getByRole('button', { name: 'Schließen' }));
		await expectClosed(canvasElement);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
		await expect(args.onCallJoin).not.toHaveBeenCalled();
	}
};

export const CallDevicesOkPhone: Story = {
	name: 'Call · devices OK · phone 390',
	globals: phone390Globals,
	parameters: textOnThePicture,
	args: { ...video, onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const CallPermissionDenied: Story = {
	name: 'Call · permission denied',
	globals: desktop1440Globals,
	args: { ...video, blocker: 'permissionDenied', onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expect(p.getByTestId('call-notice')).toHaveAttribute(
			'data-blocker',
			'permissionDenied'
		);
		await userEvent.click(p.getByTestId('call-prejoin-retry'));
		await expect(args.onRetry).toHaveBeenCalledTimes(1);
	}
};

export const CallPermissionDeniedPhone: Story = {
	name: 'Call · permission denied · phone 390',
	globals: phone390Globals,
	args: { ...video, blocker: 'permissionDenied', onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const CallNoCamera: Story = {
	name: 'Call · no camera',
	globals: desktop1440Globals,
	args: {
		...video,
		devices: noCamera,
		cameraAvailable: false,
		onCallJoin: fn()
	},
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expect(p.getByTestId('toggle-camera')).toBeDisabled();
		await userEvent.click(p.getByTestId('call-prejoin-join'));
		await expect(args.onJoin).toHaveBeenCalledWith({
			micOn: true,
			cameraOn: false
		});
	}
};

export const CallNoMicrophone: Story = {
	name: 'Call · no microphone',
	globals: desktop1440Globals,
	args: { ...video, blocker: 'noDevice', onCallJoin: fn() },
	render: (args) => <FromCallMessage {...args} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await joinButton(canvasElement));
		await expectSettled(canvasElement);
		await expect(
			page(canvasElement).getByTestId('call-notice')
		).toHaveAttribute('data-blocker', 'noDevice');
	}
};

/* ----- Circle ----- */

const circleParameters = {
	router: {
		initialPath: `/sessions/user/view/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
	}
};

export const CircleDevicesOk: Story = {
	name: 'Circle · pre-lobby with device check · desktop 1440',
	globals: desktop1440Globals,
	parameters: { ...circleParameters, ...textOnThePicture },
	args: { ...video, layout: 'desktop' },
	render: (args) => <CircleLobby {...args} />,
	play: async ({ canvasElement, args }) => {
		await expectSettled(canvasElement);
		// The circle's own elements stay: the clock and its start time.
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="group-entry-room"]')
			).not.toBeNull()
		);
		await userEvent.click(
			page(canvasElement).getByTestId('call-prejoin-join')
		);
		await expectClosed(canvasElement);
		await expect(args.onJoin).toHaveBeenCalledWith({
			micOn: true,
			cameraOn: true
		});
		await expectWaitingRoomLayout(canvasElement, { frame: 'card' });
	}
};

export const CircleDevicesOkPhone: Story = {
	name: 'Circle · pre-lobby with device check · phone 390',
	globals: phone390Globals,
	parameters: { ...circleParameters, ...textOnThePicture },
	args: { ...video, layout: 'mobile' },
	render: (args) => <CircleLobby {...args} />,
	play: async ({ canvasElement }) => {
		await expectSettled(canvasElement);
		await expectBottomSheet(canvasElement);
	}
};

export const CirclePermissionDenied: Story = {
	name: 'Circle · permission denied',
	globals: desktop1440Globals,
	parameters: circleParameters,
	args: { ...video, layout: 'desktop', blocker: 'permissionDenied' },
	render: (args) => <CircleLobby {...args} />,
	play: async ({ canvasElement }) => {
		await expectSettled(canvasElement);
		await expect(
			page(canvasElement).getByTestId('call-notice')
		).toBeVisible();
	}
};

export const CircleNoCamera: Story = {
	name: 'Circle · no camera · phone 390',
	globals: phone390Globals,
	parameters: circleParameters,
	args: {
		...video,
		layout: 'mobile',
		devices: noCamera,
		cameraAvailable: false
	},
	render: (args) => <CircleLobby {...args} />,
	play: async ({ canvasElement }) => {
		await expectSettled(canvasElement);
		await expect(
			page(canvasElement).getByTestId('toggle-camera')
		).toBeDisabled();
	}
};
