import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import i18n from '../../i18n';
import { AccountData } from './accountData/AccountData';
import { clearAccountDataDraft } from './accountData/accountDataDraft';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import {
	accountPolicyTenant,
	accountPolicyUser
} from '../../test/fixtures/askerAccountPolicyFixtures';
import { AskerAboutMeData } from '../profile/AskerAboutMeData';
import { TWO_FACTOR_TYPES } from '../twoFactorAuth/twoFactorAuthConstants';
import { EmailNotification } from '../profile/EmailNotifications';
import { TwoFactorSetupDialog } from '../twoFactorAuth/TwoFactorSetupDialog';

type FixtureProps = {
	surface: 'registration' | 'selfHelp' | 'profile' | 'otp' | 'removal';
	editable: boolean;
	collectionAllowed: boolean;
	accountEligible: boolean;
	storedEmail: string;
};
/** Local fixtures around actual product components; no backend acceptance claim. */
const AccountPolicyFixture = ({
	surface,
	editable,
	collectionAllowed,
	accountEligible,
	storedEmail
}: FixtureProps) => {
	const tenant = accountPolicyTenant({
		featureDisplayNameEditableAgencyCounsellingEnabled: editable,
		featureAskerEmailEnabled: true,
		featureAskerEmailCollectionAgencyCounsellingEnabled: collectionAllowed,
		featureAskerEmailCollectionSelfHelpEnabled: collectionAllowed,
		emailVisible: true,
		emailRequired: false
	});
	const user = accountPolicyUser({
		email: storedEmail || undefined,
		...(surface === 'removal'
			? {
					twoFactorAuth: {
						isActive: true,
						isEnabled: true,
						secret: '',
						qrCode: '',
						isShown: false,
						type: TWO_FACTOR_TYPES.EMAIL
					}
				}
			: {}),
		isAskerEmailCollectionAllowed: accountEligible
	});
	return (
		<TenantContext.Provider
			value={{ tenant, setTenant: fn(), updateTenantSettings: fn() }}
		>
			<UserDataContext.Provider
				value={{
					userData: user,
					setUserData: fn(),
					reloadUserData: async () => user
				}}
			>
				<ModalProvider>
					{surface === 'removal' && <div id="overlay" />}
					<Box sx={{ width: 'min(520px, 100%)', mx: 'auto', p: 2 }}>
						{surface === 'registration' ||
						surface === 'selfHelp' ? (
							<AccountData
								onChange={fn()}
								conversationType={
									surface === 'selfHelp'
										? 'SELF_HELP'
										: 'AGENCY_COUNSELLING'
								}
							/>
						) : surface === 'removal' ? (
							<AskerAboutMeData />
						) : surface === 'profile' ? (
							<EmailNotification />
						) : (
							<TwoFactorSetupDialog
								open
								canClose
								canDisable={false}
								email={storedEmail}
								onClose={fn()}
								onDisable={fn()}
								onSetupComplete={fn()}
							/>
						)}
					</Box>
				</ModalProvider>
			</UserDataContext.Provider>
		</TenantContext.Provider>
	);
};
const meta = {
	title: 'Entry flows/Registration/Account permissions',
	component: AccountPolicyFixture,
	tags: ['autodocs'],
	beforeEach: () => clearAccountDataDraft(),
	parameters: { layout: 'padded', entryFormDemo: true },
	args: {
		surface: 'registration',
		editable: true,
		collectionAllowed: true,
		accountEligible: true,
		storedEmail: ''
	}
} satisfies Meta<typeof AccountPolicyFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OptionalAlias: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const alias = canvas.getByLabelText(i18n.t('profile.data.displayName'));
		const login = canvas.getByLabelText(
			i18n.t('registration.account.username.label')
		);
		const before = login.getAttribute('value');
		await expect(alias).toHaveValue('');
		await userEvent.type(alias, 'My chosen name');
		await expect(alias).toHaveValue('My chosen name');
		await expect(login).toHaveValue(before);
	}
};
export const GeneratedOnlyAlias: Story = {
	args: { editable: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const alias = canvas.getByLabelText(i18n.t('profile.data.displayName'));
		const login = canvas.getByLabelText(
			i18n.t('registration.account.username.label')
		);
		const initialAlias = (alias as HTMLInputElement).value;
		await expect(alias).toHaveAttribute('readonly');
		await expect(login).toHaveAttribute('readonly');
		await expect(alias).not.toHaveValue('');
		await userEvent.type(alias, 'Cannot type');
		await expect(alias).toHaveValue(initialAlias);
		await userEvent.click(
			canvas.getByRole('button', {
				name: i18n.t('registration.account.displayName.suggest')
			})
		);
		await expect(alias).not.toHaveValue('');
		await expect(
			canvas.queryByRole('button', {
				name: i18n.t('registration.account.displayName.useUsername')
			})
		).not.toBeInTheDocument();
	}
};
export const CounsellingCollectionOff: Story = {
	args: { collectionAllowed: false },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByLabelText(
				i18n.t('registration.account.email.label')
			)
		).not.toBeInTheDocument();
	}
};
export const SelfHelpUsesUsername: Story = {
	args: { surface: 'selfHelp', collectionAllowed: false },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByLabelText(
				i18n.t('profile.data.displayName')
			)
		).not.toBeInTheDocument();
		await expect(
			within(canvasElement).getByLabelText(
				i18n.t('registration.account.username.label')
			)
		).toBeVisible();
	}
};
export const RestrictedProfile: Story = {
	args: { surface: 'profile', accountEligible: false },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByRole('button', {
				name: i18n.t('profile.notifications.noEmail.button')
			})
		).not.toBeInTheDocument();
	}
};
export const EligibleMixedProfile: Story = { args: { surface: 'profile' } };
export const StoredEmailReadOnly: Story = {
	args: {
		surface: 'otp',
		accountEligible: false,
		storedEmail: 'existing@example.test'
	},
	play: async ({ canvasElement }) => {
		const host = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			await host.findByRole('button', {
				name: i18n.t('twoFactorAuth.setupDialog.decision.email')
			})
		);
		const input = await host.findByLabelText(
			i18n.t('twoFactorAuth.setupDialog.email.select.input')
		);
		await expect(input).toHaveAttribute('readonly');
		await userEvent.type(input, 'different');
		await expect(input).toHaveValue('existing@example.test');
		await userEvent.click(input);
		await expect(input).toHaveFocus();
	}
};
export const NewEmailNotAllowed: Story = {
	args: { surface: 'otp', accountEligible: false },
	play: async ({ canvasElement }) => {
		const host = within(canvasElement.ownerDocument.body);
		await expect(
			await host.findByRole('button', {
				name: i18n.t('twoFactorAuth.setupDialog.decision.email')
			})
		).toBeDisabled();
	}
};

/** Confirmation only: no delete request or irreversible action is performed. */
export const StoredEmailRemovalConfirmation: Story = {
	args: {
		surface: 'removal',
		accountEligible: false,
		storedEmail: 'existing@example.test'
	},
	play: async ({ canvasElement }) => {
		const host = within(canvasElement.ownerDocument.body);
		await expect(
			within(canvasElement).queryByText(i18n.t('profile.data.emailInfo'))
		).not.toBeInTheDocument();
		await userEvent.click(
			within(canvasElement).getByRole('button', {
				name: i18n.t('profile.unsetEmail.confirmOverlay.button.confirm')
			})
		);
		await waitFor(() =>
			expect(
				host.getByRole('heading', {
					name: i18n.t('profile.unsetEmail.confirmOverlay.headline')
				})
			).toBeVisible()
		);
		await expect(
			host.getByText(
				i18n.t('twoFactorAuth.email.delete.confirmOverlay.copy')
			)
		).toBeVisible();
	}
};
