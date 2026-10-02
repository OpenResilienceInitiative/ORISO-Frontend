import * as React from 'react';
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
	ListItemInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { SessionListItemComponent } from '../SessionListItemComponent';
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
	children
}: {
	sessions: ListItemInterface[];
	viewerId?: string;
	children: React.ReactNode;
}) {
	const userData = { ...runtimeUserData, userId: viewerId };
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
							topics: [runtimeTopic],
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
	index = 0
}: {
	session: ListItemInterface;
	index?: number;
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
			/>
		</ActiveSessionContext.Provider>
	);
}
