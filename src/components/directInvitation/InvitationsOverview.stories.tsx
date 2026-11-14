import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import {
	InvitationsOverview,
	type UpcomingInvitation
} from './InvitationsOverview';

/** Pinned so the day headings ("Heute", "Morgen") never drift. */
const NOW = new Date(2026, 10, 20, 9, 0);
const at = (day: number, hour: number, minute = 0) =>
	new Date(2026, 10, day, hour, minute);

const APPOINTMENTS: UpcomingInvitation[] = [
	{
		id: 'a1',
		name: 'Termin Frau M. mit Dolmetscherin',
		start: at(20, 14),
		end: at(20, 15),
		expiresAt: at(21, 15),
		url: 'https://app.oriso.org/invite/Tm4FrMx',
		medium: 'VIDEO',
		access: 'both',
		knock: true
	},
	{
		id: 'a2',
		name: 'Schuldnerberatung Herr K.',
		start: at(21, 10, 30),
		end: at(21, 11, 15),
		medium: 'CHAT',
		counterpart: 'sanftes Alpaka Mika'
	},
	{
		id: 'a3',
		name: 'Familiengespräch',
		start: at(25, 16),
		end: at(25, 17),
		expiresAt: at(25, 17),
		url: 'https://app.oriso.org/invite/Fm9GsPr',
		medium: 'AUDIO',
		access: 'guests',
		knock: false
	}
];

/* #2252: validity ran out; the counsellor sends a new link from here. */
const EXPIRED: UpcomingInvitation[] = [
	{
		id: 'e1',
		name: 'Termin Frau S.',
		start: at(18, 9),
		end: at(18, 10),
		expiresAt: at(19, 10),
		medium: 'VIDEO',
		access: 'both',
		knock: true
	}
];

const LINKS: DirectLink[] = [
	{
		id: '1',
		name: 'Flyer Schule',
		topic: 'Schulden',
		topicId: 3,
		medium: 'VIDEO',
		temporary: true,
		active: true,
		url: 'https://app.oriso.org/invite/Ab3dE6gH'
	},
	{
		id: '2',
		name: 'Plakat Rathaus',
		topic: 'Sucht',
		topicId: 4,
		medium: 'CHAT',
		temporary: false,
		active: true,
		url: 'https://app.oriso.org/invite/Zy8xW6vU'
	}
];

const body = () => within(document.body);

const meta = {
	title: 'DirectInvitation/Overview',
	component: InvitationsOverview,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2252: "Termine & Direkteinladungen". Upcoming appointments by date (Direkteinladungen with date and 1:1 appointments alike) with link, QR, access and knock; below them the invitations without appointment as today\'s tiles. Designed states for no items at all and for one section with content. Presentational.'
			}
		}
	},
	args: {
		state: 'ready',
		appointments: APPOINTMENTS,
		links: LINKS,
		now: NOW,
		onCreate: fn(),
		onRetry: fn(),
		onShowAppointmentQr: fn(),
		onEditAppointment: fn(),
		onToggle: fn(),
		onShowQr: fn(),
		onEdit: fn(),
		onCopy: fn(),
		onSendNewLink: fn()
	},
	render: (args) => (
		<div style={{ height: '100vh' }}>
			<InvitationsOverview {...args} />
		</div>
	)
} satisfies Meta<typeof InvitationsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
	name: 'Full · 1440',
	globals: desktop1440Globals,
	play: async () => {
		await expect(body().getAllByTestId('upcoming-invitation')).toHaveLength(
			3
		);
		await expect(body().getByText(/^Heute,/)).toBeVisible();
		await expect(body().getByText(/^Morgen,/)).toBeVisible();
	}
};

export const FullPhone: Story = {
	name: 'Full · 390',
	globals: phone390Globals
};

export const FullDark: Story = {
	name: 'Full · dark · 1440',
	globals: { ...desktop1440Globals, scheme: 'dark' }
};

export const FullEnglish: Story = {
	name: 'Full · en · 390',
	globals: { ...phone390Globals, locale: 'en' }
};

/** An expired invitation, with "Neuen Link senden". */
export const WithExpired: Story = {
	name: 'With expired invitation · 1440',
	globals: desktop1440Globals,
	args: { expired: EXPIRED },
	play: async ({ args }) => {
		await userEvent.click(
			body().getByRole('button', {
				name: 'Neuen Link senden für Termin Frau S.'
			})
		);
		await expect(args.onSendNewLink).toHaveBeenCalled();
	}
};

export const WithExpiredPhone: Story = {
	name: 'With expired invitation · 390',
	globals: phone390Globals,
	args: { expired: EXPIRED }
};

/** One appointment and no other invitation: each section still reads finished. */
export const Few: Story = {
	name: 'Few · 1440',
	globals: desktop1440Globals,
	args: { appointments: APPOINTMENTS.slice(0, 1), links: [] },
	play: async () => {
		await expect(
			body().getByText('Keine Direkteinladungen ohne Termin.')
		).toBeVisible();
	}
};

export const FewPhoneDark: Story = {
	name: 'Few · dark · 390',
	globals: { ...phone390Globals, scheme: 'dark' },
	args: { appointments: [], links: LINKS.slice(0, 1) }
};

export const Empty: Story = {
	name: 'Empty · 1440',
	globals: desktop1440Globals,
	args: { appointments: [], links: [] },
	play: async () => {
		await expect(body().getByTestId('invitations-empty')).toBeVisible();
	}
};

export const EmptyPhone: Story = {
	name: 'Empty · 390',
	globals: phone390Globals,
	args: { appointments: [], links: [] }
};

export const EmptyEnglishDark: Story = {
	name: 'Empty · en · dark · 1440',
	globals: { ...desktop1440Globals, locale: 'en', scheme: 'dark' },
	args: { appointments: [], links: [] }
};

export const Loading: Story = {
	name: 'Loading · 1440',
	globals: desktop1440Globals,
	args: { state: 'loading' }
};

export const Failed: Story = {
	name: 'Failed · 1440',
	globals: desktop1440Globals,
	args: { state: 'failed' }
};
