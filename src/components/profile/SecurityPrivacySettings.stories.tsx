import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { UserDataContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { SecurityPrivacySettings } from './SecurityPrivacySettings';
import { DisplayNameSettings } from './DisplayNameSettings';
import { ProfileCard } from './ProfileCard';
import {
	buildFakeClient,
	statusHealthy,
	statusNotSetUp,
	statusOutOfSync
} from './EncryptionSettings/EncryptionSettings.fixtures';
import './profile.styles';

const withUser =
	(consultant = false, stress = false) =>
	(Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: 'security-privacy-story',
						userName: 'mara',
						displayName: stress
							? 'Mara mit einem sehr langen Anzeigenamen für schmale Ansichten'
							: 'Mara',
						grantedAuthorities: [
							consultant
								? 'AUTHORIZATION_CONSULTANT_DEFAULT'
								: 'AUTHORIZATION_USER_DEFAULT'
						],
						twoFactorAuth: {
							isEnabled: consultant,
							isActive: false
						},
						consultingTypes: {},
						agencies: []
					},
					reloadUserData: () => Promise.resolve(),
					setUserData: () => undefined
				} as never
			}
		>
			<div
				className="profile"
				style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}
			>
				<div className="profile__cards">
					<ProfileCard boxed={false} fullWidth>
						<ModalProvider>
							<Story />
						</ModalProvider>
					</ProfileCard>
				</div>
			</div>
		</UserDataContext.Provider>
	);
const meta = {
	title: 'Organisms/SecurityPrivacySettings',
	component: SecurityPrivacySettings,
	subcomponents: { DisplayNameSettings, ProfileCard },
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' },
	decorators: [withUser()],
	args: {
		encryptionSettingsProps: {
			clientOverride: buildFakeClient(),
			initialStatusOverride: statusNotSetUp
		}
	},
	play: async ({ canvas }) => {
		await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(
			3
		);
		await expect(
			canvas.queryByText('Verschlüsselung & Wiederherstellung')
		).not.toBeInTheDocument();
	}
} satisfies Meta<typeof SecurityPrivacySettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AskerNotSetUp: Story = {
	play: async (context) => {
		await meta.play(context);
		await expect(
			context.canvas.findByText(
				'Ihr Ersatzschlüssel ist noch nicht eingerichtet.'
			)
		).resolves.toBeVisible();
	}
};
export const ConsultantHealthy: Story = {
	globals: { viewport: { value: 'desktop1440' } },
	decorators: [withUser(true)],
	args: {
		encryptionSettingsProps: {
			clientOverride: buildFakeClient(),
			initialStatusOverride: statusHealthy
		}
	},
	play: async (context) => {
		await meta.play(context);
		const account = context.canvas.getByRole('region', {
			name: 'Anmeldung & Konto'
		});
		const [passwordCard, twoFactorCard] =
			account.querySelectorAll('.profile__card');
		await expect(twoFactorCard.getBoundingClientRect().height).toBeLessThan(
			passwordCard.getBoundingClientRect().height
		);
		const twoFactorHeading = within(account).getByRole('heading', {
			name: 'Zwei-Faktor-Authentifizierung'
		});
		const edit = within(twoFactorCard as HTMLElement).getByRole('button', {
			name: 'Bearbeiten'
		});
		const headingText = document.createRange();
		headingText.selectNodeContents(twoFactorHeading);
		await expect(edit.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			headingText.getBoundingClientRect().right
		);
		const privacy = context.canvas.getByRole('region', {
			name: 'Privatsphäre'
		});
		await userEvent.click(
			within(privacy).getByRole('button', { name: 'Bearbeiten' })
		);
		await expect(within(privacy).getByRole('textbox')).toBeEnabled();
		await userEvent.click(
			within(privacy).getByRole('button', { name: 'Abbrechen' })
		);
		await expect(
			context.canvas.findByText(
				'✓ Ihr Ersatzschlüssel ist eingerichtet. Ihr Verlauf bleibt auf neuen Geräten lesbar.'
			)
		).resolves.toBeVisible();
	}
};
export const AskerNeedsRecovery: Story = {
	args: {
		encryptionSettingsProps: {
			clientOverride: buildFakeClient({
				getSessionBackupPrivateKey: async () => null,
				getActiveSessionBackupVersion: async () => null,
				isSecretStorageReady: async () => false
			}),
			initialStatusOverride: statusOutOfSync
		}
	},
	play: async (context) => {
		await meta.play(context);
		const recovery = context.canvas.getByRole('region', {
			name: 'Wiederherstellung alter Nachrichten'
		});
		await userEvent.type(
			within(recovery).getByRole('textbox'),
			'invalid key'
		);
		await userEvent.click(
			within(recovery).getByRole('button', {
				name: 'Verlauf wiederherstellen'
			})
		);
		await waitFor(() =>
			expect(
				recovery.querySelector('[data-cy="encryption-setup-error"]')
			).toBeVisible()
		);
	}
};
export const AskerUnavailable: Story = {
	args: {
		encryptionSettingsProps: {
			clientOverride: null,
			initialStatusOverride: null
		}
	}
};
export const English: Story = {
	globals: { locale: 'en', viewport: { value: 'desktop1440' } },
	decorators: [withUser(true)],
	args: ConsultantHealthy.args,
	play: async (context) => {
		await meta.play(context);
		const account = context.canvas.getByRole('region', {
			name: 'Sign-in & account'
		});
		const twoFactorCard = account.querySelectorAll('.profile__card')[1];
		const heading = within(twoFactorCard as HTMLElement).getByRole(
			'heading',
			{ name: 'Two-factor authentication' }
		);
		const edit = within(twoFactorCard as HTMLElement).getByRole('button', {
			name: 'edit'
		});
		const headingText = document.createRange();
		headingText.selectNodeContents(heading);
		await expect(edit.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			headingText.getBoundingClientRect().right
		);
		await expect(
			context.canvas.findByText(
				'✓ Your recovery key is set up. Your history stays readable on new devices.'
			)
		).resolves.toBeVisible();
	}
};
export const LongNamePhone: Story = {
	decorators: [withUser(true, true)],
	globals: { viewport: { value: 'phone390' } },
	args: ConsultantHealthy.args
};
