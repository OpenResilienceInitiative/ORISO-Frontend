import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import {
	InvitationBeforeStart,
	InvitationExpired,
	type NewLinkRequestState
} from './InvitationEntryStates';
import { newLinkRequestEntry } from './NewLinkRequestNotice';

const SLOT = {
	start: new Date(2026, 10, 20, 14, 0),
	end: new Date(2026, 10, 20, 15, 0)
};

const body = () => within(document.body);

const Page = ({ children }: { children: React.ReactNode }) => (
	<div
		style={{
			minHeight: '100vh',
			background: 'var(--m3-surface-container-lowest)',
			display: 'flex',
			alignItems: 'center'
		}}
	>
		{children}
	</div>
);

const meta = {
	title: 'DirectInvitation/Entry states',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2252: the invite page outside the call. Before the waiting room opens (15 minutes before the start): the date, "In Kalender eintragen" (.ics) and the chat, which works at once. After the validity ends: "Link abgelaufen" with "Neuen Link anfragen"; the counsellor then gets a pop-up with "Neuen Link senden".'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const BeforeStart = () => (
	<Page>
		<InvitationBeforeStart
			slot={SLOT}
			counsellorName="Anna Berg"
			onAddToCalendar={fn()}
			onOpenChat={fn()}
		/>
	</Page>
);

export const BeforeStartDesktop: Story = {
	name: 'Before start · 1440',
	globals: desktop1440Globals,
	render: () => <BeforeStart />,
	play: async () => {
		await expect(
			body().getByRole('button', { name: 'In Kalender eintragen' })
		).toBeVisible();
		await expect(body().getByText(/13:45 Uhr/)).toBeVisible();
	}
};

export const BeforeStartPhone: Story = {
	name: 'Before start · 390',
	globals: phone390Globals,
	render: () => <BeforeStart />
};

export const BeforeStartPhoneDark: Story = {
	name: 'Before start · dark · 390',
	globals: { ...phone390Globals, scheme: 'dark' },
	render: () => <BeforeStart />
};

export const BeforeStartEnglish: Story = {
	name: 'Before start · en · 1440',
	globals: { ...desktop1440Globals, locale: 'en' },
	render: () => <BeforeStart />
};

const Expired = ({ initial = 'idle' }: { initial?: NewLinkRequestState }) => {
	const [state, setState] = useState<NewLinkRequestState>(initial);
	return (
		<Page>
			<InvitationExpired
				requestState={state}
				onRequestNewLink={() => setState('sent')}
			/>
		</Page>
	);
};

export const ExpiredDesktop: Story = {
	name: 'Expired · 1440',
	globals: desktop1440Globals,
	render: () => <Expired />,
	play: async () => {
		await userEvent.click(
			body().getByRole('button', { name: 'Neuen Link anfragen' })
		);
		await expect(body().getByRole('status')).toHaveTextContent(
			/Anfrage gesendet/
		);
	}
};

export const ExpiredPhone: Story = {
	name: 'Expired · 390',
	globals: phone390Globals,
	render: () => <Expired />
};

export const ExpiredPhoneDark: Story = {
	name: 'Expired · dark · 390',
	globals: { ...phone390Globals, scheme: 'dark' },
	render: () => <Expired />
};

export const ExpiredEnglish: Story = {
	name: 'Expired · en · 1440',
	globals: { ...desktop1440Globals, locale: 'en' },
	render: () => <Expired />
};

export const ExpiredRequestFailed: Story = {
	name: 'Expired · request failed · 390',
	globals: phone390Globals,
	render: () => <Expired initial="failed" />
};

/** The counsellor's side: a pop-up on the snackbar stack, never a box in the page. */
const CounsellorNotice = () => {
	const { t } = useTranslation();
	const stack = useMemo(() => createSnackbarStack(), []);
	useEffect(() => {
		stack.enqueue(
			newLinkRequestEntry(
				{
					invitationId: 'a1',
					invitationName: 'Termin Frau M.',
					requesterName: 'sanftes Alpaka Mika'
				},
				t,
				fn()
			)
		);
		return () => stack.clear();
	}, [stack, t]);
	return (
		<div
			style={{
				minHeight: '100vh',
				background: 'var(--m3-surface-container)'
			}}
		>
			<M3SnackbarHost stack={stack} />
		</div>
	);
};

export const CounsellorNoticeDesktop: Story = {
	name: 'Counsellor notice "Neuen Link senden" · 1440',
	globals: desktop1440Globals,
	render: () => <CounsellorNotice />,
	play: async () => {
		await waitFor(() =>
			expect(
				body().getByRole('button', { name: 'Neuen Link senden' })
			).toBeVisible()
		);
	}
};

export const CounsellorNoticePhone: Story = {
	name: 'Counsellor notice "Neuen Link senden" · 390',
	globals: phone390Globals,
	render: () => <CounsellorNotice />
};
