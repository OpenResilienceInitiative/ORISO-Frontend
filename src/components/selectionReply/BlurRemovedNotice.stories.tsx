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
 * no longer shows "Diese Nachricht wurde gelöscht.". It is a platform notice
 * in the chat: `ChatSystemMessageCard` — the ordinary incoming-message
 * anatomy with the round info icon, as for calls and appointments. Not the
 * Carimat frame (that is the chatbot: guides, step by step). No new
 * component, no reply quote. The message itself is readable again.
 * Two variants, as for every message (Figma App.Oriso 9895:31375 left,
 * 8606:42438 right): someone else removed it, or I did.
 */
const handlers = {
	handleDecryptionErrors: () => {},
	handleDecryptionSuccess: () => {},
	e2eeParams: mockE2eeParams()
};

const Timeline = ({ mine = false }: { mine?: boolean }) => (
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
							{/* The real row: the formatter turns the lifting
							   redaction into `t: 'blur-removed'`. */}
							<MessageItemComponent
								{...mockMessageItemComponentProps({
									_id: '$redaction',
									t: 'blur-removed',
									message: '',
									isMyMessage: mine,
									userId: mine ? '@me:hs' : '@karina:hs',
									displayName: 'Karina P',
									username: 'karina',
									messageDate: undefined,
									blurRemoved: {
										targetEventId: '$msg',
										targetSenderName: 'Sanftes Alpaka Kala'
									}
								} as never)}
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
					'#2494 *9: "Schwärzung aufgehoben von <Name>" as the platform info card (ChatSystemMessageCard, round i), like call and appointment notices; the message is readable again. Replaces "Diese Nachricht wurde gelöscht.".'
			}
		}
	},
	render: () => <Timeline />
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Someone else removed the redaction: info avatar left. */
export const Notice1440: Story = {
	name: 'Von jemand anderem aufgehoben · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				within(canvasElement).getByText('Schwärzung aufgehoben')
			).toBeInTheDocument()
		);
	}
};

/** I removed it: my side, info avatar right. */
export const Mine1440: Story = {
	name: 'Von mir aufgehoben · 1440',
	globals: desktop1440Globals,
	render: () => <Timeline mine />
};

export const Notice390: Story = {
	name: 'Von jemand anderem aufgehoben · 390',
	globals: phone390Globals
};

export const Mine390: Story = {
	name: 'Von mir aufgehoben · 390',
	globals: phone390Globals,
	render: () => <Timeline mine />
};
