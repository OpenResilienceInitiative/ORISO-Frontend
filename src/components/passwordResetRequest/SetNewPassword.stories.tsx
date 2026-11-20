import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Route, Routes } from 'react-router-dom';
import { RequestPasswordReset } from './RequestPasswordReset';
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
			<Routes>
				<Route path="/password-reset/confirm" element={<Story />} />
				<Route
					path="/password-reset"
					element={<RequestPasswordReset />}
				/>
			</Routes>
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
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const recovery = canvas.getByRole('link', {
			name: /^(Neuen Link anfordern|Request a new link)$/i
		});
		await expect(recovery).toHaveAttribute('href', '/password-reset');
	}
};

const confirmRequest = fn();
const resetRequest = fn();

export const RejectedLink: Story = {
	parameters: {
		router: {
			initialPath:
				'/password-reset/confirm?token=storybook-rejected-token'
		}
	},
	beforeEach: () => {
		confirmRequest.mockClear();
		resetRequest.mockClear();
		const previousFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url = input instanceof Request ? input.url : String(input);
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (
				method === 'POST' &&
				url.endsWith('/service/users/password-reset/confirm')
			) {
				confirmRequest();
				return new Response(null, { status: 400 });
			}
			if (
				method === 'POST' &&
				url.endsWith('/service/users/password-reset/request')
			) {
				resetRequest();
				return new Response(null, { status: 204 });
			}
			return previousFetch(input, init);
		};
		return () => {
			globalThis.fetch = previousFetch;
		};
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const password = 'StorybookPassword1!';
		const first = canvas.getByLabelText(/^(Neues Passwort|New password)$/i);
		const second = canvas.getByLabelText(
			/^(Neues Passwort bestätigen|Confirm new password)$/i
		);
		await userEvent.type(first, password);
		await userEvent.type(second, password);
		await userEvent.click(
			canvas.getByRole('button', {
				name: /^(Passwort speichern|Save password)$/i
			})
		);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			/Dieser Link ist ungültig oder abgelaufen|This link is invalid or has expired/i
		);
		await expect(confirmRequest).toHaveBeenCalledTimes(1);
		await expect(first).toHaveValue(password);
		await expect(second).toHaveValue(password);
		const recovery = canvas.getByRole('link', {
			name: /^(Neuen Link anfordern|Request a new link)$/i
		});
		await userEvent.tab();
		await expect(recovery).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await expect(
			await canvas.findByRole('textbox', { name: /E-Mail|Email/i })
		).toHaveValue('');
		await expect(resetRequest).not.toHaveBeenCalled();
	}
};
