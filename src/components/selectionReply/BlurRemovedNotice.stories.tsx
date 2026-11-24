import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	E2EEContext,
	UserDataContext
} from '../../globalState';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MessageItemComponent } from '../message/MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockConsultantListContext,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from '../message/MessageItemComponent.mocks';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';

/**
 * ORISO-Frontend#2494 *9 (P0 v2.0.18): removing a redaction (Schwärzung)
 * no longer shows "Diese Nachricht wurde gelöscht.". It is an ordinary
 * system notification in the chat — the same chat-message design as every
 * other platform notice (`MessageItemComponent` with a `[SYSTEM_NOTIFICATION]`
 * message; see "Components/Chat/MessageItem → System notification" and
 * "Chat/System messages/Inventory"). No new component, no reply quote.
 * The message itself is readable again.
 */
const NOTICE = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	title: 'Schwärzung aufgehoben',
	description: 'Schwärzung aufgehoben von Karina P',
	type: 'INFO'
})}`;

const handlers = {
	handleDecryptionErrors: () => {},
	handleDecryptionSuccess: () => {},
	e2eeParams: mockE2eeParams()
};

const Timeline = () => (
	<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
		<ConsultantListContext.Provider
			value={mockConsultantListContext() as never}
		>
			<E2EEContext.Provider value={mockE2EEContext()}>
				<UserDataContext.Provider
					value={{
						userData: mockUserData(),
						setUserData: () => {},
						reloadUserData: async () => null as never
					}}
				>
					<ActiveSessionContext.Provider
						value={{
							activeSession: mockActiveSession1on1(),
							reloadActiveSession: () => {},
							readActiveSession: () => {}
						}}
					>
						<div
							style={{
								maxWidth: 1000,
								padding: '24px 16px',
								background: '#ffffff'
							}}
						>
							{/* The message, readable again. */}
							<MessageItemComponent
								{...mockMessageItemComponentProps({
									isMyMessage: false,
									userId: MOCK_ASKER_MATRIX_ID,
									askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
									message:
										'Hallo, meine Adresse ist Lindenstraße 12, bitte schicken Sie mir die Unterlagen.'
								})}
								{...handlers}
							/>
							{/* The platform notice, in the chat-message design. */}
							<MessageItemComponent
								{...mockMessageItemComponentProps({
									isMyMessage: false,
									userId: 'system',
									displayName: 'system',
									username: 'system',
									message: NOTICE
								})}
								/* Same day as the message above: one day pill. */
								messageDate={undefined}
								{...handlers}
							/>
						</div>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</E2EEContext.Provider>
		</ConsultantListContext.Provider>
	</ServerSettingsContext.Provider>
);

const meta = {
	id: 'p0-v2018-9-blur-removed',
	title: 'P0 v2.0.18/*9 Schwärzung aufgehoben',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2494 *9: "Schwärzung aufgehoben von <Name>" as an ordinary system notification in the chat-message design (MessageItemComponent, [SYSTEM_NOTIFICATION]); the message is readable again. Replaces "Diese Nachricht wurde gelöscht.".'
			}
		}
	},
	render: () => <Timeline />
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notice1440: Story = {
	name: 'Systemnachricht im Chat · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				within(canvasElement).getByText(
					'Schwärzung aufgehoben von Karina P'
				)
			).toBeInTheDocument()
		);
	}
};

export const Notice390: Story = {
	name: 'Systemnachricht im Chat · 390',
	globals: phone390Globals
};
