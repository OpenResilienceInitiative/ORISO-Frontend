import * as React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { MenuVerticalIcon } from '../../resources/img/icons';
import mailConversationIcon from '../../resources/img/icons/chatroom/mail_conv_type_200.svg';
import { ReactComponent as ThreadGlyphIcon } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as AudioOnIcon } from '../../resources/img/icons/audio-on.svg';
import { MessageAvatar } from '../message/MessageAvatar';
import { formatMessagePersonName } from '../message/messageNameUtils';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as BellOffIcon } from '../../resources/img/icons/bell-off.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as PackageIcon } from '../../resources/img/icons/documents.svg';
import nearbyConversationIcon from '../../resources/img/icons/chatroom/nearby_conv_type_200.svg';
import internalConversationIcon from '../../resources/img/icons/chatroom/internal_conversation_200.svg';
import selfHelpIcon from '../../resources/img/icons/session-toolbar/supervision_chats.svg';
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
					description="Bei archivierten Chats sind Benachrichtigungen inaktiv. Der Chat wird in 12 Monaten gelöscht."
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

/** Mirrors registered Mail row layout (topic + PLZ, menu pill, Mail meta). */
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
					<div className="sessionsListItem__icon">
						<MessageAvatar
							isGroup={false}
							isSystemNotification={false}
							userId={user}
							username={user}
							displayName={formatMessagePersonName(
								undefined,
								user
							)}
							size={32}
						/>
					</div>
					<div className="sessionsListItem__username">
						{formatMessagePersonName(undefined, user)}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject sessionsListItem__subject--aliasMessage">
						<em>{subject}</em>
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
						<img
							src={nearbyConversationIcon}
							alt="Mail"
							className="sessionsListItem__consultingTypeIcon--nearbyIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
							Mail
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
							alt="Mail"
							className="sessionsListItem__consultingTypeIcon--nearbyIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
							Mail
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function RuntimeSessionListItem({
	lastMessage = runtimeSession.session.lastMessage,
	sessionOverrides = {},
	consultantId = runtimeSession.consultant.id,
	viewerId = runtimeUserData.userId,
	asSearchingAsker = false
}: {
	lastMessage?: string;
	/** Extra `session` DTO fields, e.g. the ADR-008 `supervision` marker. */
	sessionOverrides?: Partial<ListItemInterface['session']>;
	/** Owning consultant of the row (defaults to the viewer = own session). */
	consultantId?: string;
	/** Logged-in consultant. */
	viewerId?: string;
	/**
	 * FE#1115 — the advice seeker's own row while nobody has accepted:
	 * no consultant on the session, so the avatar slot holds the magnet.
	 */
	asSearchingAsker?: boolean;
} = {}) {
	const storySession: ListItemInterface = {
		...runtimeSession,
		consultant: asSearchingAsker
			? undefined
			: {
					...runtimeSession.consultant,
					consultantId,
					id: consultantId
				},
		session: {
			...runtimeSession.session,
			lastMessage,
			...sessionOverrides
		}
	};
	const activeSession = buildExtendedSession(storySession, '');
	const userData = asSearchingAsker
		? {
				...runtimeUserData,
				userId: 'asker-4401',
				grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
				userRoles: ['USER']
			}
		: { ...runtimeUserData, userId: viewerId };

	return (
		<div style={listShell}>
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
									sessions: [storySession],
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
												index={0}
											/>
										</ActiveSessionContext.Provider>
									</LegalLinksContext.Provider>
								</E2EEContext.Provider>
							</SessionsDataContext.Provider>
						</TopicsContext.Provider>
					</ConsultingTypesContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</div>
	);
}

/** Overlapping initials circles for group rows (Interna / Gesprächskreis). */
function StackedAvatarsMock({ initials }: { initials: string[] }) {
	const palette = ['#c8e6c9', '#bbdefb', '#e8b4f0'];
	const visible = initials.slice(0, 2);
	const overflow = initials.length - visible.length;

	return (
		<div className="sessionsListItem__stackedAvatars">
			{visible.map((label, index) => (
				<div key={index} className="sessionsListItem__avatarWrapper">
					<div
						style={{
							width: 32,
							height: 32,
							borderRadius: '50%',
							background: palette[index % palette.length],
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontWeight: 600,
							fontSize: 12,
							color: '#333'
						}}
					>
						{label}
					</div>
				</div>
			))}
			{overflow > 0 ? (
				<div className="sessionsListItem__avatarWrapper sessionsListItem__avatarWrapper--plus">
					<div className="sessionsListItem__plusAvatar">
						+{overflow}
					</div>
				</div>
			) : null}
		</div>
	);
}

/**
 * Internal counsellor group chat (Figma 98-20465).
 * Stacked initials avatars + group name + sender-prefixed preview, the
 * consulting-type tag "Interna", and the "Interna" chat-type icon on the right.
 */
