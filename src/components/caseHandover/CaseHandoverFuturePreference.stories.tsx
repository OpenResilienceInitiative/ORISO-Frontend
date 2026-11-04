import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { CaseHandoverConversation } from './CaseHandoverConversation';
import { StandingAccessPreferenceStoryFixture } from './standingAccessPreferenceStoryFixture';
import {
	MessageContextShell,
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { mockUserData } from '../message/MessageItemComponent.mocks';

/** Production message and preference GET/PUT; only the external HTTP boundary is synthetic. */
const Fixture = (
	args: React.ComponentProps<typeof CaseHandoverConversation>
) => {
	const [reload, setReload] = React.useState(0);
	const account = React.useMemo(
		() =>
			mockUserData({
				userId: 'asker-standing-story',
				email: 'review@example.invalid',
				emailNotifications: {
					emailNotificationsEnabled: true,
					settings: {
						newChatMessageNotificationEnabled: true,
						reassignmentNotificationEnabled: true
					}
				}
			}),
		[]
	);
	return (
		<MessageContextShell>
			<UserDataContext.Provider
				value={{
					userData: account,
					setUserData: () => {},
					reloadUserData: async () => account
				}}
			>
				<StandingAccessPreferenceStoryFixture sessionId={42}>
					<CaseHandoverConversation
						key={reload}
						{...args}
						sessionId={42}
						conversationType="AGENCY_COUNSELLING"
					/>
					<button
						type="button"
						onClick={() => setReload((value) => value + 1)}
					>
						Reload conversation fixture
					</button>
				</StandingAccessPreferenceStoryFixture>
			</UserDataContext.Provider>
		</MessageContextShell>
	);
};
const meta = {
	title: 'Chat/System messages/Consent/Future access',
	component: CaseHandoverConversation,
	tags: ['autodocs'],
	args: {
		sessionId: 42,
		conversationType: 'AGENCY_COUNSELLING',
		mode: 'OPT_IN',
		onApprove: () => {},
		onDecline: () => {}
	},
	render: (args) => <Fixture {...args} />,
	globals: { ...desktop1440Globals, locale: 'en' }
} satisfies Meta<typeof CaseHandoverConversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PendingOptIn: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const future = await canvas.findByRole('switch', {
			name: 'Always ask before additional access'
		});
		await expect(future).not.toBeChecked();
		await userEvent.click(future);
		await waitFor(() => expect(future).toBeChecked());
		await userEvent.click(
			canvas.getByRole('button', { name: 'Learn more' })
		);
		const dialog = within(await within(document.body).findByRole('dialog'));
		await expect(
			await dialog.findByRole('switch', {
				name: 'Always ask before additional access'
			})
		).toBeChecked();
		await userEvent.click(dialog.getByTestId('m3-dialog-close'));
		await waitFor(() =>
			expect(
				within(document.body).queryByRole('dialog')
			).not.toBeInTheDocument()
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Reload conversation fixture' })
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('switch', {
					name: 'Always ask before additional access'
				})
			).toBeChecked()
		);
	}
};
export const ActiveOptOut: Story = {
	...PendingOptIn,
	args: { mode: 'OPT_OUT', consentGranted: true }
};
export const SilentInformation: Story = {
	...PendingOptIn,
	args: { mode: 'NONE' }
};
export const ResolvedDenied: Story = {
	...PendingOptIn,
	args: { mode: 'OPT_IN', status: 'CLIENT_CONSENT_DECLINED' }
};
export const PendingOptInPhone: Story = {
	...PendingOptIn,
	globals: { ...phone390Globals, locale: 'en' }
};
