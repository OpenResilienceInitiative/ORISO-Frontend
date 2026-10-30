import * as React from 'react';
import { setMatrixClientServiceRef } from '../../../services/matrixClientRegistry';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultingTypesContext,
	E2EEContext,
	SessionTypeContext,
	SessionsDataContext,
	TopicsContext,
	UserDataContext
} from '../../../globalState';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import {
	SessionListItemComponent,
	type SessionCardDatePlacement
} from '../SessionListItemComponent';
import '../sessionsListItem.styles.scss';

/*
 * The real session card (`SessionListItemComponent`) with the providers it
 * reads, for stories that need list rows in the app's own design (Frank
 * 2026-09-21: no hand-drawn stand-in rows).
 */

export const runtimeTopic: TopicsDataInterface = {
	id: 1,
	name: 'Familienberatung',
	slug: 'familienberatung',
	description: 'Storybook runtime topic.',
	internalIdentifier: 'familienberatung',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Familie',
		long: 'Familienberatung',
		registrationDropdown: 'Familienberatung',
		welcome: 'Familienberatung'
	}
};

export const runtimeConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: '1-1 Beratung',
		short: '1-1',
		long: '1-1 Beratung',
		welcome: 'Willkommen',
		registrationDropdown: '1-1 Beratung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: {
		isGroupChat: false,
		groupChatRules: ['']
	},
	description: 'Storybook runtime fixture for the real session row.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
};

export const runtimeSession: ListItemInterface = {
	user: {
		username: 'ruhiges-yak-kim@example.invalid',
		displayName: 'ruhiges Yak Kim',
		sessionData: {}
	},
	consultant: {
		consultantId: 'consultant-storybook',
		id: 'consultant-storybook',
		username: 'beraterin@example.invalid',
		displayName: 'Beraterin ORISO',
		absent: false,
		absenceMessage: ''
	},
	language: 'de',
	session: {
		id: 4401,
		agencyId: 101,
		askerMatrixUserId: 'asker-4401',
		attachment: null,
		consultingType: 1,
		matrixRoomId: 'storybook-runtime-room-4401',
		e2eLastMessage: null,
		lastMessage: 'Anfrage gesendet',
		messageDate: 1773822900,
		createDate: '2026-03-18T06:15:00.000Z',
		messagesRead: false,
		postcode: 12345,
		registrationType: REGISTRATION_TYPE_REGISTERED,
		status: STATUS_ACTIVE,
		videoCallMessageDTO: null,
		topic: runtimeTopic
	}
};

export const runtimeUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

/** Providers every card in one list shares; `sessions` feeds the list data. */
export function RuntimeSessionProviders({
	sessions,
	viewerId = runtimeUserData.userId,
	asAsker = false,
	topics = [runtimeTopic],
	children
}: {
	sessions: ListItemInterface[];
	/** Topics the cards resolve their tag from. */
	topics?: TopicsDataInterface[];
	viewerId?: string;
	/** Log in as an advice seeker instead of the consultant. */
	asAsker?: boolean;
	children: React.ReactNode;
}) {
	const userData = asAsker
		? {
				...runtimeUserData,
				userId: 'asker-4401',
				grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
				userRoles: ['USER']
			}
		: { ...runtimeUserData, userId: viewerId };
	return (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: () => {},
				reloadUserData: async () => userData
			}}
		>
			<SessionTypeContext.Provider
				value={{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/consultant/sessionView'
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: [runtimeConsultingType],
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{
							topics,
							refreshTopics: () => {}
						}}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions,
								dispatch: () => {}
							}}
						>
							<E2EEContext.Provider
								value={{
									key: '',
									reloadPrivateKey: () => {},
									isE2eeEnabled: false,
									e2EEReady: true
								}}
							>
								<LegalLinksContext.Provider value={[]}>
									{children}
								</LegalLinksContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
}

