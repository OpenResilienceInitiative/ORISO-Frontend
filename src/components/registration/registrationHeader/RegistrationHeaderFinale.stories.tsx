import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, waitFor } from 'storybook/test';
import { RegistrationHeader } from './RegistrationHeader';

/**
 * ORISO-Frontend#1736. The registration header when the account is being
 * created: every step done and none active, then the band folds away while the
 * handover slides in below it. Same element before and after — only its state
 * changes — which is what lets the stepper travel instead of being swapped.
 */
const meta: Meta = {
	id: 'registration-header-finale',
	title: 'Entry flows/Postcode counselling/Header while the account is created'
};

export default meta;

const STEP_NAMES = [
	'topic-selection',
	'zipcode',
	'agency-selection',
	'account-data'
];

const FinaleHeader = ({ collapsed }: { collapsed: boolean }) => (
	<Box sx={{ width: 1040 }}>
		<Box sx={{ border: '1px solid rgba(0,0,0,.14)', bgcolor: '#fff' }}>
			<RegistrationHeader
				fullBleed={false}
				layout="stepper"
				currentStepName="account-data"
				visibleStepNames={STEP_NAMES}
				completed
				collapsed={collapsed}
			/>
			<Box sx={{ p: 3 }}>
				<Typography sx={{ fontSize: 22, fontWeight: 700 }}>
					Fast geschafft.
				</Typography>
			</Box>
		</Box>
	</Box>
);

export const AllStepsDone: StoryObj = {
	name: 'Header (desktop) — all steps done',
	render: () => <FinaleHeader collapsed={false} />,
	play: async ({ canvasElement }) => {
		const header = canvasElement.querySelector(
			'[data-cy="registration-header"]'
		)!;
		expect(header.querySelector('[aria-current="step"]')).toBeNull();
		expect(
			header.querySelectorAll(
				'[data-cy="step-connector"][data-done="true"]'
			).length
		).toBe(STEP_NAMES.length - 1);
	}
};

export const Folded: StoryObj = {
	name: 'Header (desktop) — folded away',
	render: () => <FinaleHeader collapsed />,
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const fold = canvasElement.querySelector(
				'[data-cy="registration-header"] .MuiCollapse-root'
			);
			expect(fold?.classList.contains('MuiCollapse-hidden')).toBe(true);
		});
	}
};
