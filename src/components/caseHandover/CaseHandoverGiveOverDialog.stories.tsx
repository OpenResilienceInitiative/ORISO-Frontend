import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	CaseHandoverGiveOverDialog,
	CaseHandoverGiveOverView
} from './CaseHandoverGiveOverDialog';
import {
	caseHandoverColleagueName,
	type CaseHandoverOffer,
	type CaseHandoverColleague,
	type CaseHandoverReason
} from '../../api/apiCaseHandover';
import {
	CASE_HANDOVER_WIZARD_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './caseHandoverGiveOver.styles.scss';

const colleagues: CaseHandoverColleague[] = [
	{
		consultantId: 'c-1',
		username: 'bettina.sommer',
		displayName: 'Bettina Sommer',
		firstName: 'Bettina',
		lastName: 'Sommer',
		absent: false
	},
	{
		consultantId: 'c-2',
		username: 'kim.grothe',
		displayName: 'Kim Grothe',
		firstName: 'Kim',
		lastName: 'Grothe',
		absent: false
	},
	{
		consultantId: 'c-3',
		username: 'ali.yildiz',
		displayName: 'Ali Yildiz',
		firstName: 'Ali',
		lastName: 'Yildiz',
		absent: true
	}
];

const reasons: CaseHandoverReason[] = [
	{
		code: 'ADVICE_REQUESTED',
		accessType: 'CO_ACCESS',
		label: 'Advice requested',
		clientConsentRequired: true
	},
	{
		code: 'PLANNED_ABSENCE',
		label: 'Planned absence',
		clientConsentRequired: false
	},
	{
		code: 'UNPLANNED_ABSENCE',
		label: 'Unplanned absence',
		clientConsentRequired: false
	},
	{
		code: 'ASSIGNMENT_ENDED',
		label: 'Assignment ended',
		clientConsentRequired: false
	}
];

type PlaygroundProps = {
	initialColleagueId?: string;
	initialReasonCode?: string;
	colleaguesLoading?: boolean;
	availableColleagues?: CaseHandoverColleague[];
	error?: string;
};

function GiveOverPlayground({
	initialColleagueId = '',
	initialReasonCode = '',
	colleaguesLoading = false,
	availableColleagues = colleagues,
	error
}: PlaygroundProps) {
	const [query, setQuery] = useState('');
	const [colleagueId, setColleagueId] = useState(initialColleagueId);
	const [reasonCode, setReasonCode] = useState(initialReasonCode);
	const [submitted, setSubmitted] = useState('');

	const filtered = availableColleagues.filter((colleague) =>
		caseHandoverColleagueName(colleague)
			.toLowerCase()
			.includes(query.toLowerCase())
	);

	return (
		<>
			<CaseHandoverGiveOverView
				colleagues={filtered}
				colleaguesLoading={colleaguesLoading}
				query={query}
				onQueryChange={setQuery}
				selectedColleagueId={colleagueId}
				onColleagueSelect={setColleagueId}
				reasons={reasons}
				reasonCode={reasonCode}
				onReasonSelect={setReasonCode}
				error={error}
				onSubmit={() => setSubmitted(`${colleagueId}/${reasonCode}`)}
				onClose={() => undefined}
			/>
			{submitted && (
				<p data-testid="give-over-submitted">Offered: {submitted}</p>
			)}
		</>
	);
}

/**
 * Serves the push endpoints so the wired container can be shown as it runs in
 * the app — the same trick `DpaSign.stories` uses, without pulling a mocking
 * framework into the build.
 */
const withStubbedApi = (Story: React.ComponentType) => {
	const realFetch = window.fetch;
	const json = (body: unknown) =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(
			typeof input === 'string' || input instanceof URL
				? input
				: input.url
		);
		if (url.includes('/case-handover/colleagues')) {
			return json({
				colleagues,
				total: colleagues.length,
				offset: 0,
				count: 25
			});
		}
		if (url.includes('/case-handover/reasons')) {
			return json(reasons);
		}
		if (url.includes('/case-handover/offers')) {
			const submitted =
				input instanceof Request
					? await input.clone().json()
					: JSON.parse(String(init?.body || '{}'));
			const reason = reasons.find(
				(entry) => entry.code === submitted.reasonCode
			);
			return json({
				offerId: 1,
				sessionId: 42,
				status: 'PENDING_RECIPIENT_ACCEPT',
				direction: 'PUSH',
				reasonCode: submitted.reasonCode,
				reasonLabel: reason?.label,
				explanation: submitted.explanation,
				accessType: reason?.accessType || 'TAKEOVER',
				clientConsentRequired: reason?.clientConsentRequired,
				fromConsultantId: 'c-0',
				fromConsultantName: 'Anna Weber',
				targetConsultantId: submitted.targetConsultantId,
				targetConsultantName: 'Kim Grothe',
				createdAt: '2026-09-05T09:00:00Z',
				offerExpiresAt: '2026-09-08T09:00:00Z'
			});
		}
		return realFetch(input as RequestInfo, init);
	}) as typeof window.fetch;
	return <Story />;
};

