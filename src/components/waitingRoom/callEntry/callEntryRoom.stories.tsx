import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Stage } from '../../stage/stage';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { AgencySpecificContext } from '../../../globalState';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../../globalState/provider/LegalLinksProvider';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { expectWaitingRoomLayout } from '../../app/registrationLoader/waitingRoomLayoutContract';
import { CallEntryRoom, CallEntryRoomProps } from './CallEntryRoom';
import { CallDeviceControls, CallDevices } from './callEntryTypes';
import type { Pseudonym } from '../../../utils/pseudonymGenerator';
import { useLiveCallDevices } from './useLiveCallDevices';

/**
 * **Call entry** — the waiting room before a video or phone call
 * (ORISO-Frontend#1386). Prototype: Storybook only, nothing calls Element
 * Call yet.
 *
 * Built from the shared waiting-room parts (frame, bar, gate), so every
 * story checks the same layout contract as the registration, live chat and
 * self-help rooms. The audio-only call has its own design (`VoiceCheck`),
 * not the video one with the picture hidden.
 *
 * Device names and microphone levels are fixtures. "Live devices" asks the
 * browser for the real ones.
 */
const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

const meta: Meta<typeof CallEntryRoom> = {
	title: 'Entry flows/Call entry/Device check',
	component: CallEntryRoom,
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
						<Box sx={{ minHeight: '100vh' }}>
							<Story />
						</Box>
					</AgencySpecificContext.Provider>
				</LegalLinksContext.Provider>
			</GlobalComponentContext.Provider>
		)
	]
};
export default meta;

type Story = StoryObj<typeof CallEntryRoom>;

const devices: CallDevices = {
	camera: [
		{ id: 'cam-1', label: 'FaceTime HD-Kamera' },
		{ id: 'cam-2', label: 'Logitech C920' }
	],
	microphone: [
		{ id: 'mic-1', label: 'MacBook Pro-Mikrofon' },
		{ id: 'mic-2', label: 'AirPods Pro' }
	],
	speaker: [
		{ id: 'spk-1', label: 'MacBook Pro-Lautsprecher' },
		{ id: 'spk-2', label: 'AirPods Pro' }
	]
};

/** Fixed animal and User-ID, so screenshots and tests do not reroll. */
const owl: Pseudonym = {
	displayName: 'freundliche Eule Mika',
	avatar: { file: 'owl.svg', bg: '#FCE2C4', iconColor: '#1b1b1c' },
	animalLabel: 'Eule',
	name: 'Mika'
};

/** The tone takes no time in tests; nothing is played. */
const silentTone = () => Promise.resolve();

const base: Partial<CallEntryRoomProps> = {
	devices,
	topic: 'Schuldnerberatung',
	initialIdentity: owl,
	initialUsername: 'eule_mika_4821',
	playTone: silentTone,
	onJoin: () => undefined,
	onBlockerAction: () => undefined
};

const ready: Partial<CallEntryRoomProps> = {
	...base,
	initialPassword: 'Sonnenblume-2026!',
	initialMicHeard: true,
	micLevel: 0.55
};

const gate = (canvasElement: HTMLElement) =>
	canvasElement.ownerDocument.querySelector<HTMLElement>(
		'[data-cy="call-entry-gate"]'
	)!;

const expectProgress = async (canvasElement: HTMLElement, fill: number) =>
	waitFor(() =>
		expect(
			gate(canvasElement).parentElement!.getAttribute('data-cy-progress')
		).toBe(String(fill))
	);

/* ---------- Video ---------- */

export const VideoReady: Story = {
	name: 'Video · ready',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectProgress(canvasElement, 100);
		expect(gate(canvasElement).getAttribute('data-cy-state')).toBe('ready');
	}
};

export const VideoCameraOff: Story = {
	name: 'Video · camera off',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video', initialCameraOn: false },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		// The camera may stay off; the gate is still open.
		await expect(canvas.getByText('Ihre Kamera ist aus')).toBeVisible();
		// Without a picture the others see the chosen animal.
		await expect(canvas.getByTestId('video-avatar')).toBeVisible();
		expect(gate(canvasElement).getAttribute('data-cy-state')).toBe('ready');
	}
};

export const VideoPasswordMissing: Story = {
	name: 'Video · password still missing',
	globals: desktop1440Globals,
	args: {
		...base,
		modality: 'video',
		initialMicHeard: true,
		micLevel: 0.3
	},
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectProgress(canvasElement, 67);
		await expect(canvas.getByText('Noch offen: Passwort')).toBeVisible();
		await userEvent.type(
			canvasElement.querySelector<HTMLInputElement>(
				'input[autocomplete="new-password"]'
			)!,
			'Sonnenblume-2026!'
		);
		await expectProgress(canvasElement, 100);
		expect(gate(canvasElement).getAttribute('data-cy-state')).toBe('ready');
	}
};

