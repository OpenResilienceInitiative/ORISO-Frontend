import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import {
	CaseHandoverAcceptedCard,
	CaseHandoverConsentCard,
	CaseHandoverSystemMessageCard
} from './CaseHandoverClientCards';
import { MessageSendFailed } from '../message/MessageSendFailed';
import {
	MessageStoryShell,
	phone390Globals,
	tablet834Globals
} from '../message/messageStoryShell';
import {
	CASE_HANDOVER_CLIENT_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import '../message/message.styles.scss';
import './caseHandoverClientCards.styles.scss';

/**
 * The acceptance card is a full-bleed surface, so it keeps the dark stage that
 * makes its white card readable. Everything else is a chat message and belongs
 * on the chat surface, at the width the stream actually gives it.
 */
const stage: React.CSSProperties = {
	backgroundColor: '#4a4a4a',
	padding: 32,
	display: 'flex',
	justifyContent: 'center'
};

/** Renders a notice the way the message list does — white surface, real width. */
const Stream = ({
	children,
	compact = false
}: {
	children: React.ReactNode;
	compact?: boolean;
}) => <MessageStoryShell compact={compact}>{children}</MessageStoryShell>;

const meta: Meta = {
	title: 'Organisms/CaseHandover/ClientCards',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'App.Oriso — Chat Room Desktop (8498-32373)',
				url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=8498-32373&m=dev'
			},
			{
				type: 'figma',
				name: 'App.Oriso — Chatbot system-message ring (336-12244)',
				url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=336-12244&m=dev'
			},
			{
				type: 'figma',
				name: 'App.Oriso — Consent message mobile (9596-35524)',
				url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9596-35524&m=dev'
			},
			{
				type: 'figma',
				name: 'App.Oriso — Consent message desktop (9596-36168)',
				url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9596-36168&m=dev'
			},
			{
				type: 'figma',
				name: 'CARX Case Handover — client view (Section 04 / Screen 01)',
				url: CASE_HANDOVER_CLIENT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component: [
					'Client-facing case-handover surfaces.',
					'',
					'The **acceptance card** ("Your inquiry has been accepted by a consultant." + View conversation) is a standalone surface shown outside the stream.',
					'',
					'Every other state is an **ordinary Carimat system message**, not a card: Carimat avatar and kebab on the left, bold title with a quiet qualifier beside it, and the payload inside the standard grey incoming bubble with the time rail at the bottom right. It shares `.messageItem*` markup, spacing and tokens with `MessageItemComponent` and `MessageSendFailed`, so a handover notice reads as one more message in the conversation rather than an alert box dropped into it (ORISO-Frontend#491).'
				].join('\n')
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------------------------------------------------------------- accepted */

export const InquiryAccepted: Story = {
	name: 'Inquiry accepted — desktop',
	render: () => (
		<div style={stage}>
			<CaseHandoverAcceptedCard
				advisorName="Kim G."
				organisationName="Caritas Mainz"
				onViewConversation={() => {}}
			/>
		</div>
	)
};

export const InquiryAcceptedTablet: Story = {
	name: 'Inquiry accepted — tablet 834',
	globals: tablet834Globals,
	render: () => (
		<div style={stage}>
			<CaseHandoverAcceptedCard
				advisorName="Kim G."
				organisationName="Caritas Mainz"
				onViewConversation={() => {}}
			/>
		</div>
	)
};

export const InquiryAcceptedMobile: Story = {
	name: 'Inquiry accepted — phone 390',
	globals: phone390Globals,
	render: () => (
		<div style={{ ...stage, padding: 16 }}>
			<CaseHandoverAcceptedCard
				advisorName="Kim G."
				organisationName="Caritas Mainz"
				onViewConversation={() => {}}
				compact
			/>
		</div>
	)
};

/* ----------------------------------------------------------------- consent */

export const PendingClientConsent: Story = {
	name: 'Pending client consent — desktop',
	globals: { locale: 'en' },
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				timestamp="12:54"
			/>
		</Stream>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatar = canvasElement.querySelector<HTMLElement>(
			'.messageItem__avatar--bot'
		);
		const icon = canvasElement.querySelector<HTMLElement>(
			'.messageItem__botAvatarIcon'
		);
		const glyph = icon?.querySelector<SVGElement>('svg');

		expect(avatar).toBeTruthy();
		expect(icon).toBeTruthy();
		expect(glyph).toBeTruthy();

		const avatarStyle = getComputedStyle(avatar!);
		expect(avatarStyle.width).toBe('60px');
		expect(avatarStyle.height).toBe('60px');
		expect(avatarStyle.borderTopWidth).toBe('6px');
		expect(avatarStyle.borderTopColor).toBe('rgb(255, 255, 255)');
		expect(getComputedStyle(icon!).width).toBe('32px');
		expect(getComputedStyle(icon!).height).toBe('36px');
		expect(getComputedStyle(glyph!).width).toBe('32px');
		expect(getComputedStyle(glyph!).height).toBe('36px');

		const bubble = canvasElement.querySelector<HTMLElement>(
			'.messageItem__message--systemNotification'
		);
		const actions = canvas.getByRole('group', {
			name: 'A counsellor requested access to this conversation'
		});
		const approve = canvas.getByRole('button', { name: 'Approve access' });
		const decline = canvas.getByRole('button', { name: 'Decline access' });

		await waitFor(() => expect(canvas.getByText('Carimat')).toBeVisible());
		expect(canvas.getByText('Quick Guide')).toBeVisible();
		expect(bubble).toContainElement(
			canvas.getByText(
				'A counsellor requested access to this conversation'
			)
		);
		expect(bubble).toContainElement(
			canvas.getByText(
				'Please approve or decline the request to continue the handover.'
			)
		);
		expect(bubble).toContainElement(actions);
		expect(bubble).toContainElement(canvas.getByText('12:54'));
		expect(actions.querySelector('.buttonGroup__badge')).toBeNull();
		expect(
			actions.querySelectorAll(
				':scope > .buttonGroup__track > .buttonGroup__item > .buttonGroup__icon'
			)
		).toHaveLength(2);
		expect(actions).toHaveAttribute('data-alignment', 'horizontal-flex');
		expect(approve).toHaveClass('buttonGroup__item--primary');
		expect(decline).toHaveClass('buttonGroup__item--tonal');
		expect(getComputedStyle(approve).backgroundColor).not.toBe(
			'rgba(0, 0, 0, 0)'
		);
		expect(getComputedStyle(decline).backgroundColor).not.toBe(
			'rgba(0, 0, 0, 0)'
		);
		expect(getComputedStyle(approve).backgroundColor).not.toBe(
			getComputedStyle(decline).backgroundColor
		);
	}
};

export const PendingClientConsentMobile: Story = {
	name: 'Pending client consent — phone 390',
	globals: { ...phone390Globals, locale: 'en' },
	render: () => (
		<Stream compact>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				timestamp="12:54"
			/>
		</Stream>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bubble = canvasElement.querySelector<HTMLElement>(
			'.messageItem__message--systemNotification'
		);
		const actions = canvas.getByRole('group', {
			name: 'A counsellor requested access to this conversation'
		});
		const approve = canvas.getByRole('button', { name: 'Approve access' });
		const decline = canvas.getByRole('button', { name: 'Decline access' });

		expect(bubble).toContainElement(actions);
		await waitFor(() =>
			expect(actions).toHaveAttribute('data-alignment', 'stacked')
		);
		expect(getComputedStyle(approve).backgroundColor).toBe(
			'rgba(0, 0, 0, 0)'
		);
		expect(getComputedStyle(decline).backgroundColor).toBe(
			'rgba(0, 0, 0, 0)'
		);
		expect(getComputedStyle(approve).borderTopColor).toBe(
			'rgb(196, 199, 200)'
		);
		expect(getComputedStyle(decline).borderTopColor).toBe(
			'rgb(196, 199, 200)'
		);
	}
};

export const PendingClientConsentGerman: Story = {
	name: 'Ausstehende Zustimmung — Desktop (Deutsch)',
	globals: { locale: 'de' },
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				timestamp="12:54"
			/>
		</Stream>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bubble = canvasElement.querySelector<HTMLElement>(
			'.messageItem__message--systemNotification'
		);
		const actions = canvas.getByRole('group', {
			name: 'Eine Beratungskraft bittet um Zugriff auf diese Unterhaltung'
		});

		expect(bubble).toContainElement(actions);
		expect(actions).toHaveAttribute('data-alignment', 'horizontal-flex');
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Zugriff freigeben' })
			).toBeVisible()
		);
		expect(
			canvas.getByRole('button', { name: 'Zugriff verweigern' })
		).toBeVisible();
	}
};