function InternalCounsellorCardMock() {
	return (
		<div className="sessionsListItem sessionsListItem--groupChat">
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topic">Interna</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">now</div>
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
					<StackedAvatarsMock initials={['MK', 'AB', 'CD']} />
					<div className="sessionsListItem__username">
						Anfragenkoordinierung
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Mario K: Das ist schon komisch mit di…
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--internal">
						<img
							src={internalConversationIcon}
							alt="Interna"
							className="sessionsListItem__consultingTypeIcon--internalIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--internalLabel">
							Interna
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Anonymous live chat (Figma 287-23471).
 * Animal pseudonym as the display name, no postcode pill, and the "Live Chat"
 * chat-type icon + label on the right.
 */
function LiveChatCardMock() {
	return (
		<div className="sessionsListItem sessionsListItem--anonymous">
			<div className="sessionsListItem__content sessionsListItem__content--anonymous">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topic">
							Familienberatung
						</div>
						<div className="sessionsListItem__consultingType" />
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">now</div>
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
					<MockAvatar letter="Y" bg="#ffe0b2" />
					<div className="sessionsListItem__username">
						ruhiges Yak Kim
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Das soll aber einzigartig
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--liveChat">
						<svg
							width="22"
							height="19"
							viewBox="0 0 22 19"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								d="M0 18V6L8 0L14.95 5.19175C14.55 5.20842 14.1639 5.25008 13.7917 5.31675C13.4194 5.38342 13.0527 5.47783 12.6917 5.6L8 2.08325L1.66675 6.83325V16.3333H8.11675C8.25558 16.6444 8.41525 16.9361 8.59575 17.2083C8.77642 17.4806 8.97225 17.7445 9.18325 18H0ZM10.8333 17.5833C10.2056 16.9832 9.71533 16.2847 9.3625 15.4875C9.00967 14.6903 8.83325 13.8612 8.83325 13C8.83325 11.2278 9.44992 9.72925 10.6832 8.50425C11.9166 7.27925 13.4111 6.66675 15.1667 6.66675C16.9389 6.66675 18.4375 7.27925 19.6625 8.50425C20.8875 9.72925 21.5 11.2278 21.5 13C21.5 13.8612 21.3306 14.6876 20.9918 15.4792C20.6528 16.2709 20.1638 16.9639 19.525 17.5583L18.7 16.7332C19.2388 16.2499 19.6458 15.6861 19.9207 15.0418C20.1957 14.3973 20.3333 13.7167 20.3333 13C20.3333 11.5555 19.8333 10.3332 18.8333 9.33325C17.8333 8.33325 16.6111 7.83325 15.1667 7.83325C13.7389 7.83325 12.5208 8.33325 11.5125 9.33325C10.5042 10.3332 10 11.5555 10 13C10 13.7167 10.1431 14.3986 10.4292 15.0457C10.7153 15.6931 11.1249 16.2584 11.6582 16.7417L10.8333 17.5833ZM12.6083 15.7917C12.2083 15.4306 11.8958 15.0083 11.6708 14.525C11.4458 14.0417 11.3333 13.5333 11.3333 13C11.3333 11.9278 11.7083 11.0209 12.4583 10.2793C13.2083 9.53758 14.1111 9.16675 15.1667 9.16675C16.2389 9.16675 17.1458 9.53758 17.8875 10.2793C18.6292 11.0209 19 11.9278 19 13C19 13.5278 18.8958 14.0362 18.6875 14.525C18.4792 15.0138 18.1722 15.4388 17.7667 15.8L16.925 14.9832C17.2138 14.7277 17.4374 14.4277 17.5958 14.0832C17.7541 13.7389 17.8333 13.3778 17.8333 13C17.8333 12.2555 17.5749 11.6249 17.0583 11.1082C16.5416 10.5916 15.9111 10.3333 15.1667 10.3333C14.4334 10.3333 13.8056 10.5916 13.2833 11.1082C12.7611 11.6249 12.5 12.2555 12.5 13C12.5 13.3778 12.5833 13.7362 12.75 14.075C12.9167 14.4138 13.1389 14.7111 13.4167 14.9668L12.6083 15.7917ZM14.5833 19V13.9168C14.4332 13.8056 14.3124 13.6708 14.2208 13.5125C14.1291 13.3542 14.0833 13.1833 14.0833 13C14.0833 12.6945 14.1888 12.4376 14.4 12.2292C14.6112 12.0209 14.8667 11.9167 15.1667 11.9167C15.4722 11.9167 15.7292 12.0209 15.9375 12.2292C16.1458 12.4376 16.25 12.6945 16.25 13C16.25 13.1833 16.2097 13.3556 16.1292 13.5168C16.0486 13.6778 15.9222 13.8111 15.75 13.9168V19H14.5833Z"
								fill="#4B515A"
							/>
						</svg>
						<span className="sessionsListItem__consultingTypeIcon--liveChatLabel">
							Live Chat
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Guided self-help group / Gesprächskreis (Figma 115-28318).
 * Stacked initials avatars + group name, the consulting-type tag
 * "Gesprächskreis", and the "Gesprächskreis" chat-type icon on the right.
 */
function SelfHelpCardMock() {
	return (
		<div className="sessionsListItem sessionsListItem--groupChat">
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topic">
							Gesprächskreis
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">now</div>
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
					<StackedAvatarsMock initials={['MO', 'JS', 'GF', 'LK']} />
					<div className="sessionsListItem__username">
						Montagsrunde
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Das soll aber einzigartig
					</div>
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--selfHelp">
						<img
							src={selfHelpIcon}
							alt="Gesprächskreis"
							className="sessionsListItem__consultingTypeIcon--selfHelpIcon"
						/>
						<span className="sessionsListItem__consultingTypeIcon--selfHelpLabel">
							Gesprächskreis
						</span>
					</div>
				</div>
			</div>
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
					'Runtime story plus visual reference states for session list rows. ' +
					'#597: `ConsultantSelected` shows `2px solid var(--m3-primary)`; ' +
					'`ConsultantMenuOpen` shows vertical 32×48 menu trigger + active menu borders. ' +
					'`RuntimeComponent` mounts the real `SessionListItemComponent` with fixture providers.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Unread axis (#1147): read state is derived from the Matrix room, not from
 * the DTO's hard-coded `messagesRead`. Seed the registry so the runtime
 * stories pin both visual states.
 */
const seedMatrixRoom = (unreadCount: number) => {
	setMatrixClientServiceRef({
		getClient: () => null,
		getRoom: () => ({
			getUnreadNotificationCount: () => unreadCount
		})
	} as any);
};

export const RuntimeComponent: Story = {
	render: () => {
		seedMatrixRoom(2);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const username = canvasElement.querySelector(
				'.sessionsListItem__username'
			);
			expect(username).not.toBeNull();
			expect(
				username!.classList.contains(
					'sessionsListItem__username--readLabel'
				)
			).toBe(false);
		});
	}
};

/**
 * Regression for #1225 / follow-up to #834: the session-list surface must use
 * the same transport-to-plain-text conversion as the Threads list.
 */
export const RuntimeRichTextPreview: Story = {
	name: 'Rich text preview → readable text (#1225)',
	render: () => {
		seedMatrixRoom(2);
		return (
			<RuntimeSessionListItem lastMessage="[[align:left]]<p>Wir haben die Zwei-Minuten-Runde ausprobiert.</p>[[/align]]" />
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const preview = canvasElement.querySelector(
				'.sessionsListItem__subject'
			);
			expect(preview?.textContent).toBe(
				'Wir haben die Zwei-Minuten-Runde ausprobiert.'
			);
			expect(preview?.textContent).not.toMatch(/\[\[align:|<p>/i);
		});
	}
};

/**
 * Same runtime fixture with a fully read Matrix room and an inactive route:
 * the row must carry the read styling. Under the removed DTO-based logic
 * (`messagesRead` hard-coded true/false) this state was unreachable.
 */
export const RuntimeComponentRead: Story = {
	parameters: {
		router: {
			initialPath: '/sessions/consultant/sessionView'
		}
	},
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const row = canvasElement.querySelector('.sessionsListItem');
			expect(row).not.toBeNull();
			expect(row!.classList.contains('sessionsListItem--read')).toBe(
				true
			);
			expect(
				canvasElement
					.querySelector('.sessionsListItem__username')
					?.classList.contains(
						'sessionsListItem__username--readLabel'
					)
			).toBe(true);
		});
	}
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

/** #597: menu open → vertical 32×48 trigger + 2px primary-container borders. */
export const ConsultantMenuOpen: Story = {
	render: () => (
		<div style={listShell}>
			<ConsultantCardMock active menuOpen />
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

/* ------------------------------------------------------------------ *
 * Figma-node stories (self-contained visual mocks)
 * ------------------------------------------------------------------ */

/**
 * Internal counsellor chat (Figma 98-20465).
 * Stacked avatars + group name + sender-prefixed preview, consulting-type tag
 * "Interna", and no chat-type icon on the right.
 */
export const InternalCounsellorChat: Story = {
	render: () => (
		<div style={listShell}>
			<InternalCounsellorCardMock />
		</div>
	)
};

// ZipTopicSelection (Mail, Figma 98-20505) is intentionally NOT a separate
// story: its layout (topic tag + postcode pill + "Mail" chat-type icon) is
// already covered by `ConsultantUnselected` (ConsultantCardMock). Adding it
// again would just duplicate that story, so it is skipped per the refactor.

/**
 * Anonymous live chat (Figma 287-23471).
 * Animal pseudonym as the display name, no postcode, "Live Chat" chat-type
 * icon + label.
 */
export const LiveChat: Story = {
	render: () => (
		<div style={listShell}>
			<LiveChatCardMock />
		</div>
	)
};

/**
 * Guided self-help group / Gesprächskreis (Figma 115-28318).
 * Stacked avatars + group name, consulting-type tag "Gesprächskreis", and no
 * chat-type icon on the right (Kreis icon not yet implemented — see mock TODO).
 */
export const GuidedSelfHelpGroup: Story = {
	render: () => (
		<div style={listShell}>
			<SelfHelpCardMock />
		</div>
	)
};

/* ------------------------------------------------------------------
 * ADR-008 supervision list marker (`session.supervision`, UserService WP-A)
 * ------------------------------------------------------------------ */

const SUPERVISOR_ID = 'consultant-supervisor';

/**
 * The logged-in consultant is the assigned supervisor of a colleague's
 * session: the row shows the "Supervision" badge instead of the red
 * silent-member eye, and no "request access" (case handover) button.
 */
export const SupervisedByMe: Story = {
	name: 'Supervision — supervised by me (ADR-008)',
	render: () => {
		seedMatrixRoom(0);
		return (
			<RuntimeSessionListItem
				consultantId="consultant-owner"
				viewerId={SUPERVISOR_ID}
				sessionOverrides={{
					supervision: {
						supervisedByMe: true,
						supervisorConsultantIds: [SUPERVISOR_ID],
						supervisorDisplayNames: ['Sabine Supervisor']
					}
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const badge = canvasElement.querySelector(
				'[data-testid="supervision-badge"]'
			);
			expect(badge).not.toBeNull();
			expect(badge!.getAttribute('title')).toContain('Supervision');
			// T9: the list badge uses `supervision_circ` inline (currentColor),
			// the same glyph as the panel header and the FAB.
			expect(
				badge!.querySelector('svg path[fill="currentColor"]')
			).not.toBeNull();
			expect(
				canvasElement.querySelector(
					'.sessionsListItem__handoverActionPrimary'
				)
			).toBeNull();
		});
	}
};

/**
 * The owning consultant's view of the same session: their own row carries a
 * small "Supervision: <name>" indicator so they know who reads along.
 */
export const SupervisedByOthers: Story = {
	name: 'Supervision — supervised by a colleague (owner view)',
	render: () => {
		seedMatrixRoom(0);
		return (
			<RuntimeSessionListItem
				sessionOverrides={{
					supervision: {
						supervisedByMe: false,
						supervisorConsultantIds: [SUPERVISOR_ID],
						supervisorDisplayNames: ['Sabine Supervisor']
					}
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const indicator = canvasElement.querySelector(
				'[data-testid="supervision-indicator"]'
			);
			expect(indicator).not.toBeNull();
			expect(indicator!.textContent).toContain('Sabine Supervisor');
			expect(
				indicator!.querySelector('svg path[fill="currentColor"]')
			).not.toBeNull();
			expect(
				canvasElement.querySelector('[data-testid="supervision-badge"]')
			).toBeNull();
		});
	}
};

/* ------------------------------------------------------------------ *
 * The chat-room menu — Figma 7086-57413
 * ------------------------------------------------------------------ */

/**
 * Frank, 15.09.2026: "Es soll kein Overlap da sein, sondern ein
 * Nebeneinander. Wer hat gesagt, dass ein Menü immer oben drüber oder unten
 * drunter öffnen muss?"
 *
 * The menu is measured against the **card**, not against the three-dot
 * trigger inside it — anchored to the button, "beside" still lands on the
 * card. Beside is the normal case; below and above are the escape routes
 * for a viewport that has no room beside, which is every phone.
 */
const openTheMenu = async (canvasElement: HTMLElement) => {
	const trigger = await waitFor(() => {
		const element = canvasElement.querySelector<HTMLButtonElement>(
			'.sessionsListItem__menuIcon'
		);
		expect(element).toBeTruthy();
		return element!;
	});
	await userEvent.click(trigger);
	const menu = await waitFor(() => {
		const element = document.querySelector<HTMLElement>(
			'.sessionsListItem__dropdown'
		);
		expect(element).toBeTruthy();
		expect(element!.getBoundingClientRect().width).toBeGreaterThan(0);
		return element!;
	});
	const card = canvasElement.querySelector<HTMLElement>(
		'.sessionsListItem__content'
	)!;
	return { trigger, menu, card };
};

/** The card's shadow with nothing focused — its resting design, not a ring. */
const restingCardShadow = (canvasElement: HTMLElement) =>
	getComputedStyle(
		canvasElement.querySelector<HTMLElement>('.sessionsListItem__content')!
	).boxShadow;

const expectNoOverlap = async (menu: HTMLElement, card: HTMLElement) => {
	const m = menu.getBoundingClientRect();
	const c = card.getBoundingClientRect();
	const apart =
		m.right <= c.left + 0.5 ||
		m.left >= c.right - 0.5 ||
		m.bottom <= c.top + 0.5 ||
		m.top >= c.bottom - 0.5;
	await expect(apart).toBe(true);
};

/**
 * Desktop: the menu stands beside the card and the card stays readable.
 * Also the point where the single focus ring is checked — the trigger is
 * what the user just operated, so the card must not draw a second ring.
 */
export const MenuBesideTheCard: Story = {
	name: 'Menü — daneben statt darüber (Figma 7086-57413)',
	globals: { viewport: { value: 'desktop1440' } },
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const atRest = restingCardShadow(canvasElement);
		const { trigger, menu, card } = await openTheMenu(canvasElement);

		// 1. No overlap. This is the whole point.
		await expectNoOverlap(menu, card);
		await expect(menu.dataset.placement).toBe('right');
		// Every coordinate is a real number. `{ ...domRect }` yields an
		// empty object — the properties are on the prototype — which turned
		// every coordinate into NaN and placed the menu at the viewport
		// edge. Unit tests pass plain objects and cannot see this.
		await expect(menu.style.left).toMatch(/^\d/);
		await expect(menu.style.top).toMatch(/^\d/);

		// 2. The trigger carries the primary role while its menu is open,
		//    and its dots the on-primary-container role.
		await expect(
			trigger.classList.contains('sessionsListItem__menuIcon--open')
		).toBe(true);
		// Read after the 160 ms cross-fade: `getComputedStyle` returns the
		// value the transition is currently at, not the one it is heading
		// for, so an immediate read sees the old white.
		await waitFor(() => {
			const style = getComputedStyle(trigger);
			expect(style.backgroundColor).toBe('rgb(165, 0, 10)');
			expect(style.color).toBe('rgb(255, 226, 222)');
		});

		// 3. Exactly one focus ring. The card is inside `--menuOpen`, so its
		//    own focus treatment is suppressed while the menu owns focus.
		const row =
			canvasElement.querySelector<HTMLElement>('.sessionsListItem')!;
		await expect(row.classList.contains('sessionsListItem--menuOpen')).toBe(
			true
		);
		// Focusing the card while the menu is open must not add anything to
		// what it already carries at rest — the card's own soft shadow is
		// part of its design, the keyboard halo is not.
		card.focus();
		await expect(getComputedStyle(card).boxShadow).toBe(atRest);
		await expect(getComputedStyle(card).outlineStyle).toBe('none');

		// 4. The menu is above its own backdrop. The SCSS carried
		//    `z-index: 99999 !important` against the component's inline
		//    999999, so the veil meant for the rest of the page washed the
		//    menu out as well.
		const backdrop =
			document.querySelector<HTMLElement>('.orisoMenuBackdrop');
		if (backdrop) {
			await expect(Number(getComputedStyle(menu).zIndex)).toBeGreaterThan(
				Number(getComputedStyle(backdrop).zIndex)
			);
		}

		// 5. The trigger keeps its shape — a horizontal pill, not a circle
		//    and not a rotation (Frank, 15.09.2026).
		const shape = trigger.getBoundingClientRect();
		await expect(shape.width).toBeGreaterThan(shape.height);
	}
};

/**
 * Phone (390 px): there is no "beside" at 390 px, so the menu falls to the
 * escape route rather than squeezing into a gap that does not exist. The
 * placement is asserted so a future change to the chain shows up here
 * instead of on someone's phone.
 */
export const MenuOnThePhone: Story = {
	name: 'Menü — 390 px, Ausweichweg statt Quetschung',
	globals: { viewport: { value: 'phone390' } },
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const { menu } = await openTheMenu(canvasElement);
		// Beside is impossible here; below or above is the honest answer.
		await expect(['below', 'above']).toContain(menu.dataset.placement);
		// And it stays inside the viewport either way.
		const box = menu.getBoundingClientRect();
		await expect(box.left).toBeGreaterThanOrEqual(11.5);
		await expect(box.right).toBeLessThanOrEqual(window.innerWidth - 11.5);
	}
};

/* ------------------------------------------------------------------ *
 * Avatar size trial — Frank, 15.09.2026
 * ------------------------------------------------------------------ */

/**
 * "Wie sieht das Icon vom Usernamen bei 40 Pixeln und bei 48 Pixeln aus?"
 *
 * Built from the real pieces — `MessageAvatar` and the card's own `__row` /
 * `__icon` / `__username` classes — so what is on screen here is what the
 * card would look like, not an impression of it. `MessageAvatar` already
 * renders without a ring, so the only variable is the size.
 *
 * The name sits 12 px from the avatar in every row: the row's `gap`, with
 * no padding of its own inside `__username`.
 */
export const AvatarSizeTrial: Story = {
	name: 'Avatar-Größe — 32 / 40 / 48 px, mit und ohne Outline',
	render: () => (
		<div style={{ ...listShell, maxWidth: 760, padding: 16 }}>
			{/*
			 * The outline is hardcoded in `AnimalAvatar.tsx:56` —
			 * `border: 2px solid #c4c7c8` plus a drop shadow, with no way to
			 * switch it off. `UserAvatar` has a `ring` prop and
			 * `MessageAvatar` already sets it to `false`; the border is
			 * re-added one level below that. Suppressed here for the
			 * comparison only, so the choice can be made by looking.
			 */}
			<style>{`
				.avatarTrial--bare [data-testid="user-avatar"] > div {
					border-color: transparent !important;
					box-shadow: none !important;
				}
			`}</style>
			{[
				{ bare: false, label: 'mit Outline (heute)' },
				{ bare: true, label: 'ohne Outline' }
			].map((variant) => (
				<div
					key={variant.label}
					className={variant.bare ? 'avatarTrial--bare' : undefined}
				>
					<p
						style={{
							margin: '8px 4px',
							fontSize: 12,
							fontWeight: 600,
							opacity: 0.7
						}}
					>
						{variant.label}
					</p>
					{[32, 40, 48].map((size) => (
						<div
							key={size}
							className="sessionsListItem__content"
							style={{ minHeight: 0, marginBottom: 8 }}
						>
							<div
								className="sessionsListItem__row"
								style={{ padding: '12px 16px' }}
							>
								<div
									className="sessionsListItem__icon"
									style={{
										width: size,
										height: size,
										minWidth: size
									}}
								>
									<MessageAvatar
										isGroup={false}
										isSystemNotification={false}
										userId="asker-4401"
										username="ruhiges-yak-kim@example.invalid"
										displayName="ruhiges Yak Kim"
										size={size}
									/>
								</div>
								<span className="sessionsListItem__username">
									ruhiges Yak Kim
								</span>
								<span
									style={{
										fontSize: 11,
										opacity: 0.5,
										alignSelf: 'center'
									}}
								>
									{size} px
								</span>
							</div>
						</div>
					))}
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		// The 12 px is the promise; measure it rather than trust the gap.
		const rows = canvasElement.querySelectorAll<HTMLElement>(
			'.sessionsListItem__row'
		);
		await expect(rows.length).toBe(6);
		for (const row of Array.from(rows)) {
			const icon = row.querySelector<HTMLElement>(
				'.sessionsListItem__icon'
			)!;
			const name = row.querySelector<HTMLElement>(
				'.sessionsListItem__username'
			)!;
			await expect(
				Math.round(
					name.getBoundingClientRect().left -
						icon.getBoundingClientRect().right
				)
			).toBe(12);
		}
	}
};

/* ------------------------------------------------------------------ *
 * Card layout proposals — Frank, 15.09.2026
 * ------------------------------------------------------------------ */

const PREVIEW_THREE_LINES =
	'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter.';

/** Three lines instead of one — the only rule the proposals add. */
const threeLines: React.CSSProperties = {
	whiteSpace: 'normal',
	display: '-webkit-box',
	WebkitLineClamp: 3,
	WebkitBoxOrient: 'vertical',
	overflow: 'hidden'
} as React.CSSProperties;

const TopRow = () => (
	<div className="sessionsListItem__row">
		<div className="sessionsListItem__rowLeft">
			<div className="sessionsListItem__topicPostcodeGroup">
				<div className="sessionsListItem__topic">Familienberatung</div>
				<div className="sessionsListItem__postcode">12345</div>
			</div>
		</div>
		<div className="sessionsListItem__rowRight">
			<div className="sessionsListItem__date">18.3.2026</div>
			<button type="button" className="sessionsListItem__menuIcon">
				<MenuVerticalIcon />
			</button>
		</div>
	</div>
);

const MailRow = ({ preview }: { preview?: boolean }) => (
	<div className="sessionsListItem__row">
		{preview && (
			<span className="sessionsListItem__subject">Anfrage gesendet</span>
		)}
		<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
			{/*
			 * The plain <img>, as this branch renders it. The masked variant
			 * that takes its colour from `--m3-primary` lives on the FE#1115
			 * branch; using its markup here produced an invisible square,
			 * because the mask rule does not exist on this branch.
			 */}
			<img
				src={mailConversationIcon}
				alt="Mail"
				className="sessionsListItem__consultingTypeIcon--nearbyIcon"
			/>
			<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
				Mail
			</span>
		</div>
	</div>
);

const Avatar = ({ size }: { size: number }) => (
	<div
		className="sessionsListItem__icon"
		style={{ width: size, height: size, minWidth: size }}
	>
		<MessageAvatar
			isGroup={false}
			isSystemNotification={false}
			userId="asker-4401"
			username="ruhiges-yak-kim@example.invalid"
			displayName="ruhiges Yak Kim"
			size={size}
		/>
	</div>
);

const Proposal = ({
	title,
	note,
	children
}: {
	title: string;
	note: string;
	children: React.ReactNode;
}) => (
	<div style={{ marginBottom: 20 }}>
		<p style={{ margin: '0 4px 6px', fontSize: 12, fontWeight: 600 }}>
			{title}
		</p>
		<div className="sessionsListItem__content" style={{ minHeight: 0 }}>
			{children}
		</div>
		<p
			style={{
				margin: '6px 4px 0',
				fontSize: 11,
				opacity: 0.6,
				lineHeight: 1.5
			}}
		>
			{note}
		</p>
	</div>
);

/**
 * Four arrangements of the same card. Nothing about the design changes —
 * same chips, same date, same trigger, same Mail row, same colours and
 * classes. What moves is where the avatar, the name and the preview sit,
 * and the preview runs to three lines instead of one.
 *
 * Frank, 15.09.2026: "eine vierziger Icon-Größe und eine 48er und dann den
 * Namen kurz daneben und dann ein 3-zeiliger Text, aber das Design was wir
 * haben, natürlich total gleich bleibt. Du bist quasi umarrangierst."
 */
export const CardLayoutProposals: Story = {
	name: 'Karte — vier Umarrangierungen (40 / 48 px, 3 Zeilen)',
	render: () => (
		<div style={{ ...listShell, maxWidth: 480, padding: 16 }}>
			<Proposal
				title="A — 40 px, Name daneben, Text darunter über die volle Breite"
				note="Der Name bleibt eine eigene Zeile. Der Text beginnt links am Kartenrand und hat die meiste Breite von allen vier."
			>
				<TopRow />
				<div
					className="sessionsListItem__row"
					style={{ padding: '0 16px' }}
				>
					<Avatar size={40} />
					<span className="sessionsListItem__username">
						ruhiges Yak Kim
					</span>
				</div>
				<div
					className="sessionsListItem__row"
					style={{ padding: '8px 16px 0' }}
				>
					<span
						className="sessionsListItem__subject"
						style={threeLines}
					>
						{PREVIEW_THREE_LINES}
					</span>
				</div>
				<MailRow />
			</Proposal>

			<Proposal
				title="B — 48 px, Avatar trägt Name und Text"
				note="Der Avatar steht links neben einem Block aus Name und Text. Ergibt die ruhigste Kante, kostet aber 60 px Textbreite."
			>
				<TopRow />
				<div
					className="sessionsListItem__row"
					style={{ padding: '0 16px', alignItems: 'flex-start' }}
				>
					<Avatar size={48} />
					<div style={{ minWidth: 0, flex: 1 }}>
						<span
							className="sessionsListItem__username"
							style={{ display: 'block', padding: 0 }}
						>
							ruhiges Yak Kim
						</span>
						<span
							className="sessionsListItem__subject"
							style={{ ...threeLines, marginTop: 2 }}
						>
							{PREVIEW_THREE_LINES}
						</span>
					</div>
				</div>
				<MailRow />
			</Proposal>

			<Proposal
				title="C — 40 px, Avatar trägt Name und Text"
				note="Wie B, nur mit dem kleineren Avatar. Der Text gewinnt 8 px, der Avatar verliert an Gewicht gegenüber dem Namen."
			>
				<TopRow />
				<div
					className="sessionsListItem__row"
					style={{ padding: '0 16px', alignItems: 'flex-start' }}
				>
					<Avatar size={40} />
					<div style={{ minWidth: 0, flex: 1 }}>
						<span
							className="sessionsListItem__username"
							style={{ display: 'block', padding: 0 }}
						>
							ruhiges Yak Kim
						</span>
						<span
							className="sessionsListItem__subject"
							style={{ ...threeLines, marginTop: 2 }}
						>
							{PREVIEW_THREE_LINES}
						</span>
					</div>
				</div>
				<MailRow />
			</Proposal>

			<Proposal
				title="D — 48 px, Name daneben, Text unter dem Namen eingerückt"
				note="Der Avatar steht frei, Name und Text fluchten auf derselben Kante. Die Einrückung macht den Avatar zum Anker der ganzen Karte."
			>
				<TopRow />
				<div
					className="sessionsListItem__row"
					style={{ padding: '0 16px' }}
				>
					<Avatar size={48} />
					<span className="sessionsListItem__username">
						ruhiges Yak Kim
					</span>
				</div>
				<div
					className="sessionsListItem__row"
					style={{ padding: '4px 16px 0 76px' }}
				>
					<span
						className="sessionsListItem__subject"
						style={threeLines}
					>
						{PREVIEW_THREE_LINES}
					</span>
				</div>
				<MailRow />
			</Proposal>
		</div>
	),
	play: async ({ canvasElement }) => {
		// Every proposal keeps the 12 px between avatar and name, and every
		// preview really runs to three lines rather than being cut at one.
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'.sessionsListItem__icon'
		);
		await expect(avatars.length).toBe(4);
		const previews = canvasElement.querySelectorAll<HTMLElement>(
			'.sessionsListItem__subject'
		);
		for (const preview of Array.from(previews)) {
			if (preview.textContent!.length < 40) continue;
			const lineHeight = Number.parseFloat(
				getComputedStyle(preview).lineHeight
			);
			await expect(
				Math.round(preview.getBoundingClientRect().height / lineHeight)
			).toBe(3);
		}
	}
};

/* ------------------------------------------------------------------ *
 * Text flow around avatar and Mail, v4 — Frank, 16.09.2026
 * ------------------------------------------------------------------ */

/*
 * The card as Frank sketched it over four passes:
 *
 *  - tag at the TOP of the chip row, not centred on the 32 px menu trigger;
 *  - avatar/name/preview block 10 px under the tag;
 *  - the preview's left edge is a steady diagonal — beside the avatar, a
 *    step further left, another step further left — instead of jumping
 *    back to the card's edge on the third line ("zu krass nach links
 *    auswandernd"); the area under the avatar stays empty;
 *  - from the second line on, the right edge steps in for the Mail column;
 *  - Mail sits beside the third line, its word ending exactly under the
 *    right edge of the white menu pill; the card closes 16 px below it;
 *  - the preview is truncated with an ellipsis after the third line;
 *  - thread and voice are marked by their existing icons alone.
 *
 * How:
 *
 *  - The left edge is a `shape-outside` polygon on the avatar float, one
 *    step per line box: 60 px (name and first line, the float's margin
 *    box), 51 px (the circle's edge at the second line's glyph band plus
 *    the 12 px gap), and the third-line value under comparison. The float
 *    carries a bottom margin so its area reaches the third line.
 *  - The ellipsis is `-webkit-line-clamp`. Chrome lays a vertical
 *    `-webkit-box` out as `flow-root`, so the floats keep working inside the
 *    clamp — measured. Everything sits in one inner block for engines that
 *    treat `-webkit-box` as a legacy flexbox. Safari is NOT verified: there
 *    is no WebKit build on this machine.
 *  - The avatar's ring (2 px grey border + shadow, hardcoded in
 *    `AnimalAvatar.tsx`, out of reach of the `ring` prop) is suppressed —
 *    it is what made flush text look 2 px too far left.
 *  - Measured on this card: chip row 1–49, menu pill 379–427, card 448 wide.
 */
const V4_ROW_BOTTOM = 49;
const V4_BORDER = 1;
const V4_AVATAR = 48;
const V4_GAP = 12;
const V4_NAME = 24;
const V4_LINE = 16;
const V4_LINES = 3;
const V4_INK = 3; // glyph band starts this far into a 16 px line box
const V4_CLIP = V4_NAME + V4_LINE * V4_LINES; // 72
const V4_INSET = 16;
/*
 * Mail's word ends exactly under the white menu pill (Frank: "rechtsbündig
 * von dem weißen Außenkreis"). The pill is NOT at the card's 16 px inset:
 * `.sessionsListItem__rowRight` adds `padding-right: 10px`, and only 4 px
 * below 900 px viewport width. Mail and its reserved column follow the same
 * rule through one custom property, so they cannot drift apart — the first
 * cut used a fixed 20 px, which matched at 560 px and missed by 6 px at
 * 1200 px.
 */
const V4_TRAILING_WIDE = 10; // mirrors `__rowRight` padding-right
const V4_TRAILING_NARROW = 4; // mirrors `__rowRight` below 900 px
const V4_MAIL = 24;
const V4_BODY = V4_CLIP + (V4_MAIL - V4_LINE) / 2 + V4_INSET; // 92
const V4_CARD = V4_ROW_BOTTOM + V4_BODY + V4_BORDER; // 142

const v4Radius = V4_AVATAR / 2;
const v4Line1X = V4_AVATAR + V4_GAP; // 60
const v4Line2Top = V4_NAME + V4_LINE; // 40
const v4Line3Top = V4_NAME + V4_LINE * 2; // 56
const v4Line2X = Math.round(
	v4Radius +
		Math.sqrt(v4Radius ** 2 - (v4Line2Top + V4_INK - v4Radius) ** 2) +
		V4_GAP
); // 51

/*
 * The two third-line indents under comparison, content-relative:
 *  - 42 px continues the 9 px step (60 → 51 → 42) and lands on "Woche" in
 *    preview 5 — 59 px from the card's edge;
 *  - 35 px is "ein ganz bisschen mehr nach links" — 52 px from the edge.
 */
const V4_LINE3 = { onWoche: v4Line2X - (v4Line1X - v4Line2X), left: 35 };
type Line3Choice = keyof typeof V4_LINE3;

const v4Shape = (line3X: number) =>
	`polygon(0 0, ${v4Line1X}px 0, ${v4Line1X}px ${v4Line2Top}px, ${v4Line2X}px ${v4Line2Top}px, ${v4Line2X}px ${v4Line3Top}px, ${line3X}px ${v4Line3Top}px, ${line3X}px ${V4_CLIP}px, 0 ${V4_CLIP}px)`;

type V4Preview = {
	key: string;
	label: string;
	glyph?: 'thread' | 'voice';
	text: string;
	/** true / false are asserted; undefined means "depends on the indent". */
	truncated?: boolean;
	line3: Line3Choice;
};

const TEXT_TWO_AND_HALF =
	'Guten Morgen, ich habe gestern mit meiner Schwester gesprochen und wir würden gerne gemeinsam zu einem Gespräch kommen.';
const TEXT_THREE =
	'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter.';

const v4Comparison: V4Preview[] = [
	{
		key: 'c4a',
		label: '4 — zweieinhalb Zeilen · Zeile 3 bei 59 px (auf „Woche")',
		text: TEXT_TWO_AND_HALF,
		line3: 'onWoche'
	},
	{
		key: 'c4b',
		label: '4 — zweieinhalb Zeilen · Zeile 3 bei 52 px (etwas weiter links)',
		text: TEXT_TWO_AND_HALF,
		line3: 'left'
	},
	{
		key: 'c5a',
		label: '5 — drei Zeilen und mehr · Zeile 3 bei 59 px (auf „Woche")',
		text: TEXT_THREE,
		truncated: true,
		line3: 'onWoche'
	},
	{
		key: 'c5b',
		label: '5 — drei Zeilen und mehr · Zeile 3 bei 52 px (etwas weiter links)',
		text: TEXT_THREE,
		truncated: true,
		line3: 'left'
	}
];

const v4All: V4Preview[] = (
	[
		{
			key: 'word',
			label: '1 — ein Wort',
			text: 'Danke!',
			truncated: false
		},
		{
			key: 'short',
			label: '2 — eine kurze Zeile',
			text: 'Anfrage gesendet',
			truncated: false
		},
		{
			key: 'oneAndHalf',
			label: '3 — anderthalb Zeilen',
			text: 'Hallo, hätten Sie nächste Woche einen Termin für mich? 🙂',
			truncated: false
		},
		{
			key: 'twoAndHalf',
			label: '4 — zweieinhalb Zeilen',
			text: TEXT_TWO_AND_HALF
		},
		{
			key: 'three',
			label: '5 — drei Zeilen und mehr',
			text: TEXT_THREE,
			truncated: true
		},
		{
			key: 'long',
			label: '6 — viel länger als drei Zeilen',
			text: 'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter. Mein Vater trinkt wieder mehr und meine Mutter sagt dazu nichts. Ich weiß nicht, wem ich das sonst erzählen soll.',
			truncated: true
		},
		{
			key: 'unbroken',
			label: '7 — ein langes Wort ohne Leerzeichen (Link)',
			text: 'https://www.beispiel-beratung.de/termine/familienberatung/2026/september/buchung?ref=abcdefghijklmnopqrstuvwxyz'
		},
		{
			key: 'thread',
			label: 'Thread — nur das Symbol',
			glyph: 'thread',
			text: 'Ja, das passt mir gut. Ich schicke Ihnen vorher noch die Unterlagen vom Jugendamt, dann können wir die gemeinsam durchgehen, wenn Sie Zeit haben. Am Donnerstag kann ich leider erst ab 16 Uhr.',
			truncated: true
		},
		{
			key: 'voice',
			label: 'Sprachnachricht — nur das Symbol, mit Dauer',
			glyph: 'voice',
			text: '0:42',
			truncated: false
		}
	] satisfies Array<Omit<V4Preview, 'line3'>>
).map((preview) => ({ ...preview, line3: 'onWoche' as Line3Choice }));

const v4Css = `
.flowV4 {
	--flow-trailing: ${V4_TRAILING_WIDE}px;
}
@media screen and (width <= 899px) {
	.flowV4 {
		--flow-trailing: ${V4_TRAILING_NARROW}px;
	}
}
.flowV4 .sessionsListItem__rowLeft {
	align-items: flex-start;
}
.flowV4 .sessionsListItem__topicPostcodeGroup {
	align-self: flex-start;
}
.flowV4 [data-testid="user-avatar"] > div {
	border-color: transparent !important;
	box-shadow: none !important;
}
.flowV4__body {
	position: relative;
	box-sizing: border-box;
	height: ${V4_BODY}px;
	padding: 0 ${V4_INSET}px;
}
.flowV4__clip {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: ${V4_LINES};
	height: ${V4_CLIP}px;
	overflow: hidden;
}
.flowV4__inner {
	display: block;
}
.flowV4__avatar {
	float: left;
	/* the bottom margin lets the float's area reach the third line */
	margin: 0 ${V4_GAP}px ${V4_CLIP - V4_AVATAR}px 0;
}
/* Keeps the first preview line full-width … */
.flowV4__spacer {
	float: right;
	width: 0;
	height: ${V4_NAME + V4_LINE}px;
}
/* … and from the second line on reserves the Mail column, where Mail
   really is: the menu pill's trailing offset further in than the inset. */
.flowV4__mailSlot {
	float: right;
	clear: right;
	height: ${V4_LINE * (V4_LINES - 1)}px;
	margin-left: ${V4_GAP}px;
	margin-right: var(--flow-trailing);
	visibility: hidden;
}
.flowV4__mail {
	position: absolute;
	right: calc(${V4_INSET}px + var(--flow-trailing));
	bottom: ${V4_INSET}px;
	height: ${V4_MAIL}px;
	padding-right: 0 !important;
}
.flowV4__name.sessionsListItem__username {
	display: block;
	padding: 0;
	line-height: ${V4_NAME}px;
}
/* The card's preview class is one clipped line (nowrap + overflow hidden)
   and carries align-content: center. Each of overflow: hidden and a
   non-normal align-content turns the block into its own formatting context
   — and such a block AVOIDS floats instead of flowing around them. */
.flowV4__text.sessionsListItem__subject {
	display: block;
	white-space: normal;
	overflow: visible;
	text-overflow: clip;
	align-content: normal;
	overflow-wrap: anywhere;
	line-height: ${V4_LINE}px;
}
.flowV4__glyph {
	width: 14px;
	height: 14px;
	vertical-align: -2px;
	margin-right: 6px;
	color: var(--m3-secondary, #4c555f);
}
.flowV4__glyph path {
	fill: currentColor;
}
`;

const V4Glyph = ({ kind }: { kind: 'thread' | 'voice' }) =>
	kind === 'thread' ? (
		<ThreadGlyphIcon
			className="flowV4__glyph"
			role="img"
			aria-label="Thread"
		/>
	) : (
		<AudioOnIcon
			className="flowV4__glyph"
			role="img"
			aria-label="Sprachnachricht"
		/>
	);

const V4MailMark = ({ className }: { className?: string }) => (
	<div
		className={`${className ?? ''} sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby`}
	>
		<img
			src={mailConversationIcon}
			alt="Mail"
			className="sessionsListItem__consultingTypeIcon--nearbyIcon"
		/>
		<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
			Mail
		</span>
	</div>
);

const V4Card = ({ preview }: { preview: V4Preview }) => (
	<div
		className="sessionsListItem__content flowV4"
		style={{ minHeight: 0 }}
		data-preview={preview.key}
	>
		<TopRow />
		<div className="flowV4__body">
			<div className="flowV4__clip">
				<div className="flowV4__inner">
					<div
						className="flowV4__avatar"
						style={{
							shapeOutside: v4Shape(V4_LINE3[preview.line3])
						}}
					>
						<Avatar size={V4_AVATAR} />
					</div>
					<div className="flowV4__spacer" aria-hidden="true" />
					<div className="flowV4__mailSlot" aria-hidden="true">
						<V4MailMark />
					</div>
					<span className="flowV4__name sessionsListItem__username">
						ruhiges Yak Kim
					</span>
					<div className="flowV4__text sessionsListItem__subject">
						{preview.glyph && <V4Glyph kind={preview.glyph} />}
						{preview.text}
					</div>
				</div>
			</div>
			<V4MailMark className="flowV4__mail" />
		</div>
	</div>
);

/** Glyph box and text on one line count as one line. */
const mergeLineRects = (rects: DOMRect[]) =>
	rects.reduce<DOMRect[]>((merged, rect) => {
		const last = merged[merged.length - 1];
		if (last && Math.abs(last.top - rect.top) < 4) {
			const left = Math.min(last.left, rect.left);
			merged[merged.length - 1] = new DOMRect(
				left,
				last.top,
				Math.max(last.right, rect.right) - left,
				last.height
			);
		} else {
			merged.push(rect);
		}
		return merged;
	}, []);

const V4Section = ({
	title,
	previews
}: {
	title: string;
	previews: V4Preview[];
}) => (
	<section style={{ marginBottom: 28 }}>
		<h3 style={{ margin: '0 4px 12px', fontSize: 14 }}>{title}</h3>
		{previews.map((preview) => (
			<div key={preview.key} style={{ marginBottom: 16 }}>
				<p
					style={{
						margin: '0 4px 6px',
						fontSize: 12,
						fontWeight: 600
					}}
				>
					{preview.label}
				</p>
				<V4Card preview={preview} />
			</div>
		))}
	</section>
);

const v4Rendered = [...v4Comparison, ...v4All];

export const CardTextFlow: Story = {
	name: 'Karte — Umfluss v4: schräger Einzug, Mail unter dem Knopf',
	render: () => (
		<div style={{ ...listShell, maxWidth: 480, padding: 16 }}>
			<style>{v4Css}</style>
			<V4Section
				title="Vergleich — wo beginnt Zeile 3?"
				previews={v4Comparison}
			/>
			<V4Section
				title="Alle Texte — Zeile 3 bei 59 px"
				previews={v4All}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const cards = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'.sessionsListItem__content'
			)
		);
		await expect(cards.length).toBe(v4Rendered.length);

		for (const [index, card] of cards.entries()) {
			const preview = v4Rendered[index];
			const box = card.getBoundingClientRect();
			const at = (selector: string) =>
				card
					.querySelector<HTMLElement>(selector)!
					.getBoundingClientRect();

			// Compact and uniform.
			await expect(Math.round(box.height)).toBe(V4_CARD);

			// Tag at the top of the chip row, block 10 px under it.
			const tag = at('.sessionsListItem__topicPostcodeGroup');
			const menu = at('.sessionsListItem__menuIcon');
			await expect(Math.round(tag.top)).toBe(Math.round(menu.top));
			const avatar = at('.flowV4__avatar');
			await expect(Math.round(avatar.top - tag.bottom)).toBe(10);

			// No ring: the disc's visible edge is its box edge.
			const disc = card.querySelector<HTMLElement>(
				'[data-testid="user-avatar"] > div'
			)!;
			await expect(getComputedStyle(disc).boxShadow).toBe('none');
			await expect(getComputedStyle(disc).borderTopColor).toBe(
				'rgba(0, 0, 0, 0)'
			);

			// Mail: its word ends exactly under the white pill's right edge,
			// it is centred on the third line, and 16 px from the bottom.
			const clip = at('.flowV4__clip');
			const mail = at('.flowV4__mail');
			const labelRange = document.createRange();
			labelRange.selectNodeContents(
				card.querySelector(
					'.flowV4__mail .sessionsListItem__consultingTypeIcon--nearbyLabel'
				)!
			);
			await expect(
				Math.abs(labelRange.getBoundingClientRect().right - menu.right)
			).toBeLessThan(0.5);
			const thirdLineCentre = clip.top + v4Line3Top + V4_LINE / 2;
			await expect(
				Math.abs((mail.top + mail.bottom) / 2 - thirdLineCentre)
			).toBeLessThanOrEqual(1);
			await expect(Math.round(box.bottom - V4_BORDER - mail.bottom)).toBe(
				V4_INSET
			);

			// The left edge: a steady diagonal, never back to the card edge.
			const name = at('.flowV4__name');
			const range = document.createRange();
			range.selectNodeContents(
				card.querySelector<HTMLElement>('.flowV4__text')!
			);
			const allLines = mergeLineRects(
				Array.from(range.getClientRects()).filter(
					(rect) => rect.width > 0
				)
			);
			const lines = allLines.filter(
				(rect) => rect.top < clip.bottom - 0.5
			);
			await expect(lines.length).toBeGreaterThan(0);
			await expect(lines.length).toBeLessThanOrEqual(V4_LINES);
			await expect(Math.abs(lines[0].left - name.left)).toBeLessThan(1);
			const expectedLeft = [v4Line1X, v4Line2X, V4_LINE3[preview.line3]];
			for (const [lineIndex, line] of lines.entries()) {
				await expect(Math.round(line.left - avatar.left)).toBe(
					expectedLeft[lineIndex]
				);
				await expect(line.bottom).toBeLessThanOrEqual(
					clip.bottom + 0.5
				);
			}
			// From the second line on: 12 px clear of the Mail column.
			for (const line of lines.slice(1)) {
				await expect(line.right).toBeLessThanOrEqual(
					mail.left - V4_GAP + 0.5
				);
			}

			// Truncation: the clamp hides lines rather than removing them, so
			// counting all line boxes shows whether the text runs past three.
			await expect(
				getComputedStyle(
					card.querySelector<HTMLElement>('.flowV4__clip')!
				).getPropertyValue('-webkit-line-clamp')
			).toBe(String(V4_LINES));
			if (preview.truncated === true) {
				await expect(lines.length).toBe(V4_LINES);
				await expect(allLines.length).toBeGreaterThan(V4_LINES);
			}
			if (preview.truncated === false) {
				await expect(allLines.length).toBeLessThanOrEqual(V4_LINES);
			}
		}
	}
};

/**
 * FE#1115 — the advice seeker's own row while the platform is still looking
 * for a counsellor. The avatar slot holds the magnet, naked: no black disc
 * any more, and nothing in the row clips its beam.
 */
export const AskerSearchingRow: Story = {
	name: 'Ratsuchende wartet — Magnet im Avatar-Platz (FE#1115)',
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem asSearchingAsker />;
	},
	play: async ({ canvasElement }) => {
		const magnet = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.consultantSearchLoader'
			);
			expect(element).toBeTruthy();
			return element!;
		});
		// The slot it stands in is the avatar slot, at the avatar's size.
		const box = magnet.getBoundingClientRect();
		await expect(Math.round(box.width)).toBe(32);
		// No black disc any more — nothing is painted behind the magnet.
		await expect(getComputedStyle(magnet).backgroundColor).toBe(
			'rgba(0, 0, 0, 0)'
		);

		// The beam is here too, and it stays inside the card: it points
		// right, into the card's own width, so the corner clip that rounds
		// the card never reaches it. Measured at the end of the flight.
		const card = canvasElement.querySelector<HTMLElement>(
			'.sessionsListItem__content'
		)!;
		await expect(
			card.classList.contains('consultantSearchLoaderHost')
		).toBe(true);
		const sweep = magnet.querySelector<HTMLElement>(
			'.consultantSearchLoader__sweep'
		)!;
		const beam = magnet.querySelector<HTMLElement>(
			'.consultantSearchLoader__beam'
		)!;
		await expect(beam).toBeTruthy();
		magnet.classList.add('consultantSearchLoader--pulsing');
		sweep.getAnimations().forEach((animation) => animation.pause());
		const flight = Number(
			beam.getAnimations()[0]!.effect!.getTiming().duration
		);
		beam.getAnimations().forEach((animation) => {
			animation.pause();
			animation.currentTime = flight;
		});
		const beamBox = beam.getBoundingClientRect();
		const cardBox = card.getBoundingClientRect();
		await expect(beamBox.right).toBeGreaterThan(box.right);
		await expect(beamBox.right).toBeLessThan(cardBox.right);
		await expect(beamBox.top).toBeGreaterThan(cardBox.top);
		await expect(beamBox.bottom).toBeLessThan(cardBox.bottom);
		magnet.classList.remove('consultantSearchLoader--pulsing');
	}
};
