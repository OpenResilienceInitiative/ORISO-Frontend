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
import { CallDevices } from './callEntryTypes';
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
		const mic = canvas.getByTestId('toggle-mic');
		await userEvent.click(mic);
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(canvas.getByTestId('speaker-test'));
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Ja' })
		);
		await expect(
			canvas.getByText('Ihr Lautsprecher funktioniert.')
		).toBeVisible();
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
	tags: ['!test'],
	globals: desktop1440Globals,
	args: { ...ready, modality: 'audio' },
	render: (args) => <DemoVoice {...args} />
};

const Live = (props: CallEntryRoomProps) => {
	const live = useLiveCallDevices(props.modality);
	return (
		<CallEntryRoom
			{...props}
			devices={live.devices}
			stream={live.stream}
			micLevel={live.micLevel}
			blocker={live.blocker}
			playTone={undefined}
		/>
	);
};

export const LiveVideo: Story = {
	name: 'Live devices · video (asks for camera and mic)',
	tags: ['!test'],
	globals: desktop1440Globals,
	args: { ...base, modality: 'video', micLevel: 0 },
	render: (args) => <Live {...args} />
};

export const LiveAudio: Story = {
	name: 'Live devices · audio (asks for the mic)',
	tags: ['!test'],
	globals: desktop1440Globals,
	args: { ...base, modality: 'audio', micLevel: 0 },
	render: (args) => <Live {...args} />
};
