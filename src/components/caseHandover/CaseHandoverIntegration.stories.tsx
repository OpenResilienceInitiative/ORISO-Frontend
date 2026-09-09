import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { CaseHandoverConsentCard } from './CaseHandoverClientCards';
import { CaseHandoverOffersInboxView } from './CaseHandoverOffers';
import { EmptyListItem } from '../sessionsList/EmptyListItem';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import '../message/message.styles.scss';
import '../sessionsList/sessionsList.styles.scss';
import '../session/session.styles.scss';

// Exact production composition, isolated from authenticated providers and Matrix.
// SessionStream supplies notices; SessionItem owns the .session__content scroll area.
const meta: Meta = {
	title: 'Organisms/CaseHandover/Integration',
	parameters: { layout: 'fullscreen' }
};
export default meta;
type Story = StoryObj<typeof meta>;
export const ConsentInStream: Story = {
	render: () => (
		<div style={{ display: 'flex', height: '100vh' }}>
			<div className="session__wrapper">
				<div className="session">
					<div style={{ padding: 20 }}>
						Marge · Session 37 · component integration
					</div>
					<div className="session__content">
						<CaseHandoverConsentCard
							onApprove={() => {}}
							onDecline={() => {}}
						/>
						<p>Bestehende Unterhaltung</p>
					</div>
				</div>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const card = canvasElement.querySelector(
				'[data-testid="case-handover-inline-consent"]'
			)!;
			const title = card.querySelector(
				'.caseHandoverMessage__introTitle'
			)!;
			expect(title.getBoundingClientRect().width).toBeGreaterThan(200);
			expect(card.getBoundingClientRect().width).toBeGreaterThan(300);
		});
	}
};
export const OfferAboveEmptyList: Story = {
	render: () => (
		<div
			className="sessionsList__innerWrapper"
			style={{ height: '100vh', maxWidth: 420, position: 'relative' }}
		>
			<CaseHandoverOffersInboxView
				expanded
				onToggle={() => {}}
				onAccept={() => {}}
				onDecline={() => {}}
				offers={[
					{
						offerId: 7,
						sessionId: 37,
						status: 'PENDING_RECIPIENT_ACCEPT',
						direction: 'PUSH',
						accessType: 'CO_ACCESS',
						fromConsultantName: 'Lisa Simpson',
						reasonCode: 'ADVICE_REQUESTED'
					}
				]}
			/>
			<div className="sessionsList__scrollArea">
				<div className="sessionsList__scrollContainer" />
				<EmptyListItem
					type={SESSION_LIST_TYPES.MY_SESSION}
					sessionListTab=""
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const offer = canvasElement
				.querySelector('[data-testid="case-handover-offer-7"]')!
				.getBoundingClientRect();
			const empty = canvasElement
				.querySelector('.sessionsList__emptyState')!
				.getBoundingClientRect();
			expect(empty.top).toBeGreaterThanOrEqual(offer.bottom);
		});
	}
};
