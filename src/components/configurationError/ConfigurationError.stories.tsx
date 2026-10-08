import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { ConfigurationError } from './ConfigurationError';

// Shown instead of the app when a required runtime URL is missing
// (ORISO-Helm#368). Before this, the app guessed the host from the page URL.
const meta = {
	title: 'Components/App/ConfigurationError',
	component: ConfigurationError,
	parameters: {
		layout: 'fullscreen'
	}
} satisfies Meta<typeof ConfigurationError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MissingApiAndMatrix: Story = {
	name: 'Missing API and Matrix URL',
	args: {
		problems: [
			{ key: 'REACT_APP_API_URL', problem: 'missing' },
			{ key: 'REACT_APP_MATRIX_HOMESERVER_URL', problem: 'missing' }
		]
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('REACT_APP_API_URL')).toBeVisible();
		await expect(
			canvas.getByText('REACT_APP_MATRIX_HOMESERVER_URL')
		).toBeVisible();
	}
};

export const InvalidLiveKitUrl: Story = {
	name: 'Invalid LiveKit URL',
	args: {
		problems: [{ key: 'REACT_APP_LIVEKIT_WS_URL', problem: 'invalid' }]
	}
};
