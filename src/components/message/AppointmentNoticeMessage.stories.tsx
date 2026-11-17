import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AUTHORITIES } from '../../globalState';
import { lendAppointmentCreate } from '../sessionsList/timeline/appointmentCreateBridge';
import { AppointmentNoticeCard } from './AppointmentNoticeMessage';
import type { AppointmentNotice } from './appointmentNotice';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockUserData
} from './MessageItemComponent.mocks';
import { MessageContextShell, phone375Globals } from './messageStoryShell';
import './message.styles.scss';

/**
 * Appointment changes in a 1:1 conversation (FE#1960 notice): booked, moved,
 * cancelled. Until now each was a plain pink bubble with one sentence
 * ("Termin abgesagt: Mi 18. Nov 10:00–11:00"). Each event now has its own
 * card with the calendar's glyph — the same ones its menus use for
 * "Verschieben" and "Absagen" —, a move shows old → new, a cancellation the
 * slot struck through.
 *
 * Shortcuts, only where the viewer may use them:
 * - **Counsellor**, after a cancellation: "Neuen Termin anlegen" opens the
 *   room's own create dialog (the ⋮ menu's "Termin anlegen"), as long as
 *   nothing new is booked yet.
 * - **Counsellor and advice seeker**, on a booked or moved appointment:
 *   "Im Kalender öffnen" goes to that day in "Meine Termine".
 */
const meta: Meta = {
	title: 'Chat/System messages/Appointment events',
	parameters: {
		docs: {
			description: {
				component:
					'Termin-Ereignisse im Chatverlauf: vereinbart, verschoben (alt → neu), abgesagt (durchgestrichen). Nach einer Absage bietet die Karte der Beraterin „Neuen Termin anlegen“; vereinbarte und verschobene Termine öffnen sich „Im Kalender“.'
			}
		}
	}
};
export default meta;
type Story = StoryObj<{
	onCreateNew: () => void;
	viewer: 'counsellor' | 'asker';
	compact: boolean;
}>;

const at = (hours: number) => new Date(2026, 10, 18, hours, 0);

/** Frank's dev.oriso.org conversation of 2026-11-17, as data. */
const SEQUENCE: { notice: AppointmentNotice; time: string }[] = [
	{
		notice: { kind: 'created', slot: { start: at(10), end: at(11) } },
		time: '11:17'
	},
	{
		notice: {
			kind: 'moved',
			slot: { start: at(13), end: at(14) },
			previous: { start: at(10), end: at(11) }
		},
		time: '11:18'
	},
	{
		notice: {
			kind: 'moved',
			slot: { start: at(10), end: at(11) },
			previous: { start: at(13), end: at(14) }
		},
		time: '11:18'
	},
	{
		notice: { kind: 'cancelled', slot: { start: at(10), end: at(11) } },
		time: '12:00'
	}
];

/** The same four as they were sent before the payload: plain sentences. */
const LEGACY: { notice: AppointmentNotice; time: string }[] = [
	{
		notice: { kind: 'created', slotText: 'Mi 18. Nov 10:00–11:00' },
		time: '11:17'
	},
	{
		notice: { kind: 'moved', slotText: 'Mi 18. Nov 13:00–14:00' },
		time: '11:18'
	},
	{
		notice: { kind: 'cancelled', slotText: 'Mi 18. Nov 10:00–11:00' },
		time: '12:00'
	}
];

const session = mockActiveSession1on1({
	consultant: { id: 'c-bart', username: 'bart.simpson' } as never
});
const SESSION_ID = session.item.id;

const asker = mockUserData({
	userId: MOCK_ASKER_MATRIX_ID,
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
});

/**
 * What the room's appointment slot does for its counsellor in a running
 * conversation: it lends its create dialog to the chat's cards.
 */
const LendCreate = ({ open }: { open: () => void }) => {
	React.useEffect(
		() =>
			lendAppointmentCreate(SESSION_ID, {
				open,
				hasUpcoming: false
			}),
		[open]
	);
	return null;
};

const Conversation = ({
	viewer,
	items,
	compact,
	onCreateNew
}: {
	viewer: 'counsellor' | 'asker';
	items: { notice: AppointmentNotice; time: string }[];
	compact: boolean;
	onCreateNew: () => void;
}) => (
	<MessageContextShell
		compact={compact}
		activeSession={session}
		userData={viewer === 'asker' ? asker : mockUserData()}
	>
		{viewer === 'counsellor' && <LendCreate open={onCreateNew} />}
		<div style={{ display: 'grid', gap: 16 }}>
			{items.map(({ notice, time }, index) => (
				<AppointmentNoticeCard
					key={index}
					notice={notice}
					sessionId={SESSION_ID}
					byName="Bart Simpson"
					timestamp={time}
				/>
			))}
		</div>
	</MessageContextShell>
);

const render: Story['render'] = ({ viewer, compact, onCreateNew }) => (
	<Conversation
		viewer={viewer}
		items={SEQUENCE}
		compact={compact}
		onCreateNew={onCreateNew}
	/>
);

const createLabel = /Neuen Termin anlegen|Add new appointment/;
const calendarLabel = /Im Kalender öffnen|Open in calendar/;

/** Booked, moved twice, cancelled — with "Neuen Termin anlegen" at the end. */
export const Counsellor: Story = {
	args: { viewer: 'counsellor', compact: false, onCreateNew: fn() },
	render,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		// The row fades in like every chat message.
		await waitFor(() =>
			expect(
				canvas.getByTestId('appointment-notice-icon-created')
			).toBeVisible()
		);
		await expect(
			canvas.getAllByTestId('appointment-notice-icon-moved')
		).toHaveLength(2);
		const cancelled = canvas.getAllByTestId('appointment-notice-slot')[3];
		await expect(cancelled.tagName).toBe('DEL');
		await expect(
			canvas.getAllByRole('button', { name: calendarLabel })
		).toHaveLength(3);
		await userEvent.click(
			canvas.getByRole('button', { name: createLabel })
		);
		await expect(args.onCreateNew).toHaveBeenCalledTimes(1);
	}
};

/** The same conversation for the advice seeker: no "Neuen Termin anlegen". */
export const AdviceSeeker: Story = {
	args: { viewer: 'asker', compact: false, onCreateNew: fn() },
	render,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('button', { name: createLabel })
		).toBeNull();
		await expect(
			canvas.getAllByRole('button', { name: calendarLabel })
		).toHaveLength(3);
	}
};

/** On a phone (375px) the actions wrap below the slot. */
export const CounsellorPhone: Story = {
	args: { viewer: 'counsellor', compact: true, onCreateNew: fn() },
	globals: phone375Globals,
	render
};

/**
 * Notices sent before the payload were plain sentences: they get the same
 * look, worded as sent. Without the times as data a move cannot show its old
 * slot and the calendar link has no day; "Neuen Termin anlegen" works.
 */
export const SentBeforeThisChange: Story = {
	args: { viewer: 'counsellor', compact: false, onCreateNew: fn() },
	render: ({ viewer, compact, onCreateNew }) => (
		<Conversation
			viewer={viewer}
			items={LEGACY}
			compact={compact}
			onCreateNew={onCreateNew}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: createLabel })
			).toBeVisible()
		);
		await expect(
			canvas.queryByRole('button', { name: calendarLabel })
		).toBeNull();
	}
};
