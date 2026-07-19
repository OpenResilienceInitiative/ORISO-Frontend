import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import {
	ActiveSessionContext,
	E2EEContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import type { UserDataInterface } from '../../globalState/interfaces';
import { MessageItemComponent } from './MessageItemComponent';
import {
	MOCK_ASKER_RC_ID,
	MOCK_CONSULTANT_RC_ID,
	MOCK_GROUP_MODERATOR_RC_ID,
	mockActiveSession1on1,
	mockActiveSessionGroup,
	mockAppointmentAliasContent,
	mockConsultantListContext,
	mockE2EEContext,
	mockE2eeParams,
	mockLongGermanMessage,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockCaseHandoverGrantedMessage,
	mockManyReactions,
	mockReactions,
	mockSystemNotificationMessage,
	mockUserData,
	mockVisibilityMessage
} from './MessageItemComponent.mocks';
import './message.styles.scss';

type MessageItemStoryParameters = {
	activeSession?: ExtendedSessionInterface;
	userData?: UserDataInterface;
};

function MessageItemContextDecorator({
	activeSession,
	userData,
	children
}: {
	activeSession: ExtendedSessionInterface;
	userData: UserDataInterface;
	children: React.ReactNode;
}) {
	return (
		<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
			<ConsultantListContext.Provider value={mockConsultantListContext()}>
				<E2EEContext.Provider value={mockE2EEContext()}>
					<UserDataContext.Provider
						value={{
							userData,
							setUserData: () => {},
							reloadUserData: async () => null as any
						}}
					>
						<ActiveSessionContext.Provider
							value={{
								activeSession,
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
								{children}
							</div>
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</E2EEContext.Provider>
			</ConsultantListContext.Provider>
		</ServerSettingsContext.Provider>
	);
}

const baseHandlers = {
	handleDecryptionErrors: () => {},
	handleDecryptionSuccess: () => {},
	e2eeParams: mockE2eeParams()
};

const meta = {
	title: 'Components/Chat/MessageItem',
	component: MessageItemComponent,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps(),
		...baseHandlers
	},
	decorators: [
		(Story, { parameters }) => (
			<MessageItemContextDecorator
				activeSession={
					(parameters as MessageItemStoryParameters).activeSession ??
					mockActiveSession1on1()
				}
				userData={
					(parameters as MessageItemStoryParameters).userData ??
					mockUserData()
				}
			>
				<Story />
			</MessageItemContextDecorator>
		)
	]
} satisfies Meta<typeof MessageItemComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientIn1on1Incoming: Story = {
	name: 'Client 1-on-1 incoming (animal avatar)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		...baseHandlers
	}
};

export const ClientIn1on1Outgoing: Story = {
	name: 'Client 1-on-1 outgoing (animal avatar)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message:
				'Danke, dass du dich meldest. Lass uns zuerst die nächsten 10 Minuten strukturieren.'
		}),
		...baseHandlers
	}
};

export const GroupIncoming: Story = {
	name: 'Group incoming (initials avatar)',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_GROUP_MODERATOR_RC_ID,
			rid: mockActiveSessionGroup().rid,
			displayName: 'Angela K',
			username: 'angela.k@oriso.invalid',
			message:
				'Kurzes Update für das Team: Der Fall bleibt heute bei mir.'
		}),
		...baseHandlers
	}
};

export const GroupOutgoing: Story = {
	name: 'Group outgoing (initials avatar)',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			rid: mockActiveSessionGroup().rid,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message:
				'Verstanden, ich übernehme die Rückmeldung an die Klientin.'
		}),
		...baseHandlers
	}
};

export const NormalMessage: Story = {
	name: 'Normal text message',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID
		}),
		...baseHandlers
	}
};

export const SystemNotification: Story = {
	name: 'System notification',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: 'system',
			displayName: 'system',
			username: 'system',
			message: mockSystemNotificationMessage
		}),
		...baseHandlers
	}
};

export const CaseHandoverGranted: Story = {
	name: 'Case handover granted (system card)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: 'system',
			displayName: 'system',
			username: 'system',
			message: mockCaseHandoverGrantedMessage
		}),
		...baseHandlers
	}
};

export const AppointmentSet: Story = {
	name: 'Appointment set',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message: '',
			alias: {
				messageType: ALIAS_MESSAGE_TYPES.APPOINTMENT_SET,
				content: mockAppointmentAliasContent
			}
		}),
		...baseHandlers
	}
};

export const DeletedMessage: Story = {
	name: 'Deleted message',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			t: 'rm',
			message: 'Diese Nachricht wurde gelöscht.'
		}),
		...baseHandlers
	}
};

export const LongMessage: Story = {
	name: 'Long message with show more',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			message: mockLongGermanMessage
		}),
		...baseHandlers
	}
};

export const IncomingWithReactions: Story = {
	name: 'Incoming with reactions',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		reactions: mockReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

export const OutgoingWithReactions: Story = {
	name: 'Outgoing with reactions (delivered)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message:
				'Danke für deine Offenheit. Wir schauen uns das morgen gemeinsam an.'
		}),
		reactions: mockReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

export const OutgoingWithManyReactions: Story = {
	name: 'Outgoing with many reactions (horizontal scroll)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Viele Reaktionen: die Chip-Leiste scrollt horizontal.'
		}),
		reactions: mockManyReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

export const IncomingWithManyReactions: Story = {
	name: 'Incoming with many reactions (horizontal scroll)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			displayName: 'Sanftes Alpaka Kala',
			username: 'sanftes.alpaka.kala@oriso.invalid'
		}),
		reactions: mockManyReactions(),
		onReact: () => {},
		onUnreact: () => {},
		...baseHandlers
	}
};

export const OutgoingDelivered: Story = {
	name: 'Outgoing delivered (single checkmark)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Diese Nachricht ist zugestellt, aber noch nicht gelesen.'
		}),
		onReact: () => {},
		...baseHandlers
	}
};

export const OutgoingRead: Story = {
	name: 'Outgoing read (double checkmark)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: false,
			message: 'Diese Nachricht wurde bereits gelesen.'
		}),
		onReact: () => {},
		...baseHandlers
	}
};

export const OutgoingSendFailed: Story = {
	name: 'Outgoing send failed (cross)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			isNotRead: true,
			message: 'Diese Nachricht hat den Server nicht erreicht.'
		}),
		sendFailed: true,
		onReact: () => {},
		...baseHandlers
	}
};

export const WideLongMessageDesktop: Story = {
	name: 'Long text widens bubble (desktop 770px)',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: false,
			userId: MOCK_ASKER_RC_ID,
			askerRcId: MOCK_ASKER_RC_ID,
			message:
				'Hier ist das folgende Problem mit der Länge der Chatnachrichten: Oft sind die natürlich wie in einem Chat nicht so lang, weil sie eine direkte Unterhaltung sind. Manchmal sind das aber riesige Textbrocken, und da wäre auf dem Desktop besser, wenn die eher die breite Variante nutzen, damit die Zeilen nicht endlos umbrechen und der Text gut lesbar bleibt.'
		}),
		...baseHandlers
	}
};

export const OutgoingWithVisibility: Story = {
	name: 'Outgoing with visibility chip',
	parameters: {
		activeSession: mockActiveSession1on1(),
		userData: mockUserData()
	},
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			userId: MOCK_CONSULTANT_RC_ID,
			displayName: 'Karina P',
			username: 'karina.p@oriso.invalid',
			message: mockVisibilityMessage
		}),
		...baseHandlers
	}
};
