import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
	render: () => (
		<Stream>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</Stream>
	)
};

export const PendingClientConsentMobile: Story = {
	name: 'Pending client consent — phone 390',
	globals: phone390Globals,
	render: () => (
		<Stream compact>
			<CaseHandoverConsentCard
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
			reasonLabel="Other emergency"
			explanation="My colleague's kids are ill, so I decided it is better if I take care of this client."
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

/* ------------------------------------------------------------- supervision */

const SupervisionNotice = () => {
	const { t } = useTranslation();
	return (
		<CaseHandoverSystemMessageCard
			title={t('caseHandover.systemMessage.supervisionTitle')}
			subtitle={t('caseHandover.systemMessage.noActionNeeded')}
			timestamp="12:54"
		>
			<p style={{ margin: 0 }}>
				{t('caseHandover.systemMessage.supervisionBody', {
					advisor: 'Shazia Kausar'
				})}
			</p>
		</CaseHandoverSystemMessageCard>
	);
};

export const SupervisionActivated: Story = {
	name: 'Supervision activated — desktop',
	render: () => (
		<Stream>
			<SupervisionNotice />
		</Stream>
	)
};

export const SupervisionActivatedMobile: Story = {
	name: 'Supervision activated — phone 390',
	globals: phone390Globals,
	render: () => (
		<Stream compact>
			<SupervisionNotice />
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
			reasonLabel="Counsellor is ill"
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
