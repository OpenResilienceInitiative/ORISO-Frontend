import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	CaseHandoverCurtainStep,
	CaseHandoverCurtainView
} from './CaseHandoverCurtain';
import type { CaseHandoverReason } from '../../api/apiCaseHandover';
import {
	CASE_HANDOVER_WIZARD_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './caseHandoverCurtain.styles.scss';

const reasons: CaseHandoverReason[] = [
	{
		code: 'COUNSELLOR_ASKED_FOR_ADVICE',
		label: 'Counsellor asked for advice',
		clientConsentRequired: true
	},
	{
		code: 'COUNSELLOR_ON_HOLIDAY',
		label: 'Counsellor is on holiday',
		clientConsentRequired: false
	},
	{
		code: 'OTHER_EMERGENCY',
		label: 'Other emergency',
		clientConsentRequired: false
	},
	{
		code: 'COUNSELLOR_IS_ILL',
		label: 'Counsellor is ill',
		clientConsentRequired: false
	},
	{
		code: 'COUNSELLOR_LEFT',
		label: "Counsellor doesn't work here anymore",
		clientConsentRequired: false
	}
];

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: 16,
	height: '100vh',
	boxSizing: 'border-box'
};

type PlaygroundProps = {
	initialStep?: CaseHandoverCurtainStep;
	initialReasonCode?: string;
	initialExplanation?: string;
	error?: string;
	topicLabel?: string;
};

function CurtainPlayground({
	initialStep = 'intro',
	initialReasonCode = '',
	initialExplanation = '',
	error,
	topicLabel = 'Schwangerschaftsberatung'
}: PlaygroundProps) {
	const [step, setStep] = useState<CaseHandoverCurtainStep>(initialStep);
	const [reasonCode, setReasonCode] = useState(initialReasonCode);
	const [explanation, setExplanation] = useState(initialExplanation);

	return (
		<div style={shell}>
			<CaseHandoverCurtainView
				step={step}
				topicLabel={topicLabel}
				reasons={reasons}
				reasonCode={reasonCode}
				explanation={explanation}
				error={error}
				onStart={() => setStep('reason')}
				onBack={() => setStep('reason')}
				onNext={() => setStep('describe')}
				onReasonSelect={setReasonCode}
				onExplanationChange={setExplanation}
				onSubmit={() => setStep('pending')}
			/>
		</div>
	);
}

const meta: Meta = {
	title: 'Organisms/CaseHandover/CaseHandoverCurtain',
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
					'Access-control curtain in the conversation pane ("Information hidden until request is approved"). Wizard: intro → **Please select a reason** (radio list with keyboard shortcuts; digits 1–n select) → **Please describe the reason** (free text) → request. Consent-requiring reasons show the client-consent hint. Pending / consent-pending / denied are terminal curtain states. Replaces the legacy CaseHandoverGate.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Intro: Story = { render: () => <CurtainPlayground /> };

export const SelectReason: Story = {
	render: () => <CurtainPlayground initialStep="reason" />
};

export const SelectReasonWithSelection: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="reason"
			initialReasonCode="OTHER_EMERGENCY"
		/>
	)
};

export const ConsentReasonSelected: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="reason"
			initialReasonCode="COUNSELLOR_ASKED_FOR_ADVICE"
		/>
	)
};

export const DescribeReason: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="describe"
			initialReasonCode="OTHER_EMERGENCY"
			initialExplanation="My colleague's kids are ill, so I decided it is better if I take care of this client."
		/>
	)
};

export const AwaitingApproval: Story = {
	render: () => <CurtainPlayground initialStep="pending" />
};

export const AwaitingClientConsent: Story = {
	render: () => <CurtainPlayground initialStep="consentPending" />
};

export const Denied: Story = {
	render: () => <CurtainPlayground initialStep="denied" />
};

export const ErrorState: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="describe"
			initialReasonCode="OTHER_EMERGENCY"
			error="Something went wrong. Please try again."
		/>
	)
};

/** Full wizard walk: intro → reason (radio) → describe → submit → pending. */
export const WizardWalkthrough: Story = {
	render: () => <CurtainPlayground />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: /step by step|Schritt für Schritt/i
			})
		);
		const reason = await canvas.findByRole('radio', {
			name: /Other emergency/
		});
		await userEvent.click(reason);
		await expect(reason).toHaveAttribute('aria-checked', 'true');
		const next = canvas.getByRole('button', { name: /Next|Weiter/i });
		await userEvent.click(next);
		const textarea = await canvas.findByRole('textbox');
		await userEvent.type(textarea, 'Covering for a sick colleague.');
		await userEvent.click(
			canvas.getByRole('button', {
				name: /Request access|Zugriff anfragen/i
			})
		);
		await expect(
			await canvas.findByText(/awaiting approval|warten auf freigabe/i)
		).toBeVisible();
	}
};