/** One real card; render inside {@link RuntimeSessionProviders}. */
export function RuntimeSessionCard({
	session,
	index = 0,
	...grouping
}: {
	session: ListItemInterface;
	index?: number;
	/** The list's grouping flags (ADR-021); omit for a standalone card. */
	grouped?: boolean;
	isGroupStart?: boolean;
	isGroupEnd?: boolean;
	isBeforeActive?: boolean;
	isAfterActive?: boolean;
	/** ADR-021 timeline prototype: clock circle and date placement. */
	upcomingAppointment?: string;
	datePlacement?: SessionCardDatePlacement;
}) {
	const activeSession = buildExtendedSession(session, '');
	return (
		<ActiveSessionContext.Provider
			value={{
				activeSession,
				reloadActiveSession: () => {},
				readActiveSession: () => {}
			}}
		>
			<SessionListItemComponent
				defaultLanguage="de"
				handleKeyDownLisItemContent={() => {}}
				index={index}
				{...grouping}
			/>
		</ActiveSessionContext.Provider>
	);
}

/** A group chat owned by the viewer, so its card offers the settings menu. */
export const runtimeGroupChat = ({
	id,
	name,
	lastMessage = '',
	repetitive = false,
	conversationType
}: {
	id: number;
	name: string;
	lastMessage?: string;
	repetitive?: boolean;
	conversationType?: GroupChatItemInterface['conversationType'];
}): ListItemInterface => ({
	consultant: runtimeSession.consultant,
	chat: {
		id,
		topic: name,
		conversationType,
		repetitive,
		active: false,
		consultingType: 1,
		matrixRoomId: `!storybook-group-${id}:matrix.example.org`,
		lastMessage,
		messageDate: 1773736500,
		messagesRead: true,
		moderators: [],
		assignedAgencies: [],
		attachment: null,
		duration: 60,
		hintMessage: '',
		e2eLastMessage: null,
		startDate: '2026-03-17',
		startTime: '10:00',
		subscribed: true,
		createdAt: '2026-03-17T10:00:00.000Z'
	} as GroupChatItemInterface
});

/**
 * Unread axis (#1147): read state is derived from the Matrix room, not from
 * the DTO's hard-coded `messagesRead`. Seed the registry so the runtime
 * stories pin both visual states.
 */
export const seedMatrixRoom = (
	unreadCount: number,
	count = 3,
	delayed = false,
	failed = false
) => {
	let members = Array.from({ length: count }, (_, index) => ({
		userId: `@group-person-${index}:matrix.example.org`,
		name: `Teilnehmende ${index + 1}`,
		membership: 'join'
	}));
	const rooms = new Map<string, ReturnType<typeof makeRoom>>();
	const messages = new Map<string, ReturnType<typeof previewEvent>[]>();
	function previewEvent(body: string) {
		const content = { msgtype: 'm.text', body };
		return {
			getType: () => 'm.room.message',
			getContent: () => content,
			getClearContent: () => content,
			getSender: () => '@group-person-0:matrix.example.org',
			getTs: () => 1_773_736_500_000
		};
	}
	const listeners = new Map<string, Set<(...args: any[]) => void>>();
	let finish: () => void = () => {};
	const hydration = delayed
		? new Promise<boolean>((resolve) => {
				finish = () => resolve(true);
			})
		: Promise.resolve(true);
	function makeRoom(roomId: string) {
		return {
			roomId,
			loadMembersIfNeeded: () =>
				failed
					? Promise.reject(new Error('Membership unavailable'))
					: hydration,
			getJoinedMembers: () => members,
			getUnreadNotificationCount: () => unreadCount
		};
	}
	const removeListener = (name: string, listener: (...args: any[]) => void) =>
		listeners.get(name)?.delete(listener);
	const client = {
		getRoom: (roomId: string) => {
			if (!rooms.has(roomId)) rooms.set(roomId, makeRoom(roomId));
			return rooms.get(roomId);
		},
		getUserId: () => '@consultant-storybook:matrix.example.org',
		on: (name: string, listener: (...args: any[]) => void) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener);
		},
		off: removeListener,
		removeListener
	};
	setMatrixClientServiceRef({
		getClient: () => client,
		getRoom: client.getRoom,
		getRoomMessages: (roomId: string) => messages.get(roomId) || []
	} as any);
	return {
		finish,
		setMessage: (roomId: string, body: string) =>
			messages.set(roomId, [previewEvent(body)]),
		setCount: (next: number) => {
			members = Array.from({ length: next }, (_, index) => ({
				userId: `@group-person-${index}:matrix.example.org`,
				name: `Teilnehmende ${index + 1}`,
				membership: 'join'
			}));
			rooms.forEach((room) =>
				listeners
					.get('RoomState.members')
					?.forEach((listener) => listener({}, room))
			);
		}
	};
};
