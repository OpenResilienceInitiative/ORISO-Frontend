import * as React from 'react';
import { useMemo, useState } from 'react';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	TopicsContext,
	UserDataContext
} from '../../globalState';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { NavigationBar } from '../app/NavigationBar';
import { RouterConfigConsultant } from '../app/RouterConfig';
import {
	NavigationStoryProviders,
	storybookSettings
} from '../app/navigationStoryHelpers';
import { config } from '../../resources/scripts/config';
import { SessionsListToolbar } from '../sessionsList/SessionsListToolbar';
import type { SessionToolbarChipFilter } from '../sessionsList/sessionToolbarFilters';
import { SessionListItemComponent } from '../sessionsListItem/SessionListItemComponent';
import '../app/authenticatedApp.styles.scss';
import '../app/navigation.styles.scss';
import '../sessionsList/sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';
import '../session/session.styles.scss';

/**
 * Story-only stage for #1499: the consultant's app as it stands around one
 * self-help group — navigation rail, list column with the group's row, and the
 * white chat card on the right. On a phone it is the detail view with the M3
 * bottom navigation bar under it.
 *
 * Everything here is the production SCSS and the production list/nav
 * components; only the data is fixture. So a story that puts a screen into
 * this stage shows the screen the way the app frames it, not floating on a
 * blank canvas.
 */

export const GROUP_STAGE_RULES = [
	'Sprich von dir selbst, nicht über andere.',
	'Was hier geteilt wird, bleibt unter uns.',
	'Jede Nachricht bekommt Raum. Wir antworten mit Respekt und ohne Bewertung.'
];

export const GROUP_STAGE_WELCOME =
	'Hallo und herzlich willkommen! Schön, dass du da bist. Ich öffne den Raum pünktlich für uns alle.';

const GROUP_CONSULTING_TYPE_ID = 7;
export const GROUP_STAGE_CHAT_ID = 9101;
export const GROUP_STAGE_ROOM_ID = 'sb-selfhelp-hiv';

const groupConsultingType = {
	id: GROUP_CONSULTING_TYPE_ID,
	showAskerProfile: false,
	titles: {
		default: 'Gesprächskreis',
		short: 'Gesprächskreis',
		long: 'Gesprächskreis',
		welcome: 'Willkommen',
		registrationDropdown: 'Gesprächskreis'
	},
	isVideoCallAllowed: false,
	isSubsequentRegistrationAllowed: false,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: true,
		autoSelectPostcode: true,
		notes: {}
	},
	groupChat: {
		isGroupChat: true,
		groupChatRules: GROUP_STAGE_RULES
	},
	description: 'Storybook fixture: self-help group (#1499).',
	slug: 'selbsthilfe',
	languageFormal: false,
	welcomeScreen: { anonymous: { title: 'Willkommen', text: '' } }
} as unknown as ConsultingTypeInterface;

const groupTopic: TopicsDataInterface = {
	id: 1,
	name: 'Selbsthilfe',
	slug: 'selbsthilfe',
	description: 'Storybook fixture topic.',
	internalIdentifier: 'selbsthilfe',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Selbsthilfe',
		long: 'Selbsthilfe',
		registrationDropdown: 'Selbsthilfe',
		welcome: 'Selbsthilfe'
	}
};

