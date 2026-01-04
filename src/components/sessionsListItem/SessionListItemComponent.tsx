import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useHistory } from 'react-router-dom';
import { getSessionsListItemIcon, LIST_ICONS } from './sessionsListItemHelpers';
import {
	convertISO8601ToMSSinceEpoch,
	getPrettyDateFromMessageDate,
	MILLISECONDS_PER_SECOND
} from '../../utils/dateHelpers';
import { UserAvatar } from '../message/UserAvatar';
import { ConsultantSearchLoader } from '../sessionHeader/ConsultantSearchLoader';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as BellOffIcon } from '../../resources/img/icons/audio-off.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as PackageIcon } from '../../resources/img/icons/documents.svg';
import oneOnOneImage from '../../resources/img/illustrations/one-on-one.svg';
import teamImage from '../../resources/img/illustrations/Team.svg';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import {
	AUTHORITIES,
	E2EEContext,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	useTenant,
	ActiveSessionContext,
	useTopic,
	SessionsDataContext,
	REMOVE_SESSIONS
} from '../../globalState';
import { TopicSessionInterface } from '../../globalState/interfaces';
import { getGroupChatDate } from '../session/sessionDateHelpers';
import { markdownToDraft } from 'markdown-draft-js';
import { convertFromRaw } from 'draft-js';
import './sessionsListItem.styles';
import { Tag } from '../tag/Tag';
import { SessionListItemVideoCall } from './SessionListItemVideoCall';
import { SessionListItemAttachment } from './SessionListItemAttachment';
import clsx from 'clsx';
import {
	decryptText,
	MissingKeyError,
	WrongKeyError
} from '../../utils/encryptionHelpers';
import { useE2EE } from '../../hooks/useE2EE';
import { useSearchParam } from '../../hooks/useSearchParams';
import { SessionListItemLastMessage } from './SessionListItemLastMessage';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { RocketChatUsersOfRoomContext } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import { RoomMember } from 'matrix-js-sdk';
import { apiPutArchive, apiPutDearchive } from '../../api';
import DeleteSession from '../session/DeleteSession';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { archiveSessionSuccessOverlayItem } from '../sessionMenu/sessionMenuHelpers';
import { mobileListView } from '../app/navigationHandler';
interface SessionListItemProps {
	defaultLanguage: string;
	itemRef?: any;
	handleKeyDownLisItemContent?: Function;
	index: number;
}

