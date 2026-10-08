import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { RegistrationStepper } from './RegistrationStepper';

/**
 * The registration stepper at the step counts the flow actually produces.
 *
 * Steps drop out as the entry link answers them: a direct agency link fixes the
 * postcode and the agency, leaving "Choose a topic" and "Register" (2 steps);
 * the full postcode flow shows 4; age and federal state add two more (up to 7
 * with the request step). The connector between two steps used to grow into
 * whatever width the steps left over, so 2 steps rendered as one ~550px bar
 * across the column. These stories pin the three counts side by side.
 */
const meta: Meta<typeof RegistrationStepper> = {
	title: 'Registration/RegistrationStepper',
	component: RegistrationStepper,
	decorators: [
		(Story) => (
			// The registration column's real width on desktop (60vw of 1280px).
			<Box sx={{ width: 768, bgcolor: '#fff' }}>
				<Story />
			</Box>
		)
	]
};

export default meta;

type Story = StoryObj<typeof RegistrationStepper>;

/** Direct agency link: postcode and agency are already known. */
export const TwoStepsFromAgencyLink: Story = {
	args: {
		visibleStepNames: ['topic-selection', 'account-data'],
		currentStepName: 'account-data'
	}
};

/** The full postcode flow — the reference look. */
export const FourStepsPostcodeFlow: Story = {
	args: {
		visibleStepNames: [
			'topic-selection',
			'zipcode',
			'agency-selection',
			'account-data'
		],
		currentStepName: 'agency-selection'
	}
};

/** Every step, including age and federal state: more than the row holds. */
export const SevenSteps: Story = {
	args: {
		visibleStepNames: [
			'topic-selection',
			'zipcode',
			'agency-selection',
			'age',
			'state',
			'account-data',
			'request'
		],
		currentStepName: 'state'
	}
};
