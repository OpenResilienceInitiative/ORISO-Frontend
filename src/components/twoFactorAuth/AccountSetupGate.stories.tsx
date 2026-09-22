import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { UserDataContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { AccountSetupGate } from './AccountSetupGate';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';

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

const owesPassword = withUser({
	...counsellor,
	passwordChangeRequired: true,
	twoFactorAuth: { isEnabled: true, isRequired: true, isActive: false }
});

const owesSecondFactor = withUser({
	...counsellor,
	passwordChangeRequired: false,
	twoFactorAuth: {
		isEnabled: true,
		isRequired: true,
		isActive: false,
		qrCode: '',
		secret: 'STORYBOOKEXAMPLESECRET'
	}
});

const dialog = () => within(document.body).findByRole('dialog');

const passwordFields = (host: HTMLElement) =>
	Array.from(
		host.querySelectorAll<HTMLInputElement>('input[type="password"]')
	);

const saveButton = (host: HTMLElement) =>
	within(host).getByRole('button', {
		name: /speichern und weiter|save password and continue/i
	});

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

/** Step 1, untouched: both steps are named, and nothing can be saved yet. */
export const PasswordEmpty: Story = {
	decorators: [owesPassword],
	play: async ({ args }) => {
		const host = await dialog();
		const progress = within(host).getByRole('group');

		await expect(within(progress).getAllByText(/./)).not.toHaveLength(0);
		await expect(saveButton(host)).toBeDisabled();

		await userEvent.keyboard('{Escape}');
		await expect(
			within(document.body).getByRole('dialog')
		).toBeInTheDocument();

		await userEvent.click(
			within(host).getByRole('button', { name: /abmelden|log ?out/i })
		);
		await expect(args.onLogout).toHaveBeenCalled();
	}
};

/** Re-typing the administrator's password is refused before anything is sent. */
export const PasswordRefused: Story = {
	decorators: [owesPassword],
	play: async () => {
		const host = await dialog();
		const [current, next, confirm] = passwordFields(host);

		await userEvent.type(current, 'Storybook!Example1');
		await userEvent.type(next, 'Storybook!Example1');
		await userEvent.type(confirm, 'Storybook!Example1');

		// The refusal, not the field label that carries the same word.
		await expect(
			host.querySelector('.setupField__message--error').textContent
		).toMatch(/bisheriges|current one/i);
		await expect(saveButton(host)).toBeDisabled();
	}
};

/** A password of the counsellor's own: every criterion ticked, saving enabled. */
export const PasswordReady: Story = {
	decorators: [owesPassword],
	play: async () => {
		const host = await dialog();
		const [current, next, confirm] = passwordFields(host);

		await userEvent.type(current, 'Storybook!Example1');
		await userEvent.type(next, 'Sonnenblume!9x');
		await userEvent.type(confirm, 'Sonnenblume!9x');

		const criteria = host.querySelectorAll(
			'.passwordReset__criterion--met'
		);
		await expect(criteria).toHaveLength(4);
		await expect(saveButton(host)).toBeEnabled();
	}
};

/** Step 2, first screen: app or e-mail. */
export const SecondFactorDecision: Story = {
	decorators: [owesSecondFactor],
	play: async () => {
		const host = await dialog();

		await expect(
			within(host).getByRole('button', { name: /app/i })
		).toBeInTheDocument();
		await expect(
			within(host).getByRole('button', { name: /e-?mail/i })
		).toBeInTheDocument();
	}
};

const chooseApp = async () => {
	const host = await dialog();
	await userEvent.click(
		within(host).getAllByRole('button', { name: /app/i })[0]
	);
	return host;
};

/** The two apps, each free and usable without an account. */
export const SecondFactorInstall: Story = {
	decorators: [owesSecondFactor],
	play: async () => {
		const host = await chooseApp();

		await expect(
			await within(host).findByText('Google Authenticator')
		).toBeInTheDocument();
		await expect(
			within(host).getByText('Microsoft Authenticator')
		).toBeInTheDocument();
		await expect(within(host).getAllByText('App Store')).toHaveLength(2);

		// The close button is hidden here; the primary action must still get
		// the row's width beside the 64px back button.
		const next = within(host).getByRole('button', {
			name: /installiert|installed/i
		});
		await expect(next.getBoundingClientRect().width).toBeGreaterThan(160);
	}
};

const reachConnect = async () => {
	const host = await chooseApp();
	await userEvent.click(
		await within(host).findByRole('button', {
			name: /installiert|installed/i
		})
	);
	return host;
};

/** The manual key, because this story has no QR code to scan. */
export const SecondFactorConnect: Story = {
	decorators: [owesSecondFactor],
	play: async () => {
		const host = await reachConnect();

		// No QR code in this story, so the manual key has to carry the step.
		await expect(
			await within(host).findByText(/manueller schlüssel|manual key/i)
		).toBeInTheDocument();
		await expect(
			host.querySelector('.twoFactorSetupDialog__secret').textContent
		).toMatch(/^[A-Z2-7]{8,}$/);
	}
};

const reachVerify = async () => {
	const host = await reachConnect();
	await userEvent.click(
		await within(host).findByRole('button', { name: /weiter|next/i })
	);
	return host;
};

/** The six-digit code from the app. */
export const SecondFactorVerify: Story = {
	decorators: [owesSecondFactor],
	play: async () => {
		const host = await reachVerify();
		const code = await within(host).findByLabelText(
			/einmal-code|one-?time/i
		);

		await expect(
			within(host).getByRole('button', {
				name: /bestätigen|confirm/i
			})
		).toBeDisabled();
		await userEvent.type(code, '123456');
		await expect(
			within(host).getByRole('button', {
				name: /bestätigen|confirm/i
			})
		).toBeEnabled();
	}
};

/**
 * The dialog on its own: the gate reloads the document once setup is done,
 * which would take the story's own frame with it.
 */
export const SecondFactorSuccess: Story = {
	decorators: [owesSecondFactor],
	render: () => (
		<TwoFactorSetupDialog
			canClose={false}
			canDisable={false}
			email="counsellor@example.org"
			onClose={fn()}
			onDisable={fn()}
			onSetupComplete={fn()}
			open
			secret="STORYBOOKEXAMPLESECRET"
			showAccountProgress
		/>
	),
	play: async () => {
		const host = await reachVerify();

		await userEvent.type(
			await within(host).findByLabelText(/einmal-code|one-?time/i),
			'123456'
		);
		await userEvent.click(
			within(host).getByRole('button', { name: /bestätigen|confirm/i })
		);

		await expect(
			await within(host).findByRole('heading', {
				name: /eingerichtet|set up/i
			})
		).toBeInTheDocument();
	}
};

/** The e-mail branch: the code lands in the inbox, and can be resent. */
export const SecondFactorEmailCode: Story = {
	decorators: [owesSecondFactor],
	play: async () => {
		const host = await dialog();

		await userEvent.click(
			within(host).getByRole('button', { name: /e-?mail/i })
		);
		await userEvent.click(
			await within(host).findByRole('button', { name: /weiter|next/i })
		);

		await expect(
			await within(host).findByRole('button', {
				name: /neuen code|new code/i
			})
		).toBeInTheDocument();
	}
};