export const VideoSwitchesAndSpeaker: Story = {
	name: 'Video · mic switch and speaker test',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video' },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		// A stable name; `aria-pressed` says whether the device is on.
		const mic = canvas.getByRole('button', {
			name: 'Mikrofon',
			pressed: true
		});
		await expect(
			canvas.getByRole('button', { name: 'Kamera', pressed: true })
		).toBeVisible();
		await userEvent.click(mic);
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(mic).toHaveAccessibleName('Mikrofon');
		await userEvent.click(canvas.getByTestId('speaker-test'));
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Ja' })
		);
		await expect(
			canvas.getByText('Ihr Lautsprecher funktioniert.')
		).toBeVisible();
	}
};

export const VideoUserIdTooShort: Story = {
	name: 'Video · User-ID too short',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video', initialUsername: 'eu' },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		// The registration's rule (5–30 characters), not "not empty".
		await expectProgress(canvasElement, 67);
		await expect(canvas.getByText('Noch offen: User-ID')).toBeVisible();
	}
};

export const VideoChooseDevice: Story = {
	name: 'Video · choose a microphone',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video' },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		await userEvent.click(canvas.getByTestId('device-picker-microphone'));
		const menu = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			await menu.findByRole('menuitem', { name: 'AirPods Pro' })
		);
		await expect(
			canvas.getByTestId('device-picker-microphone')
		).toHaveAccessibleName('Mikrofon: AirPods Pro');
	}
};

export const VideoChangeAvatar: Story = {
	name: 'Video · roll a new avatar and User-ID',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'video', initialCameraOn: false },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		const avatar = canvas.getByTestId('call-entry-avatar');
		const before = avatar.innerHTML;
		await userEvent.click(canvas.getByRole('button', { name: 'Avatar' }));
		await waitFor(() => expect(avatar.innerHTML).not.toBe(before));
		const userId = canvas.getByRole('textbox', { name: /User-ID/ });
		await userEvent.click(canvas.getByRole('button', { name: 'User-ID' }));
		await waitFor(() =>
			expect((userId as HTMLInputElement).value).not.toBe(
				'eule_mika_4821'
			)
		);
	}
};

export const VideoPhone: Story = {
	name: 'Video · phone',
	globals: phone390Globals,
	args: { ...ready, modality: 'video' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/* ---------- Audio only ---------- */

export const AudioFirstLook: Story = {
	name: 'Audio · first look',
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0 },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expect(canvas.getByTestId('voice-check')).toBeVisible();
		// No picture in a phone call — not a hidden one either.
		expect(canvas.queryByTestId('video-check')).toBeNull();
		expect(canvas.queryByTestId('device-picker-camera')).toBeNull();
		await expectProgress(canvasElement, 33);
	}
};

export const AudioReady: Story = {
	name: 'Audio · ready',
	globals: desktop1440Globals,
	args: {
		...ready,
		modality: 'audio',
		initialSpeakerTest: 'heard',
		micLevel: 0.6
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectProgress(canvasElement, 100);
	}
};

export const AudioHeardOnceSpeaking: Story = {
	name: 'Audio · the meter hears the voice',
	globals: desktop1440Globals,
	args: {
		...base,
		modality: 'audio',
		initialPassword: 'Sonnenblume-2026!',
		micLevel: 0.7
	},
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		// A level above the threshold counts as "heard" — real, not a timer.
		await expect(await canvas.findByText('Wir hören Sie.')).toBeVisible();
		await expectProgress(canvasElement, 100);
	}
};

export const AudioMuted: Story = {
	name: 'Audio · joining muted',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'audio', initialMicOn: false, micLevel: 0 },
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expect(canvas.getByText(/Sie treten stumm bei/)).toBeVisible();
	}
};

export const AudioPasswordTooWeak: Story = {
	name: 'Audio · password does not meet the rules yet',
	globals: desktop1440Globals,
	args: {
		...base,
		modality: 'audio',
		initialMicHeard: true,
		initialPassword: 'kurz',
		micLevel: 0.3
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectProgress(canvasElement, 67);
	}
};

