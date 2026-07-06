import * as React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as BellOffIcon } from '../../resources/img/icons/bell-off.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as PackageIcon } from '../../resources/img/icons/documents.svg';
import nearbyConversationIcon from '../../resources/img/icons/chatroom/nearby_conv_type_200.svg';
import teamImage from '../../resources/img/illustrations/Team.svg';
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
} from '../../globalState';
import type {
	ConsultingTypeInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { RocketChatSubscriptionsContext } from '../../globalState/provider/RocketChatSubscriptionsProvider';
import { RocketChatUsersOfRoomContext } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { SessionListItemComponent } from './SessionListItemComponent';
import './sessionsListItem.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const listShell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	maxWidth: 440,
	margin: '0 auto',
	padding: '4px 8px'
};

const runtimeTopic: TopicsDataInterface = {
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

const runtimeConsultingType: ConsultingTypeInterface = {
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

const runtimeSession: ListItemInterface = {
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
		askerRcId: 'asker-4401',
		attachment: null,
		consultingType: 1,
		groupId: 'storybook-runtime-room-4401',
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

const runtimeUserData = {
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

function MockAvatar({ letter, bg }: { letter: string; bg: string }) {
	return (
		<div className="sessionsListItem__icon">
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: '50%',
					background: bg,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontWeight: 600,
					fontSize: 14,
					color: '#333'
				}}
			>
				{letter}
			</div>
		</div>
	);
}

function DropdownOptionMock({
	Icon,
	title,
	description,
	shortcut,
	disabled = false
}: {
	Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	title: string;
	description: string;
	shortcut: string;
	disabled?: boolean;
}) {
	return (
		<button
			className={[
				'sessionsListItem__dropdownOption',
				disabled && 'sessionsListItem__dropdownOption--disabled'
			]
				.filter(Boolean)
				.join(' ')}
			type="button"
			disabled={disabled}
		>
			<Icon
				className={[
					'sessionsListItem__dropdownOptionIcon',
					disabled && 'sessionsListItem__dropdownOptionIcon--disabled'
				]
					.filter(Boolean)
					.join(' ')}
			/>
			<div className="sessionsListItem__dropdownOptionCenter">
				<div className="sessionsListItem__dropdownOptionTitleRow">
					<span
						className={[
							'sessionsListItem__dropdownOptionTitle',
							disabled &&
								'sessionsListItem__dropdownOptionTitle--disabled'
						]
							.filter(Boolean)
							.join(' ')}
					>
						{title}
					</span>
					<kbd className="sessionsListItem__dropdownOptionShortcut">
						{shortcut}
					</kbd>
				</div>
				<p
					className={[
						'sessionsListItem__dropdownOptionDescription',
						disabled &&
							'sessionsListItem__dropdownOptionDescription--disabled'
					]
						.filter(Boolean)
						.join(' ')}
				>
					{description}
				</p>
			</div>
		</button>
	);
}

function SessionMenuMock({ onClose }: { onClose: () => void }) {
	const menuRef = React.useRef<HTMLDivElement>(null);

	useEffect(() => {
		const animationFrame = window.requestAnimationFrame(() => {
			const firstFocusable = menuRef.current?.querySelector<
				HTMLButtonElement | HTMLAnchorElement
			>(
				'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
			);
			firstFocusable?.focus();
		});

		return () => window.cancelAnimationFrame(animationFrame);
	}, []);

	return (
		<div
			id="storybook-session-menu"
			ref={menuRef}
			className="sessionsListItem__dropdown"
			style={{ top: 88, right: 12 }}
			onKeyDown={(event) => {
				if (event.key === 'Tab') {
					event.preventDefault();
					event.stopPropagation();
					onClose();
					document
						.querySelector<HTMLButtonElement>(
							'.sessionsListItem__menuIcon'
						)
						?.focus();
				}

				if (event.key === 'Escape') {
					event.stopPropagation();
					onClose();
					document
						.querySelector<HTMLButtonElement>(
							'.sessionsListItem__menuIcon'
						)
						?.focus();
				}
			}}
			role="dialog"
			aria-label="Chatraum Einstellungen"
			data-testid="session-menu"
		>
			<div className="sessionsListItem__dropdownHeader">
				<p className="sessionsListItem__dropdownSubtitle">
					Jeder Raum individuell anpassbar
				</p>
				<h1 className="sessionsListItem__dropdownTitle">
					Chatraum Einstellungen
				</h1>
			</div>
			<div className="sessionsListItem__dropdownDivider" />
			<div className="sessionsListItem__dropdownContent">
				<DropdownOptionMock
					Icon={ArchiveIcon}
					title="Archiviere Chat"
					description="Archivierte Benachrichtigungen sind inaktiv. Der Chat wird in 12 Monaten gelöscht."
					shortcut="⇧A"
				/>
				<DropdownOptionMock
					Icon={BellOffIcon}
					title="Benachrichtigungen"
					description="Konfiguriere Sie für diesen Chat individuell."
					shortcut="⇧Ö"
				/>
				<DropdownOptionMock
					Icon={HelpIcon}
					title="Supervision anfragen"
					description="Fragen Sie individuell Hilfe nach für Fälle."
					shortcut="⇧Ä"
					disabled
				/>
			</div>
			<div className="sessionsListItem__dropdownDivider" />
			<div className="sessionsListItem__dropdownContent">
				<DropdownOptionMock
					Icon={PlusIcon}
					title="Personen hinzufügen"
					description="Fügen Sie ein oder mehrere Personen hinzu."
					shortcut="⇧I"
				/>
				<DropdownOptionMock
					Icon={PackageIcon}
					title="Chatanfrage teilen"
					description="Spare Zeit, mit Hilfe unseres Datenschutzkonformen Workflows."
					shortcut="⇧Ü"
				/>
			</div>
		</div>
	);
}

/** Mirrors registered Nähe row layout (topic + PLZ, menu pill, Nähe meta). */
function ConsultantCardMock({
	active = false,
	beforeActive = false,
	afterActive = false,
	menuOpen = false,
	onMenuToggle,
	onCardKeyboardNavigate,
	topic = 'Familienberatung',
	postcode = '12345',
	user = 'testuser@example.invalid',
	subject = 'So geht es weiter'
}: {
	active?: boolean;
	beforeActive?: boolean;
	afterActive?: boolean;
	menuOpen?: boolean;
	onMenuToggle?: () => void;
	onCardKeyboardNavigate?: () => void;
	topic?: string;
	postcode?: string;
	user?: string;
	subject?: string;
}) {
	return (
		<div
			className={[
				'sessionsListItem',
				active && 'sessionsListItem--active',
				menuOpen && 'sessionsListItem--menuOpen',
				beforeActive && 'sessionsListItem--beforeActive',
				afterActive && 'sessionsListItem--afterActive'
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div
				className="sessionsListItem__content"
				role="tab"
				tabIndex={0}
				aria-selected={active}
				data-testid="session-card-content"
				onKeyDown={(event) => {
					const target = event.target as HTMLElement;
					if (
						target.closest(
							'.sessionsListItem__menuIcon, .sessionsListItem__dropdown'
						)
					) {
						return;
					}

					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onCardKeyboardNavigate?.();
					}
				}}
			>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topicPostcodeGroup">
							<div className="sessionsListItem__topic">
								{topic}
							</div>
							<div className="sessionsListItem__postcode">
								{postcode}
							</div>
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">18.3.2026</div>
						<button
							type="button"
							className="sessionsListItem__menuIcon"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onMenuToggle?.();
							}}
							onKeyDown={(e) => {
								e.stopPropagation();
								if (e.key === 'Escape' && menuOpen) {
									onMenuToggle?.();
								}
							}}
							aria-label="Chatraum Einstellungen"
							aria-haspopup="dialog"
							aria-expanded={menuOpen}
							aria-controls={
								menuOpen ? 'storybook-session-menu' : undefined
							}
						>
							<MenuVerticalIcon />
						</button>
						{menuOpen
							? createPortal(
									<SessionMenuMock
										onClose={() => onMenuToggle?.()}
									/>,
									document.body
								)
							: null}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<MockAvatar letter="S" bg="#e8b4f0" />
					<div className="sessionsListItem__username">{user}</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject sessionsListItem__subject--aliasMessage">
						<em>{subject}</em>
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
						<img
							src={nearbyConversationIcon}
							alt="Nähe"
							className="sessionsListItem__consultingTypeIcon--nearbyIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
							Nähe
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function InteractiveMenuPlayground() {
	const [menuOpen, setMenuOpen] = useState(true);
	const [navigationCount, setNavigationCount] = useState(0);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (
				!target.closest('.sessionsListItem__menuIcon') &&
				!target.closest('.sessionsListItem__dropdown')
			) {
				setMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	useEffect(() => {
		const handleMenuDocumentKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setMenuOpen(false);
			}

			if (
				event.key === 'Tab' &&
				event.target instanceof Node &&
				document
					.querySelector('.sessionsListItem__dropdown')
					?.contains(event.target)
			) {
				event.preventDefault();
				setMenuOpen(false);
				document
					.querySelector<HTMLButtonElement>(
						'.sessionsListItem__menuIcon'
					)
					?.focus();
			}
		};

		document.addEventListener('keydown', handleMenuDocumentKeyDown);
		return () => {
			document.removeEventListener('keydown', handleMenuDocumentKeyDown);
		};
	}, []);

	return (
		<div style={{ ...listShell, minHeight: 420, position: 'relative' }}>
			<div
				data-testid="keyboard-navigation-count"
				style={{
					position: 'absolute',
					left: -9999,
					width: 1,
					height: 1,
					overflow: 'hidden'
				}}
			>
				{navigationCount}
			</div>
			<ConsultantCardMock
				menuOpen={menuOpen}
				onMenuToggle={() => setMenuOpen((open) => !open)}
				onCardKeyboardNavigate={() =>
					setNavigationCount((count) => count + 1)
				}
				topic="Familienberatung mit sehr langem Themenlabel"
				postcode="12345"
				user="ruhiges Yak Kim"
				subject="Anfrage Gesendet"
			/>
			<ConsultantCardMock
				afterActive
				topic="Sucht"
				postcode="99322"
				user="Ludwig Bonn..."
				subject="Hubi, schau dir das mal an!"
			/>
		</div>
	);
}

/** Group-style top row (topic chip only) + team meta. */
function GroupCardMock({
	active = false,
	beforeActive = false,
	afterActive = false
}: {
	active?: boolean;
	beforeActive?: boolean;
	afterActive?: boolean;
}) {
	return (
		<div
			className={[
				'sessionsListItem',
				active && 'sessionsListItem--active',
				beforeActive && 'sessionsListItem--beforeActive',
				afterActive && 'sessionsListItem--afterActive'
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topic">
							kein Thema gewählt
						</div>
						<div className="sessionsListItem__consultingType" />
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">17.3.2026</div>
						<button
							type="button"
							className="sessionsListItem__menuIcon"
							aria-label="Chatraum Einstellungen"
						>
							<MenuVerticalIcon />
						</button>
					</div>
				</div>
				<div className="sessionsListItem__row">
					<MockAvatar letter="N" bg="#c8e6c9" />
					<div className="sessionsListItem__username">
						New Redeploy
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Sie haben den Chat erstellt.
					</div>
					<div className="sessionsListItem__consultingTypeIcon">
						<img
							src={teamImage}
							alt=""
							className="sessionsListItem__consultingTypeIcon--team"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Postcode only (no topic) — standalone PLZ pill. */
function PostcodeOnlyCardMock() {
	return (
		<div className="sessionsListItem">
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__consultingType">
							<div className="sessionsListItem__postcode sessionsListItem__postcode--standalone">
								99322
							</div>
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">1.4.2026</div>
						<button
							type="button"
							className="sessionsListItem__menuIcon"
							aria-label="Chatraum Einstellungen"
						>
							<MenuVerticalIcon />
						</button>
					</div>
				</div>
				<div className="sessionsListItem__row">
					<MockAvatar letter="O" bg="#90caf9" />
					<div className="sessionsListItem__username">
						user@example.org
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Letzte Nachricht …
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
						<img
							src={nearbyConversationIcon}
							alt="Nähe"
							className="sessionsListItem__consultingTypeIcon--nearbyIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
							Nähe
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function RuntimeSessionListItem() {
	const activeSession = buildExtendedSession(runtimeSession, '');

	return (
		<div style={listShell}>
			<UserDataContext.Provider
				value={{
					userData: runtimeUserData,
					reloadUserData: async () => runtimeUserData,
					loaded: true
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
									sessions: [runtimeSession],
									dispatch: () => {}
								}}
							>
								<RocketChatSubscriptionsContext.Provider
									value={{
										subscriptionsReady: true,
										subscriptions: [],
										roomsReady: true,
										rooms: []
									}}
								>
									<RocketChatUsersOfRoomContext.Provider
										value={{
											ready: true,
											users: [],
											moderators: [],
											total: 0,
											reload: async () => []
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
											<LegalLinksContext.Provider
												value={[]}
											>
												<ActiveSessionContext.Provider
													value={{
														activeSession,
														reloadActiveSession:
															() => {},
														readActiveSession:
															() => {}
													}}
												>
													<SessionListItemComponent
														defaultLanguage="de"
														handleKeyDownLisItemContent={() => {}}
														index={0}
													/>
												</ActiveSessionContext.Provider>
											</LegalLinksContext.Provider>
										</E2EEContext.Provider>
									</RocketChatUsersOfRoomContext.Provider>
								</RocketChatSubscriptionsContext.Provider>
							</SessionsDataContext.Provider>
						</TopicsContext.Provider>
					</ConsultingTypesContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</div>
	);
}

const meta = {
	title: 'Components/Session/List/SessionListItem',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		router: {
			initialPath: '/sessions/consultant/sessionView/session/4401'
		},
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Runtime story plus visual reference states for session list rows. `RuntimeComponent` renders the real `SessionListItemComponent` with Storybook fixture providers; the other stories document edge-state layout using the same BEM classes.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RuntimeComponent: Story = {
	render: () => <RuntimeSessionListItem />
};

export const ConsultantUnselected: Story = {
	render: () => (
		<div style={listShell}>
			<ConsultantCardMock />
		</div>
	)
};

export const ConsultantSelected: Story = {
	render: () => (
		<div style={listShell}>
			<ConsultantCardMock active />
		</div>
	)
};

/** Middle card selected with stacked neighbours (no extra gap). */
export const StackedListWithSelection: Story = {
	render: () => (
		<div style={listShell}>
			<GroupCardMock beforeActive />
			<ConsultantCardMock active />
			<GroupCardMock afterActive />
		</div>
	)
};

export const GroupChatRow: Story = {
	render: () => (
		<div style={listShell}>
			<GroupCardMock />
		</div>
	)
};

export const PostcodeOnly: Story = {
	render: () => (
		<div style={listShell}>
			<PostcodeOnlyCardMock />
		</div>
	)
};

export const InteractiveMenuAndLongContent: Story = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1'
		}
	},
	render: () => <InteractiveMenuPlayground />
};
