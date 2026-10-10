import { AUTHORITIES } from '../../globalState';
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StandingAccessSettings } from './StandingAccessSettings';
import {
	MessageContextShell,
	desktop1440Globals,
	phone390Globals,
	tablet834Globals
} from '../message/messageStoryShell';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { mockUserData } from '../message/MessageItemComponent.mocks';
import { StandingAccessPreferenceStoryFixture } from './standingAccessPreferenceStoryFixture';

/** Only the HTTP preference boundary is a fixture; the M3 dialog, shared
 * switch and save/readback continuation are production components. */
const Fixture = (args: React.ComponentProps<typeof StandingAccessSettings>) => {
	const userData = React.useMemo(
		() =>
			mockUserData({
				userId: 'asker-storybook',
				grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
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
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				<StandingAccessPreferenceStoryFixture
					sessionId={args.sessionId}
				>
					<StandingAccessSettings {...args} />
				</StandingAccessPreferenceStoryFixture>
			</UserDataContext.Provider>
		</MessageContextShell>
	);
};
const meta = {
	title: 'Chat/System messages/Consent settings',
	component: StandingAccessSettings,
	tags: ['autodocs'],
	args: { sessionId: 1, conversationType: 'AGENCY_COUNSELLING' },
	render: (args) => <Fixture {...args} />,
	globals: desktop1440Globals
} satisfies Meta<typeof StandingAccessSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SaveAndReadBack: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(await canvas.findByRole('button'));
		const page = within(document.body);
		const control = await page.findByRole('switch');
		await expect(control).not.toBeChecked();
		await userEvent.click(control);
		await waitFor(() =>
			expect(page.queryByRole('dialog')).not.toBeInTheDocument()
		);
		await userEvent.click(canvas.getByRole('button'));
		await expect(await page.findByRole('switch')).toBeChecked();
	}
};
export const Phone390: Story = { ...SaveAndReadBack, globals: phone390Globals };

export const Tablet834: Story = {
	...SaveAndReadBack,
	globals: tablet834Globals
};
