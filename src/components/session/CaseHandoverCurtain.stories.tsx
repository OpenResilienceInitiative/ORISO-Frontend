import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CurtainPlayground } from './__storybook__/CurtainPlayground';
import {
	CASE_HANDOVER_WIZARD_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './caseHandoverCurtain.styles.scss';

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
			initialReasonCode="PLANNED_ABSENCE"
		/>
	)
};

export const ConsentReasonSelected: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="reason"
			initialReasonCode="ADVICE_REQUESTED"
		/>
	)
};

export const DescribeReason: Story = {
	render: () => (
		<CurtainPlayground
			initialStep="describe"
			initialReasonCode="PLANNED_ABSENCE"
			initialExplanation="My colleague is away this week, so I will take care of this client."
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
			initialReasonCode="PLANNED_ABSENCE"
			error="Something went wrong. Please try again."
		/>
	)
};

/** No reasons configured: a message instead of a Next that never enables. */
export const NoReasonsAvailable: Story = {
	render: () => <CurtainPlayground initialStep="reason" noReasons />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('status')).toHaveTextContent(
			/keine Gründe|No case handover reasons/
		);
		await expect(
			canvas.queryByRole('button', { name: /Weiter|Next/ })
		).toBeNull();
	}
};

/** Reasons request failed: its own message and a retry, not "none configured". */
export const ReasonsLoadFailed: Story = {
	render: () => <CurtainPlayground initialStep="reason" reasonsFail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('alert')).toHaveTextContent(
			/nicht geladen|could not be loaded/
		);
		await expect(canvas.queryByRole('status')).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: /Erneut versuchen|Try again/ })
		);
		await expect(canvas.queryByRole('alert')).toBeNull();
		await expect(canvas.getAllByRole('radio').length).toBeGreaterThan(0);
	}
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
			name: /Planned absence|Geplant abwesend/
		});
		await userEvent.click(reason);
		await expect(reason).toHaveAttribute('aria-checked', 'true');
		const next = canvas.getByRole('button', { name: /Next|Weiter/i });
		await userEvent.click(next);
		const textarea = await canvas.findByRole('textbox');
		await userEvent.type(textarea, 'Covering while my colleague is away.');
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
