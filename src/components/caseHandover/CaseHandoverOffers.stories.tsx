import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	CaseHandoverOfferBadge,
	CaseHandoverOffersInbox,
	CaseHandoverOffersInboxView,
	CaseHandoverOutgoingOfferView
} from './CaseHandoverOffers';
import type { CaseHandoverOffer } from '../../api/apiCaseHandover';
import {
	CASE_HANDOVER_BULK_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './caseHandoverOffers.styles.scss';

const offers: CaseHandoverOffer[] = [
	{
		offerId: 1,
		sessionId: 42,
		status: 'PENDING_RECIPIENT_ACCEPT',
		direction: 'PUSH',
		reasonCode: 'PLANNED_ABSENCE',
		reasonLabel: 'Planned absence',
		explanation: 'Urlaubsvertretung ab Montag',
		clientConsentRequired: false,
		fromConsultantId: 'c-1',
		fromConsultantName: 'Bettina Sommer',
		targetConsultantId: 'c-9',
		targetConsultantName: 'Kim Grothe',
		createdAt: '2026-09-05T10:00:00Z',
		offerExpiresAt: '2026-09-08T10:00:00Z'
	},
	{
		offerId: 2,
		sessionId: 43,
		status: 'PENDING_RECIPIENT_ACCEPT',
		direction: 'PUSH',
		reasonCode: 'ADVICE_REQUESTED',
		reasonLabel: 'Advice requested',
		explanation: 'Zweitmeinung erbeten',
		clientConsentRequired: true,
		fromConsultantId: 'c-3',
		fromConsultantName: 'Ali Yildiz',
		targetConsultantId: 'c-9',
		targetConsultantName: 'Kim Grothe',
		createdAt: '2026-09-04T18:30:00Z',
		offerExpiresAt: '2026-09-07T18:30:00Z'
	}
];

const consentPendingOffer: CaseHandoverOffer = {
	...offers[1],
	offerId: 3,
	status: 'PENDING_CLIENT_CONSENT'
};

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: 16,
	maxWidth: 420,
	boxSizing: 'border-box'
};

/** Fixed formatter so the snapshot does not depend on the runner's locale. */
const formatDate = (isoDate: string) => isoDate.slice(0, 10);

function InboxPlayground({
	initialOffers = offers,
	expandedByDefault = true,
	error,
	notice
}: {
	initialOffers?: CaseHandoverOffer[];
	expandedByDefault?: boolean;
	error?: string;
	notice?: string;
}) {
	const [items, setItems] = useState(initialOffers);
	const [expanded, setExpanded] = useState(expandedByDefault);
	const [log, setLog] = useState('');

	const resolve = (offerId: number, verdict: string) => {
		setItems((current) =>
			current.filter((offer) => offer.offerId !== offerId)
		);
		setLog(`${verdict}:${offerId}`);
	};

	return (
		<div style={shell}>
			<CaseHandoverOffersInboxView
				offers={items}
				expanded={expanded}
				onToggle={() => setExpanded((value) => !value)}
				error={error}
				notice={notice}
				onAccept={(offerId) => resolve(offerId, 'accepted')}
				onDecline={(offerId) => resolve(offerId, 'declined')}
				formatDate={formatDate}
			/>
			{log && <p data-testid="offer-log">{log}</p>}
		</div>
	);
}

const withStubbedApi = (Story: React.ComponentType) => {
	const realFetch = window.fetch;
	const json = (body: unknown) =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	let accepted = false;
	window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(
			typeof input === 'string' || input instanceof URL
				? input
				: input.url
		);
		// Accepting answers with the case status, not with the offer — the
		// reason of offer 2 needs the client's consent, so the case has not
		// moved yet and the inbox has to say exactly that.
		if (url.includes('/accept')) {
			accepted = true;
			return json({
				requestId: 2,
				sessionId: 43,
				status: 'PENDING_CLIENT_CONSENT',
				canViewContent: false,
				reasonCode: 'ADVICE_REQUESTED',
				reasonLabel: 'Advice requested',
				clientConsentRequired: true
			});
		}
		if (url.includes('/case-handover/offers')) {
			return json(
				accepted
					? [{ ...offers[1], status: 'PENDING_CLIENT_CONSENT' }]
					: offers
			);
		}
		return realFetch(input as RequestInfo, init);
	}) as typeof window.fetch;
	return <Story />;
};

