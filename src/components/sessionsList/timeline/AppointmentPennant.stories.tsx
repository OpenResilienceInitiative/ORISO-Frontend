import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TopicTag } from '../../topicTag/TopicTag';
import { RoomNextAppointment } from './AppointmentSplitButton';
import type { FutureEntry } from './timelineModel';
import '../../sessionHeader/sessionHeader.styles.scss';

/**
 * FE#2494 — the room's appointments as pennants hanging from the header
 * divider beside the topic, instead of the grey split button below the
 * header (Frank, 2026-11-24). Front bubble: the Art. Back bubble: the arrow
 * that opens the appointment menu (open, move, cancel …).
 */
const askerAppointment: FutureEntry = {
	key: 'booking-7001',
	kind: 'one-to-one',
	sessionId: 4401,
	title: 'Ruhiges Yak Kim',
	topic: 'Familienberatung',
	start: new Date('2026-11-24T14:30:00'),
	end: new Date('2026-11-24T15:30:00'),
	modality: 'video',
	canDuplicate: false,
	canModerate: true
};
const supervisorAppointment: FutureEntry = {
	...askerAppointment,
	key: 'colleague-88',
	start: new Date('2026-11-26T10:00:00'),
	end: new Date('2026-11-26T10:45:00'),
	modality: 'audio'
};
const requested: FutureEntry = { ...askerAppointment, requested: true };

/** The 1:1 header as the app draws it: name row, divider, topic row. */
const Header = ({
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
			background: 'var(--m3-surface-container-lowest, #fff)',
			fontFamily: 'Inter Variable, arial, sans-serif'
		}}
	>
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				height: 64,
				padding: '0 16px',
				borderBottom: '1px solid var(--m3-outline-variant, #f3c5c5)',
				fontSize: 22
			}}
		>
			<span
				aria-hidden
				style={{
					width: 48,
					height: 48,
					borderRadius: '50%',
					background: '#5b3f99'
				}}
			/>
			Ruhiges Yak Kim
		</div>
		<div
			className="sessionInfo__metaInfo"
			style={{
				display: 'flex',
				alignItems: 'flex-start',
				flexWrap: 'nowrap',
				gap: 8,
				padding: '0 16px 0 54px'
			}}
		>
			<TopicTag className="sessionInfo__metaInfo__content">
				Familienberatung
			</TopicTag>
			{children}
		</div>
		<div style={{ height: 120, background: '#faf8f7' }} />
	</div>
);

const meta: Meta = {
	title: 'P0 v2.0.18/Termin aus dem Chatraum/Termin-Wimpel',
	globals: { locale: 'de' },
	parameters: { layout: 'centered' }
};
export default meta;
type Story = StoryObj;

/** One appointment with the advice seeker. */
export const One: Story = {
	name: 'Ein Termin',
	render: () => (
		<Header width={880}>
			<RoomNextAppointment entry={askerAppointment} role="counsellor" />
		</Header>
	),
	play: async ({ canvasElement }) => {
		const pennant = await within(canvasElement).findByRole('button', {
			name: /Di\. 24\. Nov|24\. Nov/
		});
		await userEvent.click(pennant);
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="timeline-entry-menu"]')
			).not.toBeNull()
		);
	}
};

/** With the advice seeker and with the supervisor: two pennants. */
export const Two: Story = {
	name: 'Zwei Termine: Ratsuchende + Supervision',
	render: () => (
		<Header width={880}>
			<RoomNextAppointment
				entry={askerAppointment}
				role="counsellor"
				extra={[
					{
						entry: supervisorAppointment,
						withLabel: 'Supervision'
					}
				]}
			/>
		</Header>
	)
};

/** An unanswered request: dashed, "Angefragt" first. */
export const Requested: Story = {
	name: 'Angefragter Termin',
	render: () => (
		<Header width={880}>
			<RoomNextAppointment entry={requested} role="counsellor" />
		</Header>
	)
};

/** Phone: the pennants wrap under the topic, nothing lies on the chat. */
export const Phone: Story = {
	name: 'Telefon: zwei Termine',
	globals: { viewport: { value: 'mobile1', isRotated: false } },
	render: () => (
		<Header width={375}>
			<RoomNextAppointment
				entry={askerAppointment}
				role="counsellor"
				extra={[
					{
						entry: supervisorAppointment,
						withLabel: 'Supervision'
					}
				]}
			/>
		</Header>
	)
};