export const AudioPhone: Story = {
	name: 'Audio · phone, speaker question',
	globals: phone390Globals,
	args: { ...ready, modality: 'audio', initialSpeakerTest: 'asking' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/* ---------- When the check cannot run ---------- */

export const PermissionDenied: Story = {
	name: 'Blocked · microphone denied',
	globals: desktop1440Globals,
	args: {
		...base,
		modality: 'video',
		micLevel: 0,
		blocker: 'permissionDenied'
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const PermissionDeniedPhone: Story = {
	name: 'Blocked · microphone denied, phone',
	globals: phone390Globals,
	args: {
		...base,
		modality: 'audio',
		micLevel: 0,
		blocker: 'permissionDenied'
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const NoDevice: Story = {
	name: 'Blocked · no microphone',
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0, blocker: 'noDevice' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const NotOpenYet: Story = {
	name: 'Blocked · room not open yet',
	globals: desktop1440Globals,
	args: { ...base, modality: 'video', micLevel: 0, blocker: 'notOpenYet' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const CallEnded: Story = {
	name: 'Blocked · call ended',
	globals: desktop1440Globals,
	args: { ...base, modality: 'video', micLevel: 0, blocker: 'callEnded' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const LinkInvalid: Story = {
	name: 'Blocked · link no longer valid',
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0, blocker: 'linkInvalid' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/* ---------- Demo and live ---------- */

/** Invented level curve, so the rings can be seen moving. Not a measurement. */
const useDemoVoice = () => {
	const [level, setLevel] = useState(0);
	useEffect(() => {
		const started = Date.now();
		const id = setInterval(() => {
			const t = (Date.now() - started) / 1000;
			const syllables = Math.max(0, Math.sin(t * 9) * Math.sin(t * 1.3));
			setLevel(Math.min(1, syllables * 0.9));
		}, 60);
		return () => clearInterval(id);
	}, []);
	return level;
};

const DemoVoice = (props: CallEntryRoomProps) => (
	<CallEntryRoom {...props} micLevel={useDemoVoice()} />
);

export const AudioDemoSpeaking: Story = {
	name: 'Audio · demo: speaking (invented levels)',
	globals: desktop1440Globals,
	args: { ...ready, modality: 'audio' },
	render: (args) => <DemoVoice {...args} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

const Live = ({
	mediaDevices,
	...props
}: CallEntryRoomProps & { mediaDevices?: MediaDevices }) => {
	const [controls, setControls] = useState<CallDeviceControls>(() => ({
		micOn: props.initialMicOn ?? true,
		cameraOn: props.initialCameraOn ?? true,
		selection: props.initialSelection ?? {}
	}));
	const live = useLiveCallDevices(props.modality, controls, mediaDevices);
	return (
		<CallEntryRoom
			{...props}
			devices={live.devices}
			stream={live.stream}
			micLevel={live.micLevel}
			blocker={live.blocker}
			cameraAvailable={!live.cameraMissing}
			onDeviceStateChange={setControls}
			onBlockerAction={live.retry}
			playTone={undefined}
		/>
	);
};

/**
 * Real devices. In the headless test run nobody answers the permission
 * prompt, so the room stays in whatever state the browser leaves it in
 * (waiting, denied or no device); the layout contract holds in each. The
 * scripted stories below pin the hook's behaviour itself.
 */
export const LiveVideo: Story = {
	name: 'Live devices · video (asks for camera and mic)',
	globals: desktop1440Globals,
	args: { ...base, modality: 'video', micLevel: 0 },
	render: (args) => <Live {...args} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const LiveAudio: Story = {
	name: 'Live devices · audio (asks for the mic)',
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0 },
	render: (args) => <Live {...args} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/** A real, silent microphone track, so the analyser has something to read. */
const silentMicrophone = () =>
	new AudioContext().createMediaStreamDestination().stream;

const scriptedDevices = (
	getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
) =>
	({
		getUserMedia,
		enumerateDevices: () =>
			Promise.resolve([
				{
					kind: 'audioinput',
					deviceId: 'mic-1',
					label: 'Headset-Mikrofon'
				},
				{
					kind: 'audiooutput',
					deviceId: 'spk-1',
					label: 'Headset'
				}
			] as MediaDeviceInfo[])
	}) as unknown as MediaDevices;

const domError = (name: string) =>
	Promise.reject(Object.assign(new Error(name), { name }));

/** No webcam, a working microphone: the check goes on, camera off. */
const noWebcam = scriptedDevices((constraints) =>
	constraints.video
		? domError('NotFoundError')
		: Promise.resolve(silentMicrophone())
);

export const LiveVideoNoWebcam: Story = {
	name: 'Live hook · video without a webcam (scripted devices)',
	globals: desktop1440Globals,
	args: {
		...base,
		modality: 'video',
		micLevel: 0,
		initialPassword: 'Sonnenblume-2026!'
	},
	render: (args) => <Live {...args} mediaDevices={noWebcam} />,
	play: async ({ canvasElement, canvas }) => {
		await expect(
			await canvas.findByTestId('device-picker-microphone')
		).toHaveAccessibleName('Mikrofon: Headset-Mikrofon');
		await expectWaitingRoomLayout(canvasElement);
		await expect(canvas.getByText('Ihre Kamera ist aus')).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: 'Kamera', pressed: false })
		).toBeVisible();
	}
};

/** Denied once, allowed on "Erneut prüfen" (fresh on every render). */
const deniedOnce = () => {
	let asked = 0;
	return scriptedDevices(() =>
		asked++ === 0
			? domError('NotAllowedError')
			: Promise.resolve(silentMicrophone())
	);
};

const LiveDeniedOnce = (props: CallEntryRoomProps) => {
	const [mediaDevices] = useState(deniedOnce);
	return <Live {...props} mediaDevices={mediaDevices} />;
};

export const LiveRetryAfterDenied: Story = {
	name: 'Live hook · "Erneut prüfen" asks again (scripted devices)',
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0 },
	render: (args) => <LiveDeniedOnce {...args} />,
	play: async ({ canvasElement, canvas }) => {
		await waitFor(() =>
			expect(gate(canvasElement)).toHaveTextContent('Erneut prüfen')
		);
		await expectWaitingRoomLayout(canvasElement);
		await userEvent.click(gate(canvasElement));
		await expect(await canvas.findByTestId('voice-check')).toBeVisible();
		await expectWaitingRoomLayout(canvasElement);
	}
};