/** The counsellor who owns the group — may start it ("Chat starten"). */
export const groupStageConsultant = {
	userId: 'consultant-storybook',
	userName: 'beraterin_admin_1_sep21',
	displayName: 'Beraterin_Admin_1 Sep21',
	grantedAuthorities: [
		AUTHORITIES.CONSULTANT_DEFAULT,
		AUTHORITIES.CREATE_NEW_CHAT
	],
	agencies: [],
	appointmentFeatureEnabled: false,
	available: false,
	consultingTypes: {},
	e2eEncryptionEnabled: false,
	emailToggles: [],
	formalLanguage: false,
	hasArchive: true,
	isDisplayNameEditable: true,
	isWalkThroughEnabled: false,
	languages: ['de'],
	preferredLanguage: 'de',
	userRoles: ['CONSULTANT'],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

const pad = (value: number) => String(value).padStart(2, '0');

/** The group's list item, planned `deltaSeconds` from now, not yet started. */
export const buildGroupStageListItem = (
	deltaSeconds: number
): ListItemInterface => {
	const start = new Date(Date.now() + deltaSeconds * 1000);
	return {
		consultant: {
			consultantId: groupStageConsultant.userId,
			id: groupStageConsultant.userId,
			username: groupStageConsultant.userName,
			displayName: groupStageConsultant.displayName,
			absent: false,
			absenceMessage: ''
		},
		language: 'de',
		chat: {
			active: false,
			assignedAgencies: [],
			attachment: null,
			consultingType: GROUP_CONSULTING_TYPE_ID,
			duration: 60,
			matrixRoomId: GROUP_STAGE_ROOM_ID,
			hintMessage: GROUP_STAGE_WELCOME,
			sourceLanguage: 'de',
			hintMessageTranslations: { de: GROUP_STAGE_WELCOME },
			groupChatRulesTranslations: { de: GROUP_STAGE_RULES },
			id: GROUP_STAGE_CHAT_ID,
			lastMessage: null,
			e2eLastMessage: null,
			messageDate: Math.floor(start.getTime() / 1000),
			messagesRead: true,
			moderators: [groupStageConsultant.userId],
			repetitive: false,
			startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
			startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`,
			subscribed: true,
			topic: 'HIV und Aids',
			conversationType: 'SELF_HELP',
			createdAt: '2026-09-21T12:00:00.000Z'
		} as unknown as GroupChatItemInterface
	} as ListItemInterface;
};

// Enough of a Matrix client for the list row, the header and the
// notification-settings store: no rooms, no account data, no events.
const stageMatrixClient = {
	getRoom: () => null,
	getRooms: () => [],
	getUserId: () => null,
	getAccountData: () => undefined,
	setAccountData: async () => ({}),
	on: () => stageMatrixClient,
	removeListener: () => stageMatrixClient,
	off: () => stageMatrixClient
};

const matrixClientService = {
	getClient: () => stageMatrixClient
} as any;

const listTranslations: Record<string, string> = {
	'sessionList.toolbar.search.toggle': 'Suche öffnen oder schließen',
	'sessionList.toolbar.search.placeholder': 'Suche',
	'sessionList.toolbar.search.label': 'Suche',
	'sessionList.toolbar.search.clear': 'Suche löschen',
	'sessionList.toolbar.search.removeSelectedPerson': 'Person entfernen',
	'sessionList.toolbar.chips.unread': 'Ungelesen',
	'sessionList.toolbar.chips.drafts': 'Entwürfe',
	'sessionList.toolbar.chips.nearby': 'Mail',
	'sessionList.toolbar.chips.liveChat': 'Live Chat',
	'sessionList.toolbar.chips.internalGroup': 'Interner Gruppenchat',
	'sessionList.toolbar.chips.supervision': 'Supervision',
	'sessionList.toolbar.chips.groups': 'Gesprächskreis'
};
const translateList = (key: string) => listTranslations[key] || key;

/** All app contexts the list row and the right-hand screens read. */
export const GroupStageProviders = ({
	listItem,
	children
}: {
	listItem: ListItemInterface;
	children: React.ReactNode;
}) => {
	const session = useMemo(
		() => buildExtendedSession(listItem, ''),
		[listItem]
	);
	return (
		<UserDataContext.Provider
			value={{
				userData: groupStageConsultant,
				setUserData: () => {},
				reloadUserData: async () => groupStageConsultant
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
						consultingTypes: [groupConsultingType],
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{
							topics: [groupTopic],
							refreshTopics: () => {}
						}}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions: [listItem],
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
										<MatrixClientContext.Provider
											value={{
												matrixClientService,
												setMatrixClientService: () => {}
											}}
										>
											<LegalLinksContext.Provider
												value={[]}
											>
												<ActiveSessionContext.Provider
													value={{
														activeSession: session,
														reloadActiveSession:
															() => {},
														readActiveSession:
															() => {}
													}}
												>
													{children}
												</ActiveSessionContext.Provider>
											</LegalLinksContext.Provider>
										</MatrixClientContext.Provider>
									</ServerSettingsContext.Provider>
								</ConsultantListContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
};

const StageNavigation = () => {
	const routerConfig = useMemo(
		() => RouterConfigConsultant({ ...config, ...storybookSettings }),
		[]
	);
	return (
		<NavigationStoryProviders role="consultant">
			<NavigationBar routerConfig={routerConfig} onLogout={() => {}} />
		</NavigationStoryProviders>
	);
};

const StageList = () => {
	const [search, setSearch] = useState('');
	const [people, setPeople] = useState<string[]>([]);
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>(null);
	return (
		<aside className="groupStage__list" aria-label="Gespräche">
			<div className="sessionsList__innerWrapper">
				<SessionsListToolbar
					translate={translateList}
					searchValue={search}
					onSearchChange={setSearch}
					searchPeopleResults={[]}
					selectedPersonIds={people}
					onSelectedPersonIdsChange={setPeople}
					activeChip={chip}
					onChipToggle={(next) =>
						setChip((previous) => (previous === next ? null : next))
					}
					showConsultantActions
					showCreateGroupChatAction
					showSupervisionChip={false}
					createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
					archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
					archiveTabActive={false}
					createGroupChatActive={false}
					chipCounts={{ groups: 1 }}
				/>
				<div className="sessionsList__scrollArea">
					<div className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar">
						<SessionListItemComponent
							defaultLanguage="de"
							handleKeyDownLisItemContent={() => {}}
							index={0}
						/>
					</div>
				</div>
			</div>
		</aside>
	);
};

const stageCss = `
	.groupStage.app__wrapper {
		height: 100vh;
		background: var(--m3-surface-container);
	}
	.groupStage--desktop.app__wrapper {
		display: grid;
		grid-template-columns: 85px 400px minmax(0, 1fr);
	}
	.groupStage__rail {
		grid-column: 1;
		grid-row: 1;
		min-height: 0;
		display: flex;
	}
	.groupStage--desktop .groupStage__list {
		grid-column: 2;
		grid-row: 1;
	}
	.groupStage--desktop .groupStage__detail {
		grid-column: 3;
		grid-row: 1;
	}
	.groupStage--desktop .navigation__wrapper {
		width: 85px;
		height: 100%;
	}
	.groupStage__list {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}
	.groupStage__list .sessionsList__scrollArea {
		flex: 1;
		min-height: 0;
	}
	.groupStage__detail {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.groupStage--mobile.app__wrapper {
		display: flex;
		flex-direction: column;
	}
	.groupStage--mobile .groupStage__detail {
		flex: 1;
	}
	.groupStage__bottomNav {
		flex: 0 0 auto;
		display: flex;
	}
	.groupStage--mobile .navigation__wrapper {
		width: 100%;
	}
`;

/**
 * The stage. `layout="desktop"` needs a viewport of at least 900 px (the
 * app's `$fromLarge`), `layout="mobile"` one below it — the production SCSS
 * decides by the real viewport width, so the story sets the viewport too.
 */
export const GroupChatStage = ({
	listItem,
	layout,
	children
}: {
	listItem: ListItemInterface;
	layout: 'desktop' | 'mobile';
	children: React.ReactNode;
}) => (
	<GroupStageProviders listItem={listItem}>
		<div className={`app__wrapper groupStage groupStage--${layout}`}>
			<style>{stageCss}</style>
			{layout === 'desktop' && (
				<div className="groupStage__rail">
					<StageNavigation />
				</div>
			)}
			{layout === 'desktop' && <StageList />}
			<div className="groupStage__detail">{children}</div>
			{layout === 'mobile' && (
				<div className="groupStage__bottomNav">
					<StageNavigation />
				</div>
			)}
		</div>
	</GroupStageProviders>
);
