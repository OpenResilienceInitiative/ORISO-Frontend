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
	viewerId = runtimeUserData.userId
}: {
	lastMessage?: string;
	/** Extra `session` DTO fields, e.g. the ADR-008 `supervision` marker. */
	sessionOverrides?: Partial<ListItemInterface['session']>;
	/** Owning consultant of the row (defaults to the viewer = own session). */
	consultantId?: string;
	/** Logged-in consultant. */
	viewerId?: string;
} = {}) {
	const storySession: ListItemInterface = {
		...runtimeSession,
		consultant: {
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
	const userData = { ...runtimeUserData, userId: viewerId };

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
 * Text flow around avatar and Mail, v2 — Frank, 16.09.2026
 * ------------------------------------------------------------------ */

/*
 * Frank's second sketch:
 *
 *  - the topic tag sits at the TOP of the chip row, not centred on the
 *    32 px menu trigger — that alone frees vertical room;
 *  - the avatar/name/preview block moves up into it, 10 px under the tag
 *    instead of 23;
 *  - the preview is indented beside the avatar for two lines and runs
 *    under it from the third, and from the second line on its right edge
 *    steps in so the Mail mark keeps its own column;
 *  - Mail stays where the design has it today: bottom right, 16 px inset.
 *
 * Measured on the current card: chip row 1–49, tag 22–44 (22 px, centred),
 * body 63–159. The numbers below are those measurements, not guesses.
 *
 * Thread and voice are marked by their icons alone — no word. Frank: "Das
 * Wort … passt nicht in unser Designsystem … einfach die Icons benutzen, die
 * wir haben." The voice icon is `audio-on.svg`, the one the composer's record
 * button already uses; the thread icon is `fab-menu-thread.svg`, the one the
 * collapsed rail already uses.
 */
const V2_ROW_BOTTOM = 49; // card-relative, measured
const V2_BODY_HEIGHT = 110; // 49 → 159, the card's inner bottom
const V2_NAME = 24;
const V2_LINE = 16;
const V2_LINES = 3;
const V2_CLIP = V2_NAME + V2_LINE * V2_LINES; // 72
const V2_INSET = 16;

const v2Previews: Array<{
	key: string;
	label: string;
	glyph?: 'thread' | 'voice';
	text: string;
}> = [
	{ key: 'word', label: '1 — ein Wort', text: 'Danke!' },
	{ key: 'short', label: '2 — eine kurze Zeile', text: 'Anfrage gesendet' },
	{
		key: 'oneAndHalf',
		label: '3 — anderthalb Zeilen',
		text: 'Hallo, hätten Sie nächste Woche einen Termin für mich? 🙂'
	},
	{
		key: 'twoAndHalf',
		label: '4 — zweieinhalb Zeilen',
		text: 'Guten Morgen, ich habe gestern mit meiner Schwester gesprochen und wir würden gerne gemeinsam zu einem Gespräch kommen, wenn das geht.'
	},
	{
		key: 'three',
		label: '5 — genau drei Zeilen',
		text: 'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter.'
	},
	{
		key: 'long',
		label: '6 — viel länger als drei Zeilen',
		text: 'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter. Mein Vater trinkt wieder mehr und meine Mutter sagt dazu nichts. Ich weiß nicht, wem ich das sonst erzählen soll, und ich habe Angst, dass es noch schlimmer wird, wenn ich etwas sage.'
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
		text: 'Ja, das passt mir gut. Ich schicke Ihnen vorher noch die Unterlagen vom Jugendamt, dann können wir die gemeinsam durchgehen.'
	},
	{
		key: 'voice',
		label: 'Sprachnachricht — nur das Symbol, mit Dauer',
		glyph: 'voice',
		text: '0:42'
	}
];

const v2Css = `
.flowV2 .sessionsListItem__rowLeft {
	align-items: flex-start;
}
.flowV2 .sessionsListItem__topicPostcodeGroup {
	align-self: flex-start;
}
.flowV2__body {
	position: relative;
	box-sizing: border-box;
	height: ${V2_BODY_HEIGHT}px;
	padding: 0 ${V2_INSET}px;
}
.flowV2__clip {
	height: ${V2_CLIP}px;
	overflow: hidden;
}
.flowV2__avatar {
	float: left;
	margin: 0 12px 0 0;
}
/* Keeps the first preview line full-width … */
.flowV2__spacer {
	float: right;
	width: 0;
	height: ${V2_NAME + V2_LINE}px;
}
/* … and from the second line on reserves the Mail column. */
.flowV2__mailSlot {
	float: right;
	clear: right;
	height: ${V2_LINE * (V2_LINES - 1)}px;
	margin-left: 12px;
	visibility: hidden;
}
.flowV2__mail {
	position: absolute;
	right: ${V2_INSET}px;
	bottom: ${V2_INSET}px;
	height: 24px;
	padding-right: 0 !important;
}
.flowV2__name.sessionsListItem__username {
	display: block;
	padding: 0;
	line-height: ${V2_NAME}px;
}
/* The card's preview class is one clipped line (nowrap + overflow hidden)
   and carries align-content: center. Each of overflow: hidden and a
   non-normal align-content turns the block into its own formatting context
   — and such a block AVOIDS floats instead of flowing around them. */
.flowV2__text.sessionsListItem__subject {
	display: block;
	white-space: normal;
	overflow: visible;
	text-overflow: clip;
	align-content: normal;
	overflow-wrap: anywhere;
	line-height: ${V2_LINE}px;
}
.flowV2__glyph {
	width: 14px;
	height: 14px;
	vertical-align: -2px;
	margin-right: 6px;
	color: var(--m3-secondary, #4c555f);
}
.flowV2__glyph path {
	fill: currentColor;
}
`;

const V2Glyph = ({ kind }: { kind: 'thread' | 'voice' }) =>
	kind === 'thread' ? (
		<ThreadGlyphIcon
			className="flowV2__glyph"
			role="img"
			aria-label="Thread"
		/>
	) : (
		<AudioOnIcon
			className="flowV2__glyph"
			role="img"
			aria-label="Sprachnachricht"
		/>
	);

const V2MailMark = ({ className }: { className?: string }) => (
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

const V2Card = ({
	glyph,
	text
}: {
	glyph?: 'thread' | 'voice';
	text: string;
}) => (
	<div
		className="sessionsListItem__content flowV2"
		style={{ minHeight: 160 }}
	>
		<TopRow />
		<div className="flowV2__body">
			<div className="flowV2__clip">
				<div className="flowV2__avatar">
					<Avatar size={48} />
				</div>
				<div className="flowV2__spacer" aria-hidden="true" />
				<div className="flowV2__mailSlot" aria-hidden="true">
					<V2MailMark />
				</div>
				<span className="flowV2__name sessionsListItem__username">
					ruhiges Yak Kim
				</span>
				<div className="flowV2__text sessionsListItem__subject">
					{glyph && <V2Glyph kind={glyph} />}
					{text}
				</div>
			</div>
			<V2MailMark className="flowV2__mail" />
		</div>
	</div>
);

export const CardTextFlow: Story = {
	name: 'Karte — Umfluss v2: Kachel oben, Block höher, 9 Texte',
	render: () => (
		<div style={{ ...listShell, maxWidth: 480, padding: 16 }}>
			<style>{v2Css}</style>
			{v2Previews.map((preview) => (
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
					<V2Card glyph={preview.glyph} text={preview.text} />
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const cards = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'.sessionsListItem__content'
			)
		);
		await expect(cards.length).toBe(v2Previews.length);

		for (const card of cards) {
			const box = card.getBoundingClientRect();
			const border = Number.parseFloat(
				getComputedStyle(card).borderBottomWidth
			);
			const at = (selector: string) =>
				card
					.querySelector<HTMLElement>(selector)!
					.getBoundingClientRect();

			// Every card is exactly as tall as today, whatever the text.
			await expect(Math.round(box.height)).toBe(160);

			// The tag is at the top of the chip row, not centred on the menu.
			const tag = at('.sessionsListItem__topicPostcodeGroup');
			const menu = at('.sessionsListItem__menuIcon');
			await expect(Math.round(tag.top)).toBe(Math.round(menu.top));

			// The block sits 10 px under the tag.
			const avatar = at('.flowV2__avatar');
			await expect(Math.round(avatar.top - tag.bottom)).toBe(10);

			// Mail keeps the design's bottom-right position.
			const mail = at('.flowV2__mail');
			await expect(Math.round(box.bottom - border - mail.bottom)).toBe(
				V2_INSET
			);

			// The preview: at most three lines, nothing peeking below the
			// clip, the first line indented beside the avatar, and from the
			// second line on nothing runs into the Mail column.
			const clip = at('.flowV2__clip');
			const range = document.createRange();
			range.selectNodeContents(
				card.querySelector<HTMLElement>('.flowV2__text')!
			);
			const lines = Array.from(range.getClientRects())
				.filter(
					(rect) => rect.width > 0 && rect.top < clip.bottom - 0.5
				)
				// merge the glyph's box and the text on the same line
				.reduce<DOMRect[]>((merged, rect) => {
					const last = merged[merged.length - 1];
					if (last && Math.abs(last.top - rect.top) < 4) {
						merged[merged.length - 1] = new DOMRect(
							Math.min(last.left, rect.left),
							last.top,
							Math.max(last.right, rect.right) -
								Math.min(last.left, rect.left),
							last.height
						);
					} else {
						merged.push(rect);
					}
					return merged;
				}, []);
			await expect(lines.length).toBeGreaterThan(0);
			await expect(lines.length).toBeLessThanOrEqual(V2_LINES);
			await expect(lines[0].left).toBeGreaterThanOrEqual(avatar.right);
			for (const line of lines) {
				await expect(line.bottom).toBeLessThanOrEqual(
					clip.bottom + 0.5
				);
				await expect(line.right).toBeLessThanOrEqual(
					box.right - border - V2_INSET + 0.5
				);
			}
			for (const line of lines.slice(1)) {
				await expect(line.right).toBeLessThanOrEqual(mail.left + 0.5);
			}
			if (lines.length === V2_LINES) {
				// the third line runs under the avatar
				await expect(lines[2].left).toBeLessThan(avatar.right - 1);
			}
		}
	}
};