export const SessionListItemComponent = ({
	defaultLanguage,
	itemRef,
	handleKeyDownLisItemContent,
	index
}: SessionListItemProps) => {
	const [matrixMembers, setMatrixMembers] = useState<RoomMember[]>([]);
	const { t: translate } = useTranslation(['common']);
	const tenantData = useTenant();
	const settings = useAppConfig();
	const { sessionId, rcGroupId: groupIdFromParam } = useParams<{
		rcGroupId: string;
		sessionId: string;
	}>();
	const sessionIdFromParam = sessionId ? parseInt(sessionId) : null;
	const history = useHistory();

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const { userData } = useContext(UserDataContext);
	const { path: listPath, type } = useContext(SessionTypeContext);
	const { isE2eeEnabled } = useContext(E2EEContext);
	const { activeSession, reloadActiveSession } = useContext(ActiveSessionContext);
	const { dispatch: sessionsDispatch } = useContext(SessionsDataContext);
	// MATRIX MIGRATION: RocketChat users context may be null for Matrix rooms
	const rcUsersContext = useContext(RocketChatUsersOfRoomContext);

	// Dropdown menu state
	const [flyoutOpen, setFlyoutOpen] = useState(false);
	const menuIconRef = React.useRef<HTMLDivElement>(null);
	const dropdownRef = React.useRef<HTMLDivElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
	const [overlayItem, setOverlayItem] = useState(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	// Is List Item active
	const isChatActive =
		activeSession.rid === groupIdFromParam ||
		activeSession.item.id === sessionIdFromParam;

	const language = activeSession.item.language || defaultLanguage;
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const topicId = (activeSession.item.topic as TopicSessionInterface)?.id || null;
	const topic = useTopic(topicId);

	const { key, keyID, encrypted, ready } = useE2EE(
		activeSession.item.groupId,
		activeSession.item.lastMessageType ===
			ALIAS_MESSAGE_TYPES.MASTER_KEY_LOST
	);
	const [plainTextLastMessage, setPlainTextLastMessage] = useState(null);

	// Member count for group chats (used for "+N" avatar). For non-group chats this stays 0.
	const memberCount = activeSession.isGroup
		? rcUsersContext?.total || 0
		: 0;
	const additionalMembers = Math.max(0, memberCount - 2); // Subtract 2 for the visible avatars

	const { autoSelectPostcode } =
		consultingType?.registration ||
		settings.registration.consultingTypeDefaults;

		useEffect(() => {
			setMatrixMembers(new Array(3) as unknown as RoomMember[]);
		}, []);
		
		
		
		

	useEffect(() => {
		if (!ready) {
			return;
		}

		if (isE2eeEnabled) {
			if (!activeSession.item.e2eLastMessage) return;
			decryptText(
				activeSession.item.e2eLastMessage.msg,
				keyID,
				key,
				encrypted,
				activeSession.item.e2eLastMessage.t === 'e2e'
			)
				.catch((e): string =>
					translate(
						e instanceof MissingKeyError ||
							e instanceof WrongKeyError
							? e.message
							: 'e2ee.message.encryption.error'
					)
				)
				.then((message) => {
					const rawMessageObject = markdownToDraft(message);
					const contentStateMessage =
						convertFromRaw(rawMessageObject);
					setPlainTextLastMessage(contentStateMessage.getPlainText());
				});
		} else {
			if (
				activeSession.item.e2eLastMessage &&
				activeSession.item.e2eLastMessage.t === 'e2e'
			) {
				setPlainTextLastMessage(
					translate('e2ee.message.encryption.text')
				);
			} else {
				const rawMessageObject = markdownToDraft(
					activeSession.item.lastMessage
				);
				const contentStateMessage = convertFromRaw(rawMessageObject);
				setPlainTextLastMessage(contentStateMessage.getPlainText());
			}
		}
	}, [
		isE2eeEnabled,
		key,
		keyID,
		encrypted,
		activeSession.item.groupId,
		activeSession.item.e2eLastMessage,
		activeSession.item.lastMessage,
		translate,
		ready
	]);

	const isAsker = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (flyoutOpen) {
				const target = e.target as HTMLElement;
				if (!target.closest('.sessionsListItem__menuIcon') && 
					!target.closest('.sessionsListItem__dropdown')) {
					setFlyoutOpen(false);
				}
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [flyoutOpen]);

	// Recalculate dropdown position when it's open and window resizes/scrolls
	useEffect(() => {
		if (flyoutOpen && menuIconRef.current) {
			const updatePosition = () => {
				if (menuIconRef.current) {
					const rect = menuIconRef.current.getBoundingClientRect();
					setDropdownPosition({
						top: rect.bottom + 8,
						left: rect.right - 280 // Position dropdown to the left of menu icon
					});
				}
			};

			window.addEventListener('scroll', updatePosition, true);
			window.addEventListener('resize', updatePosition);

			return () => {
				window.removeEventListener('scroll', updatePosition, true);
				window.removeEventListener('resize', updatePosition);
			};
		}
	}, [flyoutOpen]);

	if (!activeSession) {
		return null;
	}
	
	// MATRIX MIGRATION: If consulting type or topic is missing, render simplified card
	if (!consultingType) {
		console.warn('⚠️ Missing consulting type for session', activeSession.item.id);
		return (
			<div
				onClick={() => history.push(`/sessions/consultant/sessionView/${activeSession.item.id}`)}
				style={{
					backgroundColor: 'white',
					padding: '15px',
					margin: '5px 10px',
					border: '1px solid #ddd',
					borderRadius: '8px',
					cursor: 'pointer',
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
				}}
			>
				<div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>
					🔔 {activeSession.user?.username || 'Unknown User'}
				</div>
				<div style={{fontSize: '12px', color: '#666'}}>
					Session ID: {activeSession.item.id} | Postcode: {activeSession.item.postcode}
				</div>
				<div style={{fontSize: '11px', color: '#999', marginTop: '5px'}}>
					Status: NEW (Waiting for consultant)
				</div>
			</div>
		);
	}

	const handleOnClick = () => {
		console.log('🖱️ CARD CLICKED:', {
			sessionId: activeSession.item.id,
			groupId: activeSession.item.groupId,
			isGroup: activeSession.isGroup,
			listPath,
			isEmptyEnquiry: activeSession.isEmptyEnquiry,
			isAsker: hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
		});
		
		// For sessions without groupId (Matrix migration), navigate by session ID
		if (activeSession.item.id !== undefined) {
			// Check if groupId looks like a Matrix room ID (starts with ! or contains :)
			const isMatrixRoomId = activeSession.item.groupId && 
				(activeSession.item.groupId.startsWith('!') || activeSession.item.groupId.includes(':'));
			
			if (activeSession.item.groupId && !isMatrixRoomId) {
				// Original RocketChat behavior: navigate with groupId
				const targetPath = `${listPath}/${activeSession.item.groupId}/${activeSession.item.id}${getSessionListTab()}`;
				console.log('🚀 Navigating with RocketChat groupId:', targetPath);
				history.push(targetPath);
			} else if (
				hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
				activeSession.isEmptyEnquiry
			) {
				// Empty enquiry: go to write view
				const targetPath = `/sessions/user/view/write/${activeSession.item.id}`;
				console.log('🚀 Navigating to write view:', targetPath);
				history.push(targetPath);
			} else {
				// MATRIX MIGRATION FIX: Navigate by session ID for Matrix rooms or sessions without groupId
				const targetPath = `${listPath}/session/${activeSession.item.id}${getSessionListTab()}`;
				console.log('🚀 Navigating by session ID (Matrix or no groupId):', targetPath);
				history.push(targetPath);
			}
		}
	};

	const handleKeyDownListItem = (e) => {
		handleKeyDownLisItemContent(e);
		if (e.key === 'Enter' || e.key === ' ') {
			handleOnClick();
		}
	};

	// Dropdown menu handlers
	const handleMenuClick = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent card click
		const newState = !flyoutOpen;
		if (newState && menuIconRef.current) {
			// Calculate position when opening - use getBoundingClientRect for viewport coordinates
			const rect = menuIconRef.current.getBoundingClientRect();
			setDropdownPosition({
				top: rect.bottom + 8,
				left: rect.right - 280 // Position dropdown to the left of menu icon (dropdown width is 280px)
			});
		}
		setFlyoutOpen(newState);
	};

	const handleArchiveSession = () => {
		setFlyoutOpen(false);
		setOverlayItem(archiveSessionSuccessOverlayItem);
		setOverlayActive(true);
	};

	const handleDearchiveSession = () => {
		setFlyoutOpen(false);
		apiPutDearchive(activeSession.item.id)
			.then(() => {
				reloadActiveSession();
				setTimeout(() => {
					if (window.innerWidth >= 900) {
						history.push(
							`${listPath}/${activeSession.item.groupId}/${activeSession.item.id}${getSessionListTab()}`
						);
					} else {
						mobileListView();
						history.push(listPath);
					}
				}, 1000);
			})
			.catch((error) => {
				console.error(error);
			});
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (isRequestInProgress) {
			return null;
		}
		setIsRequestInProgress(true);
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayActive(false);
			setOverlayItem(null);
			setIsRequestInProgress(false);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.ARCHIVE) {
			const sessionId = activeSession.item.id;
			const sessionGroupId = activeSession.item.groupId;
			
			apiPutArchive(sessionId)
				.then(() => {
					sessionsDispatch({
						type: REMOVE_SESSIONS,
						ids: sessionGroupId ? [sessionGroupId] : [sessionId]
					});
					
					mobileListView();
					history.push(listPath);
				})
				.catch((error) => {
					console.error(error);
				})
				.finally(() => {
					setOverlayActive(false);
					setOverlayItem(null);
					setIsRequestInProgress(false);
					setFlyoutOpen(false);
				});
		}
	};

	const onSuccessDeleteSession = () => {
		mobileListView();
		history.push(listPath);
	};

	const iconVariant = () => {
		if (activeSession.isGroup) {
			return {
				variant: LIST_ICONS.IS_GROUP_CHAT,
				title: translate('message.groupChat')
			};
		} else if (activeSession.isEmptyEnquiry) {
			return {
				variant: LIST_ICONS.IS_NEW_ENQUIRY,
				title: translate('message.newEnquiry')
			};
		} else if (activeSession.item.messagesRead) {
			return {
				variant: LIST_ICONS.IS_READ,
				title: translate('message.read')
			};
		} else {
			return {
				variant: LIST_ICONS.IS_UNREAD,
				title: translate('message.unread')
			};
		}
	};

	const Icon = getSessionsListItemIcon(iconVariant().variant);
	const iconTitle = iconVariant().title;

	const prettyPrintDate = (
		messageDate: number, // seconds since epoch
		createDate: string // ISO8601 string
	) => {
		// Prioritize messageDate (last message) over createDate
		const dateToUse = messageDate && messageDate > 0
			? messageDate * MILLISECONDS_PER_SECOND
			: convertISO8601ToMSSinceEpoch(createDate);

		const prettyDate = getPrettyDateFromMessageDate(
			dateToUse / MILLISECONDS_PER_SECOND
		);

		return prettyDate.str ? translate(prettyDate.str) : prettyDate.date;
	};

	// Hide sessions if consultingType has been switched to group chat.
	// ToDo: What is with vice versa?
	// DISABLED FOR MATRIX MIGRATION - This was hiding sessions without groupId
	// if (activeSession.isSession && consultingType?.groupChat?.isGroupChat) {
	// 	return null;
	// }

	// MATRIX MIGRATION: Render fallback if consulting type is missing
	if (!consultingType && !activeSession.isGroup) {
		return (
			<div
				onClick={() => history.push(`${listPath}/sessionView/${activeSession.item.id}${getSessionListTab()}`)}
				className="sessionsListItem"
				data-cy="session-list-item"
			>
				<div className="sessionsListItem__content">
					<div className="sessionsListItem__row">
						<div className="sessionsListItem__consultingType">
							{activeSession.item.postcode || 'N/A'}
						</div>
						<div className="sessionsListItem__date">
							{new Date(activeSession.item.createDate).toLocaleDateString('de-DE')}
						</div>
					</div>
					<div className="sessionsListItem__row">
						<div className="sessionsListItem__icon">
							📋
						</div>
						<div className="sessionsListItem__username">
							{activeSession.user?.username || 'Unknown User'}
						</div>
					</div>
					<div className="sessionsListItem__row">
						<div className="sessionsListItem__subject">
							Agency: {activeSession.item.agencyId} • Status: NEW
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (activeSession.isGroup) {
		const isMyChat = () =>
			activeSession.consultant &&
			userData.userId === activeSession.consultant.id;
		const defaultSubjectText = isMyChat()
			? translate('groupChat.listItem.subjectEmpty.self')
			: translate('groupChat.listItem.subjectEmpty.other');
		return (
			<div
				onClick={handleOnClick}
				className={clsx(
					'sessionsListItem',
					'sessionsListItem--groupChat',
					isChatActive && 'sessionsListItem--active'
				)}
				data-group-id={activeSession.rid ? activeSession.rid : ''}
				data-cy="session-list-item"
			>
				<div
					className={clsx(
						'sessionsListItem__content',
						isChatActive && 'sessionsListItem__content--active'
					)}
					onKeyDown={(e) => handleKeyDownListItem(e)}
					ref={itemRef}
					tabIndex={index === 0 ? 0 : -1}
					role="tab"
				>
					<div className="sessionsListItem__row">
						<div className="sessionsListItem__rowLeft">
							{activeSession.isGroup && (
								<div
									className="sessionsListItem__topic"
									style={{
										backgroundColor:
											tenantData?.theming?.primaryColor
									}}
								>
									{translate('groupChat.noTopicSpecified')}
								</div>
							)}
						</div>
						<div className="sessionsListItem__rowRight">
							{!activeSession.isGroup && (
								<div 
									className="sessionsListItem__menuIcon"
									onClick={handleMenuClick}
								>
									<MenuVerticalIcon />
								</div>
							)}
							{flyoutOpen && (
								<div className="sessionsListItem__dropdown">
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
										{!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
											type !== SESSION_LIST_TYPES.ENQUIRY &&
											activeSession.isSession && (
												<>
													{sessionListTab !== SESSION_LIST_TAB_ARCHIVE ? (
														<button
															onClick={handleArchiveSession}
															className="sessionsListItem__dropdownOption"
															type="button"
														>
															<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
															<div className="sessionsListItem__dropdownOptionCenter">
																<div className="sessionsListItem__dropdownOptionTitleRow">
																	<span className="sessionsListItem__dropdownOptionTitle">
																		{translate('chatFlyout.archive') || 'Archiviere Chat'}
																	</span>
																	<kbd className="sessionsListItem__dropdownOptionShortcut">⇧A</kbd>
																</div>
																<p className="sessionsListItem__dropdownOptionDescription">
																	{translate('chatFlyout.archive.description') || 'Archivierte Benachrichtigungen sind inaktiv. Der Chat wird in 12 Monaten gelöscht.'}
																</p>
															</div>
														</button>
													) : (
														<button
															onClick={handleDearchiveSession}
															className="sessionsListItem__dropdownOption"
															type="button"
														>
															<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
															<div className="sessionsListItem__dropdownOptionCenter">
																<div className="sessionsListItem__dropdownOptionTitleRow">
																	<span className="sessionsListItem__dropdownOptionTitle">
																		{translate('chatFlyout.dearchive') || 'Dearchivieren'}
																	</span>
																	<kbd className="sessionsListItem__dropdownOptionShortcut">⇧A</kbd>
																</div>
																<p className="sessionsListItem__dropdownOptionDescription">
																	{translate('chatFlyout.dearchive.description') || 'Chat aus dem Archiv wiederherstellen.'}
																</p>
															</div>
														</button>
													)}
												</>
											)}
										<button
											className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
											type="button"
											disabled
										>
											<BellOffIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
														Stummschalten
													</span>
													<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ö</kbd>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
													Deaktiviere Benachrichtigungen für diesen Chat.
												</p>
											</div>
										</button>
										<button
											className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
											type="button"
											disabled
										>
											<HelpIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
														Hilfe Anfragen
													</span>
													<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ä</kbd>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
													Eskaliere den Fall intern oder extern ohne den Datenschutz zu vernachlässigen.
												</p>
											</div>
										</button>
									</div>
									<div className="sessionsListItem__dropdownDivider" />
									<div className="sessionsListItem__dropdownContent">
										<button
											className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
											type="button"
											disabled
										>
											<PlusIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
														Weitere Personen einladen
													</span>
													<kbd className="sessionsListItem__dropdownOptionShortcut">⇧I</kbd>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
													Wer eingeladen werden kann, hängt von den Admin-Einstellungen ab.
												</p>
											</div>
										</button>
										<button
											className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
											type="button"
											disabled
										>
											<PackageIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
														Chat Zusammenfassen
													</span>
													<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ü</kbd>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
													Spare Zeit, mit Hilfe unseres vollends Datenschutzkonformen KI Workflows.
												</p>
											</div>
										</button>
										{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
											type !== SESSION_LIST_TYPES.ENQUIRY &&
											activeSession.isSession && (
												<DeleteSession
													chatId={activeSession.item.id}
													onSuccess={onSuccessDeleteSession}
												>
													{(onClick) => (
														<button
															onClick={() => {
																setFlyoutOpen(false);
																onClick();
															}}
															className="sessionsListItem__dropdownOption"
															type="button"
														>
															<TrashIcon className="sessionsListItem__dropdownOptionIcon" />
															<div className="sessionsListItem__dropdownOptionCenter">
																<div className="sessionsListItem__dropdownOptionTitleRow">
																	<span className="sessionsListItem__dropdownOptionTitle">
																		{translate('chatFlyout.remove') || 'Löschen'}
																	</span>
																	<kbd className="sessionsListItem__dropdownOptionShortcut">⇧D</kbd>
																</div>
																<p className="sessionsListItem__dropdownOptionDescription">
																	{translate('chatFlyout.remove.description') || 'Chat dauerhaft löschen.'}
																</p>
															</div>
														</button>
													)}
												</DeleteSession>
											)}
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="sessionsListItem__row">
					<div className="sessionInfo__groupIcon">
					<div className="sessionsListItem__stackedAvatars">
	{/* Always render 2 avatar placeholders */}
	{[0, 1].map((_, index) => (
		<div
			key={index}
			className="sessionsListItem__avatarWrapper"
		>
			<UserAvatar
				username={`placeholder-${index}`}
				displayName="User"
				userId={`placeholder-${index}`}
				size="32px"
			/>
		</div>
	))}

	{/* Optional third circle */}
	<div className="sessionsListItem__avatarWrapper sessionsListItem__avatarWrapper--plus">
		<div className="sessionsListItem__plusAvatar">+1</div>
	</div>
</div>

						</div>
						<div
							className={clsx(
								'sessionsListItem__username',
								activeSession.item.messagesRead &&
									'sessionsListItem__username--readLabel'
							)}
						>
							{typeof activeSession.item.topic === "string" ? activeSession.item.topic : activeSession.item.topic?.name || ""}
						</div>
					</div>
					<div className="sessionsListItem__row">
						<SessionListItemLastMessage
							lastMessage={
								plainTextLastMessage
									? plainTextLastMessage
									: defaultSubjectText
							}
						/>
						{activeSession.item.attachment && (
							<SessionListItemAttachment
								attachment={activeSession.item.attachment}
							/>
						)}
						<div className="sessionsListItem__consultingTypeIcon">
							<img
								src={teamImage}
								alt="Team Beratung"
								className="sessionsListItem__consultingTypeIcon--team"
							/>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const hasConsultantData = !!activeSession.consultant;
	let sessionTopic = '';

	if (isAsker) {
		if (hasConsultantData) {
			sessionTopic =
				activeSession.consultant.displayName ||
				activeSession.consultant.username;
		} else if (activeSession.isEmptyEnquiry) {
			sessionTopic = translate('sessionList.user.writeEnquiry');
		} else {
			sessionTopic = translate('sessionList.user.consultantUnknown');
		}
	} else {
		sessionTopic = activeSession.user.username;
	}

	return (
		<div
			onClick={handleOnClick}
			className={clsx(
				`sessionsListItem`,
				isChatActive && `sessionsListItem--active`
			)}
			data-group-id={activeSession.item.groupId}
			data-cy="session-list-item"
		>
			<div
				className="sessionsListItem__content"
				onKeyDown={(e) => handleKeyDownListItem(e)}
				ref={itemRef}
				tabIndex={index === 0 ? 0 : -1}
				role="tab"
			>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						{topic?.name && (
							<div
								className="sessionsListItem__topic"
								style={{
									backgroundColor:
										tenantData?.theming?.primaryColor
								}}
							>
								{topic.name}
							</div>
						)}
						<div className="sessionsListItem__consultingType">
							{!isAsker && !autoSelectPostcode
								? activeSession.item.postcode
								: null}
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">
							{prettyPrintDate(
								activeSession.item.messageDate,
								activeSession.item.createDate
							)}
						</div>
						{!activeSession.isGroup && (
							<>
								<div 
									ref={menuIconRef}
									className="sessionsListItem__menuIcon"
									onClick={handleMenuClick}
								>
									<MenuVerticalIcon />
								</div>
								{flyoutOpen && createPortal(
									<div 
										className="sessionsListItem__dropdown"
										style={{
											top: dropdownPosition.top > 0 ? `${dropdownPosition.top}px` : '40px',
											left: dropdownPosition.left > 0 ? `${dropdownPosition.left}px` : 'auto',
											right: 'auto',
											zIndex: 999999
										}}
									>
										<div className="sessionsListItem__dropdownHeader">
											<p className="sessionsListItem__dropdownSubtitle">
												{translate('groupChat.info.settings.subtitle')}
											</p>
											<h1 className="sessionsListItem__dropdownTitle">
												{translate('groupChat.info.settings.headline')}
											</h1>
										</div>
										<div className="sessionsListItem__dropdownDivider" />
										<div className="sessionsListItem__dropdownContent">
											{!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
												type !== SESSION_LIST_TYPES.ENQUIRY &&
												activeSession.isSession && (
													<>
														{sessionListTab !== SESSION_LIST_TAB_ARCHIVE ? (
															<button
																onClick={handleArchiveSession}
																className="sessionsListItem__dropdownOption"
																type="button"
															>
																<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
																<div className="sessionsListItem__dropdownOptionCenter">
																	<div className="sessionsListItem__dropdownOptionTitleRow">
																		<span className="sessionsListItem__dropdownOptionTitle">
																			{translate('chatFlyout.archive')}
																		</span>
																		<kbd className="sessionsListItem__dropdownOptionShortcut">⇧A</kbd>
																	</div>
																	<p className="sessionsListItem__dropdownOptionDescription">
																		{translate('chatFlyout.archiveDescription')}
																	</p>
																</div>
															</button>
														) : (
															<button
																onClick={handleDearchiveSession}
																className="sessionsListItem__dropdownOption"
																type="button"
															>
																<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
																<div className="sessionsListItem__dropdownOptionCenter">
																	<div className="sessionsListItem__dropdownOptionTitleRow">
																		<span className="sessionsListItem__dropdownOptionTitle">
																			{translate('chatFlyout.dearchive')}
																		</span>
																		<kbd className="sessionsListItem__dropdownOptionShortcut">⇧A</kbd>
																	</div>
																	<p className="sessionsListItem__dropdownOptionDescription">
																		{translate('chatFlyout.dearchiveDescription')}
																	</p>
																</div>
															</button>
														)}
													</>
												)}
											{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
												type !== SESSION_LIST_TYPES.ENQUIRY &&
												activeSession.isSession && (
													<button
														className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
														type="button"
														disabled
													>
														<TrashIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
														<div className="sessionsListItem__dropdownOptionCenter">
															<div className="sessionsListItem__dropdownOptionTitleRow">
																<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
																	{translate('chatFlyout.remove')}
																</span>
																<kbd className="sessionsListItem__dropdownOptionShortcut">⇧D</kbd>
															</div>
															<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
																{translate('chatFlyout.removeDescription')}
															</p>
														</div>
													</button>
												)}
											<button
												className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
												type="button"
												disabled
											>
												<BellOffIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
															{translate('chatFlyout.mute')}
														</span>
														<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ö</kbd>
													</div>
													<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
														{translate('chatFlyout.muteDescription')}
													</p>
												</div>
											</button>
											<button
												className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
												type="button"
												disabled
											>
												<HelpIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
															{translate('chatFlyout.help')}
														</span>
														<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ä</kbd>
													</div>
													<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
														{translate('chatFlyout.helpDescription')}
													</p>
												</div>
											</button>
										</div>
										<div className="sessionsListItem__dropdownDivider" />
										<div className="sessionsListItem__dropdownContent">
											<button
												className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
												type="button"
												disabled
											>
												<PlusIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
															{translate('chatFlyout.invite')}
														</span>
														<kbd className="sessionsListItem__dropdownOptionShortcut">⇧I</kbd>
													</div>
													<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
														{translate('chatFlyout.inviteDescription')}
													</p>
												</div>
											</button>
											<button
												className="sessionsListItem__dropdownOption sessionsListItem__dropdownOption--disabled"
												type="button"
												disabled
											>
												<PackageIcon className="sessionsListItem__dropdownOptionIcon sessionsListItem__dropdownOptionIcon--disabled" />
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle sessionsListItem__dropdownOptionTitle--disabled">
															{translate('chatFlyout.summarize')}
														</span>
														<kbd className="sessionsListItem__dropdownOptionShortcut">⇧Ü</kbd>
													</div>
													<p className="sessionsListItem__dropdownOptionDescription sessionsListItem__dropdownOptionDescription--disabled">
														{translate('chatFlyout.summarizeDescription')}
													</p>
												</div>
											</button>
										</div>
									</div>,
									document.body
								)}
							</>
						)}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__icon">
						{isAsker && !hasConsultantData ? (
							<ConsultantSearchLoader size="32px" />
						) : (
							<UserAvatar
								username={activeSession.user?.username || activeSession.consultant?.username || 'User'}
								displayName={activeSession.user?.username || activeSession.consultant?.displayName}
								userId={activeSession.user?.username || activeSession.consultant?.id || 'unknown'}
								size="32px"
							/>
						)}
					</div>
					<div
						className={clsx(
							'sessionsListItem__username',
							activeSession.item.messagesRead &&
								'sessionsListItem__username--readLabel'
						)}
					>
						{sessionTopic}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<SessionListItemLastMessage
						lastMessage={plainTextLastMessage}
						lastMessageType={activeSession.item.lastMessageType}
						language={language}
						showLanguage={
							language &&
							activeSession.isEnquiry &&
							!activeSession.isEmptyEnquiry
						}
						showSpan={activeSession.isEmptyEnquiry}
					/>
					{activeSession.item.attachment && (
						<SessionListItemAttachment
							attachment={activeSession.item.attachment}
						/>
					)}
					{activeSession.item.videoCallMessageDTO && (
						<SessionListItemVideoCall
							videoCallMessage={
								activeSession.item.videoCallMessageDTO
							}
							listItemUsername={
								activeSession.user?.username ||
								activeSession.consultant?.username
							}
							listItemAskerRcId={activeSession.item.askerRcId}
						/>
					)}
					<div className="sessionsListItem__consultingTypeIcon">
						<img
							src={activeSession.isGroup ? teamImage : oneOnOneImage}
							alt={activeSession.isGroup ? 'Team Beratung' : '1-1 Beratung'}
							className={activeSession.isGroup ? 'sessionsListItem__consultingTypeIcon--team' : 'sessionsListItem__consultingTypeIcon--oneOnOne'}
						/>
					</div>
				</div>
			</div>
			{overlayActive && overlayItem && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};