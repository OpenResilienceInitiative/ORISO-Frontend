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
import { invitationErrorEntry } from './invitationErrorSnackbar';
import { expectWaitingRoomLayout } from '../app/registrationLoader/waitingRoomLayoutContract';
import { Stage } from '../stage/stage';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { storyLegalLinks } from '../waitingRoom/storyLegalLinks';

const SLOT = {
	start: new Date(2026, 10, 20, 14, 0),
	end: new Date(2026, 10, 20, 15, 0)
};

const CALL_OPENS_AT = new Date(2026, 10, 20, 13, 45);

const body = () => within(document.body);

const meta = {
	title: 'DirectInvitation/Entry states',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2252: the invite page outside the call, in the one waiting-room frame (EntryRoomShell, shared bar). Before the waiting room opens (the server\'s callOpensAt, 15 minutes before the start): the date, "Termin eintragen" (.ics, the group room\'s calendar pill) and the chat, which works at once. After the validity ends: "Link abgelaufen" with "Neuen Link anfragen" (signed in) or the sign-in (signed out); a failure is a pop-up. The counsellor gets a pop-up with "Neuen Link senden".'
			}
		}
	},
	/* The app's stage and legal links, as in every waiting-room story: below
	   1200 px the layout contract needs the header's "Rechtliches" menu. */
	decorators: [
		(Story) => (
			<GlobalComponentContext.Provider value={{ Stage }}>
				<LegalLinksContext.Provider value={storyLegalLinks}>
					<Story />
				</LegalLinksContext.Provider>
			</GlobalComponentContext.Provider>
		)
	]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const BeforeStart = () => (
	<InvitationBeforeStart
		slot={SLOT}
		callOpensAt={CALL_OPENS_AT}
		counsellorName="Anna Berg"
		onAddToCalendar={fn()}
		onOpenChat={fn()}
	/>
);

export const BeforeStartDesktop: Story = {
	name: 'Before start · 1440',
	globals: desktop1440Globals,
	render: () => <BeforeStart />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expect(body().getByTestId('group-entry-calendar')).toBeVisible();
		/* The column's line; the header's status line is the phone's copy. */
		await expect(
			within(body().getByTestId('invitation-before-start')).getByText(
				/13:45 Uhr/
			)
		).toBeVisible();
	}
};

export const BeforeStartPhone: Story = {
	name: 'Before start · 390',
	globals: phone390Globals,
	render: () => <BeforeStart />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
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

const Expired = ({
	signedIn = true,
	fails = false
}: {
	signedIn?: boolean;
	fails?: boolean;
}) => {
	const { t } = useTranslation();
	const [state, setState] = useState<NewLinkRequestState>('idle');
	const stack = useMemo(() => createSnackbarStack(), []);
	return (
		<>
			<InvitationExpired
				requestState={state}
				signedIn={signedIn}
				onSignIn={fn()}
				onRequestNewLink={() => {
					if (!fails) {
						setState('sent');
						return;
					}
					stack.enqueue(
						invitationErrorEntry({
							id: 'direct-invitation-request-failed',
							title: t(
								'directInvitation.entry.expired.failedTitle'
							),
							text: t('directInvitation.entry.expired.failed'),
							t
						})
					);
				}}
			/>
			<M3SnackbarHost stack={stack} />
		</>
	);
};

export const ExpiredDesktop: Story = {
	name: 'Expired · 1440',
	globals: desktop1440Globals,
	render: () => <Expired />,
	play: async () => {
		await userEvent.click(
			body().getByRole('button', { name: /Neuen Link anfragen/ })
		);
		await waitFor(() =>
			expect(body().getByText(/Anfrage gesendet/)).toBeVisible()
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
	render: () => <Expired fails />,
	play: async () => {
		await userEvent.click(
			body().getByRole('button', { name: /Neuen Link anfragen/ })
		);
		await waitFor(() =>
			expect(body().getByText('Anfrage nicht gesendet')).toBeVisible()
		);
	}
};

export const ExpiredSignedOut: Story = {
	name: 'Expired · signed out · 390',
	globals: phone390Globals,
	render: () => <Expired signedIn={false} />
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
