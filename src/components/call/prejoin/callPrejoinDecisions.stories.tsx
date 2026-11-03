import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CircularProgress, useMediaQuery } from '@mui/material';
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
import { CallDeviceCheck } from '../../waitingRoom/callEntry/CallDeviceCheck';
import type {
	CallDevices,
	CallDeviceSelection
} from '../../waitingRoom/callEntry/callEntryTypes';
import type { Avatar } from '../../../utils/pseudonymGenerator';

/*
 * Step 1 of the product owner's decisions on #2017 (2026-11-03), Storybook
 * only: the existing pre-join dialog and device check, arranged as decided.
 *
 * A) One window for people who must knock: the same dialog stays open after
 *    "Jetzt beitreten"; its button says "Anfrage gesendet, bitte warten …"
 *    with a spinner, the preview and switches stay, "Nicht mehr warten"
 *    turns it back.
 * B) The device pickers stay, with a hint that the call uses the browser's
 *    default device for now (ORISO-ElementCall#116).
 */

const devices: CallDevices = {
	camera: [
		{ id: 'cam-1', label: 'FaceTime HD-Kamera' },
		{ id: 'cam-2', label: 'Logitech C920' }
	],
	microphone: [
		{ id: 'mic-1', label: 'MacBook Pro-Mikrofon' },
		{ id: 'mic-2', label: 'Jabra Evolve2 Headset' }
	],
	speaker: []
};

const owl: Avatar = { file: 'owl.svg', bg: '#FCE2C4', iconColor: '#1b1b1c' };

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

const OneWindow = ({ onKnock }: { onKnock: () => void }) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	const [open, setOpen] = useState(false);
	const [waiting, setWaiting] = useState(false);
	const [micOn, setMicOn] = useState(true);
	const [cameraOn, setCameraOn] = useState(true);
	const [selection, setSelection] = useState<CallDeviceSelection>({});
	return (
		<>
			<MessageStoryShell compact={phone}>
				<CallTimelineMessage
					call={runningCall}
					onJoin={() => {
						setOpen(true);
						return Promise.resolve('joined' as const);
					}}
				/>
			</MessageStoryShell>
			{open && (
				<M3Dialog
					onClose={() => setOpen(false)}
					closeLabel="Schließen"
					width={480}
					title="Kamera und Mikrofon prüfen"
					description="Niemand sieht oder hört Sie, bevor Sie beitreten. Die Vorschau sehen nur Sie."
					showDivider={false}
					className={
						phone
							? 'knockWaitDialog knockWaitDialog--sheet'
							: 'knockWaitDialog'
					}
					data-testid="knock-wait-dialog"
					actionsContent={
						waiting ? (
							<>
								<button
									type="button"
									className="m3Dialog__action"
									onClick={() => setWaiting(false)}
									data-testid="knock-wait-cancel"
								>
									Nicht mehr warten
								</button>
								<button
									type="button"
									className="m3Dialog__action m3Dialog__action--primary"
									disabled
									aria-busy
									data-testid="knock-wait-join"
								>
									<CircularProgress
										size={14}
										thickness={5}
										color="inherit"
										aria-hidden
										sx={{ mr: 1, verticalAlign: -2 }}
									/>
									Anfrage gesendet, bitte warten …
								</button>
							</>
						) : (
							<button
								type="button"
								className="m3Dialog__action m3Dialog__action--primary"
								onClick={() => {
									onKnock();
									setWaiting(true);
								}}
								data-testid="knock-wait-join"
							>
								Jetzt beitreten
							</button>
						)
					}
				>
					<CallDeviceCheck
						modality="video"
						name="eule_mika_4821"
						avatar={owl}
						devices={devices}
						selection={selection}
						micLevel={0.45}
						micOn={micOn}
						cameraOn={cameraOn}
						onToggleMic={() => setMicOn((on) => !on)}
						onToggleCamera={() => setCameraOn((on) => !on)}
						onSelectDevice={(kind, id) =>
							setSelection((now) => ({ ...now, [kind]: id }))
						}
					/>
					<p className="knockWaitDialog__quiet">
						Der Anruf nutzt vorerst das Standardgerät Ihres
						Browsers.
					</p>
				</M3Dialog>
			)}
		</>
	);
};

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

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
	title: 'Entry flows/Pre-join device check (signed in)/Decisions sketch',
	parameters: { layout: 'fullscreen', ...textOnThePicture },
	args: { onKnock: fn() },
	render: (args) => <OneWindow {...args} />
} satisfies Meta<typeof OneWindow>;
export default meta;
type Story = StoryObj<typeof meta>;

const knockAndWait = async (canvasElement: HTMLElement) => {
	const p = page(canvasElement);
	await userEvent.click(
		await p.findByRole('button', { name: /Beitreten|Join call/ })
	);
	await userEvent.click(await p.findByTestId('knock-wait-join'));
	await waitFor(() =>
		expect(p.getByTestId('knock-wait-join')).toHaveTextContent(
			'Anfrage gesendet, bitte warten …'
		)
	);
};

export const KnockOneWindow: Story = {
	name: 'Knock · one window: waiting keeps the preview · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement, args }) => {
		const p = page(canvasElement);
		await knockAndWait(canvasElement);
		await expect(args.onKnock).toHaveBeenCalledTimes(1);
		await expect(p.getByTestId('video-check')).toBeVisible();
		await expect(p.getByTestId('knock-wait-join')).toBeDisabled();
		await expect(p.getAllByTestId('knock-wait-dialog')).toHaveLength(1);
		await expect(
			p.getByText(
				'Der Anruf nutzt vorerst das Standardgerät Ihres Browsers.'
			)
		).toBeVisible();
	}
};

export const KnockStopWaiting: Story = {
	name: 'Knock · "Nicht mehr warten" turns the button back',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		const p = page(canvasElement);
		await knockAndWait(canvasElement);
		await userEvent.click(p.getByTestId('knock-wait-cancel'));
		await expect(p.getByTestId('knock-wait-join')).toHaveTextContent(
			'Jetzt beitreten'
		);
		await expect(p.getByTestId('video-check')).toBeVisible();
	}
};

export const KnockOneWindowPhone: Story = {
	name: 'Knock · one window · phone 390',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		await knockAndWait(canvasElement);
		await expect(
			page(canvasElement).getByTestId('video-check')
		).toBeVisible();
	}
};