const meta: Meta = {
	title: 'Organisms/CaseHandover/CaseHandoverOffers',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'CARX Case Handover — bulk / list states',
				url: CASE_HANDOVER_BULK_FIGMA_URL
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
					'The receiving end of "Fall abgeben": B sees the open offers above her session list with a count badge and accepts or declines each one. An offer whose reason needs the client\'s consent shows that instead of Accept/Decline — accepting has already happened, the client has not answered yet. A sees her own open offer on the case and can withdraw it.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoOpenOffers: Story = { render: () => <InboxPlayground /> };

export const Collapsed: Story = {
	render: () => <InboxPlayground expandedByDefault={false} />
};

export const AwaitingClientConsent: Story = {
	render: () => <InboxPlayground initialOffers={[consentPendingOffer]} />
};

/** Accepting an "Rat erbeten" offer does not move the case — it asks the client. */
export const AcceptedAwaitingClientConsent: Story = {
	render: () => (
		<InboxPlayground
			initialOffers={[consentPendingOffer]}
			notice="Angenommen — die Klient:in wurde um Zustimmung gebeten."
		/>
	)
};

/** Accepting a reason without a consent gate hands the case over right away. */
export const AcceptedAndGranted: Story = {
	render: () => (
		<InboxPlayground
			initialOffers={[]}
			notice="Du hast den Fall übernommen."
		/>
	)
};

export const ActionFailed: Story = {
	render: () => (
		<InboxPlayground error="Die Aktion konnte nicht ausgeführt werden." />
	)
};

/** No offers means no panel at all — the session list stays untouched. */
export const NoOffers: Story = {
	render: () => <InboxPlayground initialOffers={[]} />
};

export const Badge: Story = {
	render: () => (
		<div style={shell}>
			<CaseHandoverOfferBadge count={3} />
		</div>
	)
};

export const OutgoingOfferOpen: Story = {
	render: () => (
		<div style={shell}>
			<CaseHandoverOutgoingOfferView
				offer={{
					offerId: 9,
					sessionId: 42,
					status: 'PENDING_RECIPIENT_ACCEPT',
					direction: 'PUSH',
					reasonCode: 'PLANNED_ABSENCE',
					reasonLabel: 'Planned absence',
					targetConsultantId: 'c-2',
					targetConsultantName: 'Kim Grothe',
					offerExpiresAt: '2026-09-08T10:00:00Z'
				}}
				onWithdraw={() => undefined}
			/>
		</div>
	)
};

/** The wired inbox against stubbed endpoints — the stage, not the atoms. */
export const WiredInbox: Story = {
	decorators: [withStubbedApi],
	render: () => (
		<div style={shell}>
			<CaseHandoverOffersInbox pollIntervalMs={0} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByTestId('case-handover-offer-badge')
		).toHaveTextContent('2');
		await expect(
			await canvas.findByText(/Von Bettina Sommer/)
		).toBeVisible();

		// Accepting the consent-gated offer must report the client consent,
		// never "the case is yours".
		await userEvent.click(
			await canvas.findByTestId('case-handover-offer-accept-2')
		);
		await expect(
			await canvas.findByTestId('case-handover-offers-notice')
		).toHaveTextContent(/Zustimmung/i);
	}
};

/** Accepting removes the offer from the inbox. */
export const AcceptOffer: Story = {
	render: () => <InboxPlayground />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const accept = await canvas.findByTestId(
			'case-handover-offer-accept-1'
		);
		await userEvent.click(accept);
		await expect(await canvas.findByTestId('offer-log')).toHaveTextContent(
			'accepted:1'
		);
		await expect(canvas.queryByTestId('case-handover-offer-1')).toBeNull();
	}
};
