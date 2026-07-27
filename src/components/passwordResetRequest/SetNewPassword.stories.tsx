import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SetNewPassword } from './SetNewPassword';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { AgencySpecificContext } from '../../globalState/provider/AgencySpecificProvider';
import { Stage } from '../stage/stage';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const withStage = (Story: React.ComponentType) => (
	<AgencySpecificContext.Provider
		value={{ specificAgency: null, setSpecificAgency: () => {} }}
	>
		<GlobalComponentContext.Provider value={{ Stage }}>
			<Story />
		</GlobalComponentContext.Provider>
	</AgencySpecificContext.Provider>
);

const meta = {
	title: 'Organisms/SetNewPassword',
	component: SetNewPassword,
	tags: ['autodocs'],
	decorators: [withStage],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'New screen reached from the emailed reset link ' +
					'(/password-reset/confirm?token=...). Not part of the ' +
					'original screenshots, added to complete the in-app flow ' +
					'now that we own the reset end-to-end instead of handing ' +
					"off to Keycloak's hosted pages."
			}
		}
	}
} satisfies Meta<typeof SetNewPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Reached with a valid token in the URL: enter + confirm the new password. */
export const WithToken: Story = {
	parameters: {
		router: {
			initialPath: '/password-reset/confirm?token=storybook-demo-token'
		}
	}
};

/** Reached with no/expired token: prompts to request a new link. */
export const InvalidOrMissingToken: Story = {
	parameters: {
		router: {
			initialPath: '/password-reset/confirm'
		}
	}
};