const meta: Meta = {
	title: 'Organisms/CaseHandover/CaseHandoverGiveOverDialog',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'CARX Case Handover — Screens 01–03',
				url: CASE_HANDOVER_WIZARD_FIGMA_URL
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
					'"Fall abgeben" — the push direction of the case handover. The case owner picks a colleague of the case\'s counselling centre and a reason, and the dialog states whether the client will have to consent (from the reason policy, PLAN E3/E5). Accepting is the colleague\'s move; this dialog never grants access and never asks the client, so it adds no third consent gate (ADR-022).'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { render: () => <GiveOverPlayground /> };

export const ColleagueSelected: Story = {
	render: () => <GiveOverPlayground initialColleagueId="c-2" />
};

/** Absence reasons take the case over without asking the client. */
export const ReasonWithoutConsent: Story = {
	render: () => (
		<GiveOverPlayground
			initialColleagueId="c-2"
			initialReasonCode="PLANNED_ABSENCE"
		/>
	)
};

/** "Rat erbeten" needs the client's consent, so the dialog says so. */
export const ReasonRequiringClientConsent: Story = {
	play: async () => {
		const hint = document.querySelector(
			'.caseHandoverGiveOver__hint'
		) as HTMLElement;
		await waitFor(() => {
			const body = document
				.querySelector('.m3Dialog__body')!
				.getBoundingClientRect();
			const rect = hint.getBoundingClientRect();
			expect(rect.top).toBeGreaterThanOrEqual(body.top);
			expect(rect.bottom).toBeLessThanOrEqual(body.bottom);
		});
		expect(document.body.textContent).toContain(
			'Du bleibst für den Fall verantwortlich.'
		);
		const selected = document.querySelector(
			'.caseHandoverGiveOver__option--selected'
		)!;
		const style = getComputedStyle(selected);
		const luminance = (color: string) => {
			const [r, g, b] = color
				.match(/\d+/g)!
				.slice(0, 3)
				.map(Number)
				.map((value) => {
					const channel = value / 255;
					return channel <= 0.04045
						? channel / 12.92
						: ((channel + 0.055) / 1.055) ** 2.4;
				});
			return r * 0.2126 + g * 0.7152 + b * 0.0722;
		};
		const foreground = luminance(style.color);
		const background = luminance(style.backgroundColor);
		expect(
			(Math.max(foreground, background) + 0.05) /
				(Math.min(foreground, background) + 0.05)
		).toBeGreaterThanOrEqual(4.5);
	},
	render: () => (
		<GiveOverPlayground
			initialColleagueId="c-2"
			initialReasonCode="ADVICE_REQUESTED"
		/>
	)
};

export const NoColleaguesFound: Story = {
	render: () => <GiveOverPlayground availableColleagues={[]} />
};

export const LoadingColleagues: Story = {
	render: () => (
		<GiveOverPlayground availableColleagues={[]} colleaguesLoading />
	)
};

export const ErrorState: Story = {
	render: () => (
		<GiveOverPlayground
			initialColleagueId="c-2"
			initialReasonCode="PLANNED_ABSENCE"
			error="Für diesen Fall ist bereits ein Angebot offen."
		/>
	)
};

/** The wired dialog against stubbed endpoints — the stage, not the atoms. */
export const WiredDialog: Story = {
	decorators: [withStubbedApi],
	render: function WiredDialogHarness() {
		const [offer, setOffer] = useState<CaseHandoverOffer | null>(null);
		return (
			<>
				<CaseHandoverGiveOverDialog
					sessionId={42}
					open
					onClose={() => undefined}
					onOfferCreated={setOffer}
				/>
				{offer && (
					<output data-testid="wired-offer-result">
						{offer.reasonCode}/{offer.accessType}/
						{offer.targetConsultantId}
					</output>
				)}
			</>
		);
	},
	play: async ({ canvasElement }) => {
		// The dialog is portalled to the body, so query the document.
		const screen = within(canvasElement.ownerDocument.body);
		const colleague = await screen.findByRole('radio', {
			name: /Kim Grothe/
		});
		await userEvent.click(colleague);
		await expect(colleague).toHaveAttribute('aria-checked', 'true');

		const reason = await screen.findByRole('radio', {
			name: /Rat erbeten/
		});
		await userEvent.click(reason);
		await expect(
			await screen.findByText(
				'Klient:innen-Zustimmung ist erforderlich, bevor der Zugriff aktiviert wird.'
			)
		).toBeVisible();

		const submit = screen.getByTestId('case-handover-give-over-submit');
		await expect(submit).toBeEnabled();
		await expect(submit).toHaveTextContent('Zugriff anbieten');
		await userEvent.click(submit);
		await expect(
			await screen.findByTestId('wired-offer-result')
		).toHaveTextContent('ADVICE_REQUESTED/CO_ACCESS/c-2');
	}
};

/** Full walk on the presentational view: pick, choose, offer. */
export const GiveOverWalkthrough: Story = {
	render: () => <GiveOverPlayground />,
	play: async ({ canvasElement }) => {
		const documentScreen = within(canvasElement.ownerDocument.body);
		const dialog = await documentScreen.findByRole('dialog');
		await waitFor(() => expect(dialog).toBeVisible());
		const screen = within(dialog);
		await userEvent.click(
			await screen.findByRole('radio', { name: /Bettina Sommer/ })
		);
		await userEvent.click(
			await screen.findByRole('radio', { name: /Geplant abwesend/ })
		);
		const consentHint = await screen.findByText(
			/keine Zustimmung der Klient:in nötig/i
		);
		await waitFor(() => expect(consentHint).toBeVisible());
		await userEvent.click(
			screen.getByTestId('case-handover-give-over-submit')
		);
		await expect(
			await documentScreen.findByTestId('give-over-submitted')
		).toHaveTextContent('c-1/PLANNED_ABSENCE');
	}
};
