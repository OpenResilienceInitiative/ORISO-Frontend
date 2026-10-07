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
			context.canvas.findByText('Nicht eingerichtet')
		).resolves.toBeVisible();
	}
};
export const ConsultantHealthy: Story = {
	decorators: [withUser(true)],
	args: {
		encryptionSettingsProps: {
			clientOverride: buildFakeClient(),
			initialStatusOverride: statusHealthy
		}
	},
	play: async (context) => {
		await meta.play(context);
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
			context.canvas.findByText('Tresor eingerichtet')
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
			within(recovery).getByRole('button', { name: 'Tresor öffnen' })
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
	globals: { locale: 'en' },
	decorators: [withUser(true)],
	args: ConsultantHealthy.args
};
export const LongNamePhone: Story = {
	decorators: [withUser(true, true)],
	globals: { viewport: { value: 'phone390' } },
	args: ConsultantHealthy.args
};