export const PendingClientConsentGermanMobile: Story = {
	name: 'Ausstehende Zustimmung — Telefon 390 (Deutsch)',
	globals: { ...phone390Globals, locale: 'de' },
	render: () => (
		<Stream compact>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				timestamp="12:54"
			/>
		</Stream>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const actions = canvas.getByRole('group', {
			name: 'Eine Beratungskraft bittet um Zugriff auf diese Unterhaltung'
		});

		await waitFor(() =>
			expect(actions).toHaveAttribute('data-alignment', 'stacked')
		);
	}
};

export const ActiveClientOptOut: Story = {
	name: 'Active access — client opt-out — desktop',
	globals: { locale: 'en' },
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const control = canvas.getByRole('switch', {
			name: 'I consent to data processing for this case handover'
		});
		const track = control.nextElementSibling as HTMLElement;
		const target = track.firstElementChild as HTMLElement;
		const handle = target.firstElementChild as HTMLElement;

		expect(control).toBeChecked();
		expect(getComputedStyle(track).display).toBe('block');
		expect(getComputedStyle(target).display).toBe('flex');
		expect(getComputedStyle(handle).display).toBe('flex');
		expect(getComputedStyle(handle).width).toBe('24px');
	}
};

export const ActiveClientOptOutMobile: Story = {
	name: 'Active access — client opt-out — phone 390',
	globals: { ...phone390Globals, locale: 'en' },
	render: () => (
		<Stream compact>
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	)
};

