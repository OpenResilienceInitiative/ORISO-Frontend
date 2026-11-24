import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PanelHeader } from './PanelHeader';
import type { StackParticipant } from '../message/participantStack';
import { AppointmentPennant } from '../sessionsList/timeline/AppointmentPennant';
import type {
	EntryMenuItem,
	FutureEntry
} from '../sessionsList/timeline/timelineModel';
import {
	CLIENT_NAME,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME
} from './__storybook__/chatStageFixtures';
import './sidePanel.styles.scss';

/**
 * FE#2494 — the side rooms carry the same appointment pennant as the main
 * chat (Frank, 2026-11-24: "So ein Wimpel muss dann auch natürlich
 * allgemein dann bei Teamberatung auch sein"). It hangs from the panel's
 * hairline beside the channel tag. Supervision: the counsellor's next
 * appointment with the supervisor, rose like the room. Teamberatung: the
 * room's own blue-grey pair.
 */
const counsellor: StackParticipant = {
	userId: COUNSELLOR_MATRIX_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME,
	firstName: 'Mona',
	lastName: 'Sommer'
};
const supervisor: StackParticipant = {
	userId: SUPERVISOR_MATRIX_ID,
	username: 'bettina.b@oriso.invalid',
	displayName: SUPERVISOR_NAME,
	firstName: 'Bettina',
	lastName: 'Berg'
};

const supervisorAppointment: FutureEntry = {
	key: 'colleague-88',
	kind: 'one-to-one',
	title: SUPERVISOR_NAME,
	start: new Date('2026-11-26T10:00:00'),
	end: new Date('2026-11-26T10:45:00'),
	modality: 'audio',
	canDuplicate: false,
	canModerate: true
};
const teamAppointment: FutureEntry = {
	...supervisorAppointment,
	key: 'colleague-91',
	start: new Date('2026-11-27T09:00:00'),
	end: new Date('2026-11-27T09:30:00'),
	modality: 'video'
};
const MENU: EntryMenuItem[] = [
	{
		key: 'cancel',
		title: 'Termin absagen',
		description: 'Der Termin verschwindet aus beiden Kalendern.',
		disabled: false
	},
	{
		key: 'calendar',
		title: 'Im Kalender öffnen',
		description: 'Dort können Sie den Termin auch verschieben.',
		disabled: false
	}
];

const Host = ({
	width,
	children
}: {
	width: number;
	children: React.ReactNode;
}) => (
	<div
		style={{
			width,
			maxWidth: '100%',
			padding: 24,
			boxSizing: 'border-box',
			background: 'var(--m3-surface-container-high, #eae7e8)'
		}}
	>
		<div
			className="sidePanel"
			style={{
				height: 220,
				borderRadius: 16,
				overflow: 'hidden',
				background: 'var(--m3-surface-container-lowest, #fff)'
			}}
		>
			{children}
		</div>
	</div>
);

const meta = {
	title: 'P0 v2.0.18/Termin aus dem Chatraum/Termin-Wimpel im Seitenraum',
	component: PanelHeader,
	globals: { locale: 'de' },
	parameters: { layout: 'fullscreen' },
	args: {
		kind: 'supervision',
		title: 'Supervision',
		name: SUPERVISOR_NAME,
		subtitle: 'Supervisor:in',
		participants: [counsellor, supervisor],
		onClose: () => undefined
	}
} satisfies Meta<typeof PanelHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Supervision: the next appointment with the supervisor, opens its menu. */
export const Supervision: Story = {
	name: 'Supervision mit Termin',
	render: (args) => (
		<Host width={480}>
			<PanelHeader
				{...args}
				appointments={
					<AppointmentPennant
						entry={supervisorAppointment}
						role="counsellor"
						menuItems={MENU}
					/>
				}
			/>
		</Host>
	),
	play: async ({ canvasElement }) => {
		const pennant = await within(canvasElement).findByRole('button', {
			name: /26\. Nov/
		});
		// It hangs from the hairline: its top is the divider's top.
		const divider = canvasElement.querySelector<HTMLElement>(
			'.panelHeader__divider'
		)!;
		await expect(
			Math.round(
				pennant.getBoundingClientRect().top -
					divider.getBoundingClientRect().top
			)
		).toBeLessThanOrEqual(1);
		await userEvent.click(pennant);
		await waitFor(() =>
			expect(
				within(document.body).getByRole('menuitem', {
					name: /Im Kalender öffnen/
				})
			).toBeVisible()
		);
	}
};

/** Teamberatung: the same pennant in the room's blue-grey pair. */
export const Team: Story = {
	name: 'Teamberatung mit Termin',
	args: {
		kind: 'team',
		title: 'Teamberatung',
		name: CLIENT_NAME,
		subtitle: undefined,
		chip: 'Nur Team'
	},
	render: (args) => (
		<Host width={480}>
			<PanelHeader
				{...args}
				appointments={
					<AppointmentPennant
						entry={teamAppointment}
						role="counsellor"
						menuItems={MENU}
					/>
				}
			/>
		</Host>
	)
};

/** Phone: the short date, the panel fills the screen. */
export const Phone: Story = {
	name: 'Telefon: Supervision mit Termin',
	globals: { viewport: { value: 'phone375', isRotated: false } },
	render: (args) => (
		<Host width={375}>
			<PanelHeader
				{...args}
				appointments={
					<AppointmentPennant
						entry={supervisorAppointment}
						role="counsellor"
						menuItems={MENU}
					/>
				}
			/>
		</Host>
	)
};
