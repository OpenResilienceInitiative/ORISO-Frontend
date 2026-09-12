/**
 * Provider stack for the chat-stage stories — the union of what the real
 * `SessionHeaderComponent`, `SessionListItemComponent`, `MessageItemComponent`
 * and `MessageSubmitInterfaceComponent` read. The composer decorator sits
 * innermost (fetch mocks for the audience/draft endpoints); the counsellor
 * user data is re-applied inside it so every component sees `Mona S.`.
 */
import * as React from 'react';
import {
	ActiveSessionContext,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	TopicsContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../../globalState';
import { ServerSettingsContext } from '../../../globalState/provider/ServerSettingsProvider';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import type { ListItemInterface } from '../../../globalState/interfaces';
import { setMatrixClientServiceRef } from '../../../services/matrixClientRegistry';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';
import { ComposerStoryDecorator } from '../../messageSubmitInterface/__storybook__/composerStoryDecorator';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	counsellorUserData,
	stageConsultingType,
	stageListItems,
	stageSession,
	stageTopic,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME
} from './chatStageFixtures';

export const stageRoomMembers = [
	{ userId: COUNSELLOR_MATRIX_ID, name: COUNSELLOR_NAME },
	{ userId: CLIENT_MATRIX_ID, name: CLIENT_NAME },
	{ userId: SUPERVISOR_MATRIX_ID, name: SUPERVISOR_NAME }
];

/**
 * One Matrix client stand-in for everything on stage. The composer decorator
 * only mocks `getRoom().getMembers()`; the session header (SessionMenu),
 * the list rows (`useUnreadVersion`, unread counts) and the timeline also
 * subscribe to client events and read account data, so give them no-ops.
 */
export const buildStageMatrixClientService = (
	unreadByRoom: Record<string, number> = {},
	members: { userId: string; name: string }[] = stageRoomMembers,
	/** Last message timestamp per Matrix id (feeds the header's order). */
	lastActivity: Record<string, number> = {}
) => {
	const room = (roomId: string) => ({
		roomId,
		name: roomId,
		getMembers: () => members,
		getJoinedMembers: () => members,
		getMember: () => ({ powerLevel: 0 }),
		getUnreadNotificationCount: () => unreadByRoom[roomId] ?? 0,
		getLiveTimeline: () => ({
			getEvents: () =>
				Object.entries(lastActivity).map(([sender, ts]) => ({
					getSender: () => sender,
					getTs: () => ts
				}))
		})
	});
	const client = {
		getUserId: () => COUNSELLOR_MATRIX_ID,
		getRoom: (roomId: string) => room(roomId),
		getRooms: () => [],
		getAccountData: () => null,
		setAccountData: async () => ({}),
		on: () => client,
		off: () => client,
		addListener: () => client,
		removeListener: () => client,
		sendMessage: async () => ({ event_id: '$storybook' })
	};
	return {
		getClient: () => client,
		getRoom: (roomId: string) => room(roomId)
	} as any;
};

/** Unread axis of the list rows comes from the Matrix registry (#1147). */
export const seedStageMatrixRegistry = (unreadByRoom: Record<string, number>) =>
	setMatrixClientServiceRef(buildStageMatrixClientService(unreadByRoom));

export function ChatStageProviders({
	activeSession = stageSession(),
	sessions = stageListItems(),
	children
}: {
	activeSession?: ExtendedSessionInterface;
	sessions?: ListItemInterface[];
	children: React.ReactNode;
}) {
	const matrixValue = React.useMemo(
		() => ({
			matrixClientService: buildStageMatrixClientService(),
			setMatrixClientService: () => {}
		}),
		[]
	);
	const userDataValue = React.useMemo(
		() => ({
			userData: counsellorUserData,
			setUserData: () => {},
			reloadUserData: async () => counsellorUserData
		}),
		[]
	);
	return (
		<SessionTypeContext.Provider
			value={{
				type: SESSION_LIST_TYPES.MY_SESSION,
				path: '/sessions/consultant/sessionView'
			}}
		>
			<ConsultingTypesContext.Provider
				value={{
					consultingTypes: [stageConsultingType],
					setConsultingTypes: () => {}
				}}
			>
				<TopicsContext.Provider
					value={{ topics: [stageTopic], refreshTopics: () => {} }}
				>
					<SessionsDataContext.Provider
						value={{ ready: true, sessions, dispatch: () => {} }}
					>
						<E2EEContext.Provider
							value={{
								key: '',
								reloadPrivateKey: () => {},
								isE2eeEnabled: false,
								e2EEReady: true
							}}
						>
							<ConsultantListContext.Provider
								value={{
									consultantList: [],
									setConsultantList: () => {}
								}}
							>
								<ServerSettingsContext.Provider
									value={{
										settings: [],
										settingsReady: true,
										getSetting: () => null
									}}
								>
									<LegalLinksContext.Provider value={[]}>
										<ComposerStoryDecorator
											activeSession={activeSession}
											roomMembers={stageRoomMembers}
										>
											<MatrixClientContext.Provider
												value={matrixValue}
											>
												<UserDataContext.Provider
													value={userDataValue}
												>
													{children}
												</UserDataContext.Provider>
											</MatrixClientContext.Provider>
										</ComposerStoryDecorator>
									</LegalLinksContext.Provider>
								</ServerSettingsContext.Provider>
							</ConsultantListContext.Provider>
						</E2EEContext.Provider>
					</SessionsDataContext.Provider>
				</TopicsContext.Provider>
			</ConsultingTypesContext.Provider>
		</SessionTypeContext.Provider>
	);
}

/** A list row needs its own active-session context (the row's session). */
export function ListRowSession({
	item,
	children
}: {
	item: ListItemInterface;
	children: React.ReactNode;
}) {
	const session = React.useMemo(() => buildExtendedSession(item, ''), [item]);
	return (
		<ActiveSessionContext.Provider
			value={{
				activeSession: session,
				reloadActiveSession: () => {},
				readActiveSession: () => {}
			}}
		>
			{children}
		</ActiveSessionContext.Provider>
	);
}
