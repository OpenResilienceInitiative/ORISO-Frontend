import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import {
	CaseHandoverAcceptedCard,
	CaseHandoverSystemMessageCard
} from './CaseHandoverClientCards';
import {
	CASE_HANDOVER_CLIENT_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './caseHandoverClientCards.styles.scss';

const shell: React.CSSProperties = {
	backgroundColor: '#4a4a4a',
	padding: 32,
	display: 'flex',
	justifyContent: 'center'
};

const meta: Meta = {
	title: 'Organisms/CaseHandover/ClientCards',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
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
				component:
					'Client-facing case-handover surfaces: the **acceptance card** ("Your inquiry has been accepted by a consultant." + View conversation, Screen 01) and the **in-chat system notification card** (takeover with reason/explanation, important notification, supervision activated — Sections 03/04). Copy source: vault doc "Case Handover — System-Benachrichtigungen & Rechtstexte (Entwurf)".'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InquiryAccepted: Story = {
	render: () => (
		<div style={shell}>
			<CaseHandoverAcceptedCard
				advisorName="Kim G."
				organisationName="Caritas Mainz"
				onViewConversation={() => {}}
			/>
		</div>
	)
};

export const InquiryAcceptedMobile: Story = {
	render: () => (
		<div style={{ ...shell, maxWidth: 420, margin: '0 auto' }}>
			<CaseHandoverAcceptedCard
				advisorName="Kim G."
				organisationName="Caritas Mainz"
				onViewConversation={() => {}}
				compact
			/>
		</div>
	)
};

function TookOverCard() {
	const { t } = useTranslation();
	return (
		<CaseHandoverSystemMessageCard
			title={t('caseHandover.systemMessage.tookOverTitle')}
			subtitle={t('caseHandover.systemMessage.noActionNeeded')}
			reasonLabel="Other emergency"
			explanation="My colleague's kids are ill, so I decided it is better if I take care of this client."
			timestamp="14:22"
		/>
	);
}

export const NewCounsellorTookOver: Story = {
	render: () => (
		<div style={{ ...shell, backgroundColor: '#f7f2f1' }}>
			<TookOverCard />
		</div>
	)
};

function SupervisionCard() {
	const { t } = useTranslation();
	return (
		<CaseHandoverSystemMessageCard
			title={t('caseHandover.systemMessage.supervisionTitle')}
		>
			<p style={{ margin: 0 }}>
				{t('caseHandover.systemMessage.supervisionBody', {
					advisor: 'Shazia Kausar'
				})}
			</p>
		</CaseHandoverSystemMessageCard>
	);
}

export const SupervisionActivated: Story = {
	render: () => (
		<div style={{ ...shell, backgroundColor: '#f7f2f1' }}>
			<SupervisionCard />
		</div>
	)
};

function ImportantNotificationCard() {
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
}

export const ImportantNotification: Story = {
	render: () => (
		<div style={{ ...shell, backgroundColor: '#f7f2f1' }}>
			<ImportantNotificationCard />
		</div>
	)
};
