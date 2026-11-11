import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AgencySpecificContext } from '../../globalState/provider/AgencySpecificProvider';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { Stage } from '../stage/stage';
import { RequestPasswordReset } from './RequestPasswordReset';

const meta = {
	title: 'Organisms/RequestPasswordReset',
	component: RequestPasswordReset,
	decorators: [
		(Story) => (
			<AgencySpecificContext.Provider
				value={{ specificAgency: null, setSpecificAgency: () => {} }}
			>
				<GlobalComponentContext.Provider value={{ Stage }}>
					<Story />
				</GlobalComponentContext.Provider>
			</AgencySpecificContext.Provider>
		)
	],
	parameters: {
		router: { initialPath: '/password-reset' }
	}
} satisfies Meta<typeof RequestPasswordReset>;

export default meta;

export const RequiredEmail: StoryObj<typeof meta> = {
	globals: { locale: 'de' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('textbox', { name: 'E-Mail' });
		const submit = canvas.getByRole('button', { name: 'Absenden' });
		const message = 'Bitte geben Sie zuerst Ihre E-Mail ein.';

		await expect(submit).toBeDisabled();
		await userEvent.type(input, '{Enter}');
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(input).toHaveAccessibleDescription(message);
		await expect(canvas.getByRole('alert')).toHaveTextContent(message);

		await userEvent.type(input, '   {Enter}');
		await expect(submit).toBeDisabled();
		await expect(input).toHaveAccessibleDescription(message);

		await userEvent.clear(input);
		await userEvent.type(input, 'qa@example.invalid');
		await expect(input).toHaveAttribute('aria-invalid', 'false');
		await expect(input).not.toHaveAccessibleDescription();
		await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
		await expect(submit).toBeEnabled();

		await userEvent.clear(input);
		await userEvent.type(input, '{Enter}');
		await expect(input).toHaveAccessibleDescription(message);
	}
};