export const ActiveClientOptOutGerman: Story = {
	name: 'Aktiver Zugriff — Opt-out — Desktop (Deutsch)',
	globals: { locale: 'de' },
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	)
};

export const ActiveClientOptOutGermanMobile: Story = {
	name: 'Aktiver Zugriff — Opt-out — Telefon 390 (Deutsch)',
	globals: { ...phone390Globals, locale: 'de' },
	render: () => (
		<Stream compact>
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	)
};

export const PendingClientConsentFailed: Story = {
	name: 'Pending client consent — request failed',
	parameters: {
		docs: {
			description: {
				story: 'The decision could not be sent. The error sits under the actions inside the bubble, so the whole notice stays one message.'
			}
		}
	},
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				error="The access request could not be sent."
			/>
		</Stream>
	)
};

export const PendingClientConsentSubmitting: Story = {
	name: 'Pending client consent — submitting',
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				isSubmitting
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	)
};

/* ---------------------------------------------------------------- takeover */

const TookOverNotice = () => {
	const { t } = useTranslation();
	return (
		<CaseHandoverSystemMessageCard
			title={t('caseHandover.systemMessage.tookOverTitle')}
			subtitle={t('caseHandover.systemMessage.noActionNeeded')}
			reasonLabel="Unplanned absence"
			explanation="The previous counsellor is unexpectedly unavailable, so I will continue this consultation."
			timestamp="12:54"
		/>
	);
};

export const NewCounsellorTookOver: Story = {
	name: 'New counsellor took over — desktop',
	parameters: {
		docs: {
			description: {
				story: 'Reason and explanation are the bubble body. Figma App.Oriso 8498-32373 puts a blank body line between them.'
			}
		}
	},
	render: () => (
		<Stream>
			<TookOverNotice />
		</Stream>
	)
};

export const NewCounsellorTookOverTablet: Story = {
	name: 'New counsellor took over — tablet 834',
	globals: tablet834Globals,
	render: () => (
		<Stream>
			<TookOverNotice />
		</Stream>
	)
};

export const NewCounsellorTookOverMobile: Story = {
	name: 'New counsellor took over — phone 390',
	globals: phone390Globals,
	render: () => (
		<Stream compact>
			<TookOverNotice />
		</Stream>
	)
};

/* -------------------------------------------------------------- important */

const ImportantNotice = () => {
	const { t } = useTranslation();
	return (
		<CaseHandoverSystemMessageCard
			title={t('caseHandover.systemMessage.importantTitle')}
			subtitle={t('caseHandover.systemMessage.noActionNeeded')}
			reasonLabel="Unplanned absence"
			explanation="Your case was handed over so you don't have to wait."
			timestamp="09:32"
		/>
	);
};

export const ImportantNotification: Story = {
	name: 'Important notification — desktop',
	render: () => (
		<Stream>
			<ImportantNotice />
		</Stream>
	)
};

export const ImportantNotificationMobile: Story = {
	name: 'Important notification — phone 390',
	globals: phone390Globals,
	render: () => (
		<Stream compact>
			<ImportantNotice />
		</Stream>
	)
};

/* ------------------------------------------------------------ send failure */

export const SendingMessageFailed: Story = {
	name: 'Sending message failed — desktop',
	parameters: {
		docs: {
			description: {
				story: 'The sibling variant from the same Figma frame, rendered here so the two notices can be compared side by side. Both use the same header, bubble and time rail — only the avatar and the delivery glyph differ.'
			}
		}
	},
	render: () => (
		<Stream>
			<MessageSendFailed messageTime="1754990040000" onRetry={() => {}} />
			<TookOverNotice />
		</Stream>
	)
};

export const SendingMessageFailedMobile: Story = {
	name: 'Sending message failed — phone 390',
	globals: phone390Globals,
	render: () => (
		<Stream compact>
			<MessageSendFailed messageTime="1754990040000" onRetry={() => {}} />
			<TookOverNotice />
		</Stream>
	)
};
