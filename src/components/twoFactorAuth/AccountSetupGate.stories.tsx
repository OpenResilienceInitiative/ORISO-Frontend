import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { UserDataContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { AccountSetupGate } from './AccountSetupGate';

const withUser =
	(data: Record<string, unknown>) => (Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={
				{
					userData: data,
					reloadUserData: () => Promise.resolve(),
					setUserData: () => undefined
				} as never
			}
		>
			<ModalProvider>
				<Story />
			</ModalProvider>
		</UserDataContext.Provider>
	);

const counsellor = {
	userId: 'storybook-counsellor',
	userName: 'beraterin.sonnenblume',
	email: 'counsellor@example.org',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	chatRecoveryMode: 'RECOVERY_KEY'
};

const meta = {
	title: 'Organisms/AccountSetupGate',
	component: AccountSetupGate,
	tags: ['autodocs'],
	args: { onLogout: fn() },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'What an administrator-provisioned account sees instead of the app: first its own password, then a second factor. Both steps are the same dialog, and neither can be dismissed — logging out is the only other way on.'
			}
		}
	}
} satisfies Meta<typeof AccountSetupGate>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step 1 — comes before the second factor. */
export const OwnPasswordFirst: Story = {
	decorators: [
		withUser({
			...counsellor,
			passwordChangeRequired: true,
			twoFactorAuth: {
				isEnabled: true,
				isRequired: true,
				isActive: false
			}
		})
	],
	play: async ({ args }) => {
		const dialog = within(await within(document.body).findByRole('dialog'));

		await userEvent.keyboard('{Escape}');
		await expect(
			within(document.body).getByRole('dialog')
		).toBeInTheDocument();

		await userEvent.click(
			dialog.getByRole('button', { name: /abmelden|log ?out/i })
		);
		await expect(args.onLogout).toHaveBeenCalled();
	}
};

/** Re-typing the administrator's password is refused before anything is sent. */
export const CurrentPasswordRefused: Story = {
	decorators: OwnPasswordFirst.decorators,
	play: async () => {
		const dialog = await within(document.body).findByRole('dialog');
		const [current, next, confirm] = Array.from(
			dialog.querySelectorAll<HTMLInputElement>('input[type="password"]')
		);

		await userEvent.type(current, 'Storybook!Example1');
		await userEvent.type(next, 'Storybook!Example1');
		await userEvent.type(confirm, 'Storybook!Example1');

		await expect(
			within(dialog).getByText(/bisheriges|current one/i)
		).toBeInTheDocument();
	}
};

/** Step 2 — the same shell, once the password is the counsellor's own. */
export const SecondFactorNext: Story = {
	decorators: [
		withUser({
			...counsellor,
			passwordChangeRequired: false,
			twoFactorAuth: {
				isEnabled: true,
				isRequired: true,
				isActive: false,
				qrCode: '',
				secret: 'STORYBOOKEXAMPLESECRET'
			}
		})
	],
	play: async () => {
		const dialog = within(await within(document.body).findByRole('dialog'));

		await userEvent.click(dialog.getAllByRole('button')[0]);

		// The close button is hidden here; the primary action must still get the row's width.
		const next = await dialog.findByRole('button', {
			name: /weiter|next/i
		});
		await expect(next.getBoundingClientRect().width).toBeGreaterThan(160);
		await expect(
			dialog.getByRole('link', {
				name: /Google Authenticator.*Apple|Google Authenticator.*iOS/i
			})
		).toBeInTheDocument();
	}
};
