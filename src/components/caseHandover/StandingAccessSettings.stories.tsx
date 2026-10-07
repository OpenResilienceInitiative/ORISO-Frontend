import { AUTHORITIES } from '../../globalState';
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StandingAccessSettings } from './StandingAccessSettings';
import {
	MessageContextShell,
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { mockUserData } from '../message/MessageItemComponent.mocks';
import { endpoints } from '../../resources/scripts/endpoints';

/** Only the HTTP preference boundary is a fixture; the M3 dialog, shared
 * switch and save/readback continuation are production components. */
const Fixture = (args: React.ComponentProps<typeof StandingAccessSettings>) => {
	const saved = React.useRef(false);
	const [ready, setReady] = React.useState(false);
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
	React.useEffect(() => {
		const previous = globalThis.fetch;
		const path = `${endpoints.sessionBase}/${args.sessionId}/case-handover/consent-preference`;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			if (url.endsWith(path)) {
				if (init?.method === 'PUT')
					saved.current = JSON.parse(
						String(init.body)
					).alwaysAskBeforeAdditionalAccess;
				return new Response(
					JSON.stringify({
						sessionId: args.sessionId,
						alwaysAskBeforeAdditionalAccess: saved.current
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			return previous(input, init);
		};
		setReady(true);
		return () => {
			globalThis.fetch = previous;
		};
	}, [args.sessionId]);
	return (
		<MessageContextShell>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				{ready && <StandingAccessSettings {...args} />}
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
