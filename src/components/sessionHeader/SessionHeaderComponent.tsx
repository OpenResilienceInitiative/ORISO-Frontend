import * as React from 'react';
import { useContext, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useHistory } from 'react-router-dom';
import clsx from 'clsx';
import { handleNumericTranslation } from '../../utils/translate';
import { isMatrixRoomId } from '../../utils/isMatrixSession';
import { mobileListView } from '../app/navigationHandler';
import { apiDeleteSessionAndUser } from '../../api/apiDeleteSessionAndUser';
import { apiFinishAnonymousConversation } from '../../api/apiFinishAnonymousConversation';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	apiGetSessionSupervisors,
	SessionSupervisor
} from '../../api/apiGetSessionSupervisors';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';
import {
	apiGetAgencyConsultantList,
	Consultant
} from '../../api/apiGetAgencyConsultantList';
import { apiSendMessage } from '../../api/apiSendMessage';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_SUCCESS,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext,
	SessionsDataContext,
	REMOVE_SESSIONS
} from '../../globalState';
import {
	SessionConsultantInterface,
	TopicSessionInterface
} from '../../globalState/interfaces';
import {
	getViewPathForType,
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import { SessionMenu } from '../sessionMenu/SessionMenu';
import {
	finishAnonymousChatErrorOverlayItem,
	finishAnonymousChatSecurityOverlayItem,
	finishAnonymousChatSuccessOverlayItem,
	finishAnonymousChatConsultantSecurityOverlayItem,
	finishAnonymousChatConsultantSuccessOverlayItem
} from '../sessionMenu/sessionMenuHelpers';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { logout } from '../logout/logout';
import { appConfig } from '../../utils/appConfig';
import {
	convertUserDataObjectToArray,
	getUserDataTranslateBase
} from '../profile/profileHelpers';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { UserAvatar } from '../message/UserAvatar';
import { ConsultantSearchLoader } from './ConsultantSearchLoader';
import './sessionHeader.styles';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';
import { GroupChatHeader } from './GroupChatHeader';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useResponsive } from '../../hooks/useResponsive';
import { useTopic } from '../../globalState';
import { SelectDropdown, SelectDropdownItem } from '../select/SelectDropdown';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { ReactComponent as CloseCircle } from '../../resources/img/icons/close-circle.svg';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { messageEventEmitter } from '../../services/messageEventEmitter';
export interface SessionHeaderProps {
	consultantAbsent?: SessionConsultantInterface;
	hasUserInitiatedStopOrLeaveRequest?: React.MutableRefObject<boolean>;
	isJoinGroupChatView?: boolean;
	bannedUsers: string[];
}

export const SessionHeaderComponent = (props: SessionHeaderProps) => {
	const { t: translate } = useTranslation([
		'common',
		'consultingTypes',
		'agencies'
	]);
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const sessionsDataContext = useContext(SessionsDataContext);
	const { addNotification, addEventNotification } =
		useContext(NotificationsContext);
	const history = useHistory();
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const topic = useTopic(
		(activeSession.item.topic as TopicSessionInterface).id
	);
	const settings = useAppConfig();
	const { untilL } = useResponsive();
	const {
		featureSupervisionEnabled = true,
		featureSupervisionAnonymousChatsEnabled = true,
		featureSupervisionOneOnOneChatsEnabled = true
	} = getTenantSettings();

	const contact = getContact(activeSession);
	const userSessionData = contact?.sessionData;

	const removeSessionFromSidebar = useCallback(
		(sessionId: number) => {
			sessionsDataContext?.dispatch({
				type: REMOVE_SESSIONS,
				ids: [sessionId]
			});
			messageEventEmitter.emit({
				refreshEnquiryList: true,
				refreshSessionList: true,
				sessionId
			});
			messageEventEmitter.emit({ sessionId });
		},
		[sessionsDataContext]
	);

	// Check if this is an anonymous chat
	const isAnonymousChat =
		activeSession.item.postcode === 0 ||
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-');
	const isSupervisionEnabledForCurrentChat =
		featureSupervisionEnabled !== false &&
		(isAnonymousChat
			? featureSupervisionAnonymousChatsEnabled !== false
			: featureSupervisionOneOnOneChatsEnabled !== false);

	// Check if current user is a supervisor (read-only observer, not the assigned consultant)
	const isSupervisor =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		activeSession.consultant?.id &&
		activeSession.consultant.id !== userData.userId;

	// State for delete account button
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [isAccountDeleted, setIsAccountDeleted] = useState(false);

	// State for anonymous asker end-chat flow
	const [isEndChatOverlayActive, setIsEndChatOverlayActive] = useState(false);
	const [endChatOverlayItem, setEndChatOverlayItem] =
		useState<OverlayItem | null>(null);
	const [isFinishingChat, setIsFinishingChat] = useState(false);
	const [isChatFinished, setIsChatFinished] = useState(false);

	// State for supervisor management
	const [supervisors, setSupervisors] = useState<SessionSupervisor[]>([]);
	const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
	const [availableConsultants, setAvailableConsultants] = useState<
		Consultant[]
	>([]);
	const [allConsultants, setAllConsultants] = useState<Consultant[]>([]); // All consultants for name lookup
	const [isLoadingConsultants, setIsLoadingConsultants] = useState(false);
	const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);
	const [selectedConsultantId, setSelectedConsultantId] =
		useState<string>('');
	const [supervisionReason, setSupervisionReason] = useState<string>('');
	const [supervisionReasonError, setSupervisionReasonError] = useState(false);
	const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);

	// Prepare SelectDropdown for consultant selection
	const consultantSelectDropdown = React.useMemo<SelectDropdownItem>(
		() => ({
			id: 'supervisor-consultant-select',
			selectedOptions: availableConsultants.map((consultant) => ({
				value: consultant.consultantId,
				label: `${consultant.firstName} ${consultant.lastName}`
			})),
			defaultValue: selectedConsultantId
				? {
						value: selectedConsultantId,
						label: availableConsultants.find(
							(c) => c.consultantId === selectedConsultantId
						)
							? `${availableConsultants.find((c) => c.consultantId === selectedConsultantId).firstName} ${availableConsultants.find((c) => c.consultantId === selectedConsultantId).lastName}`
							: ''
					}
				: null,
			handleDropdownSelect: (selectedOption) => {
				setSelectedConsultantId(
					selectedOption ? selectedOption.value : ''
				);
			},
			selectInputLabel: translate(
				'sessionHeader.supervisor.modal.selectConsultant',
				'Berater auswählen...'
			),
			isSearchable: true,
			menuPlacement: 'bottom',
			styleOverrides: {
				control: (styles) => ({
					...styles,
					width: '100%'
				}),
				menu: (styles) => ({
					...styles,
					width: '100%'
				})
			}
		}),
		[availableConsultants, selectedConsultantId, translate]
	);

	// Prepare Button for add supervisor
	const addSupervisorButton: ButtonItem = React.useMemo(
		() => ({
			label: isAddingSupervisor
				? translate(
						'sessionHeader.supervisor.modal.adding',
						'Hinzufügen...'
					)
				: translate(
						'sessionHeader.supervisor.modal.addButton',
						'Hinzufügen'
					),
			function: '',
			type: BUTTON_TYPES.PRIMARY,
			disabled: !selectedConsultantId || isAddingSupervisor
		}),
		[selectedConsultantId, isAddingSupervisor, translate]
	);

	const preparedUserSessionData =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		userSessionData
			? convertUserDataObjectToArray(userSessionData)
			: null;
	const translateBase = getUserDataTranslateBase(
		activeSession.item.consultingType
	);

	const [isSubscriberFlyoutOpen, setIsSubscriberFlyoutOpen] = useState(false);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const { type, path: listPath } = useContext(SessionTypeContext);

	useEffect(() => {
		if (isSubscriberFlyoutOpen) {
			document.addEventListener('mousedown', (event) =>
				handleWindowClick(event)
			);
		}
	}, [isSubscriberFlyoutOpen]);

	// Load supervisors when component mounts or session changes
	useEffect(() => {
		if (!isSupervisionEnabledForCurrentChat) {
			setSupervisors([]);
			setIsSupervisorModalOpen(false);
			return;
		}
		if (
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
			activeSession.item.id
		) {
			loadSupervisors();
		}
	}, [activeSession.item.id, userData, isSupervisionEnabledForCurrentChat]); // eslint-disable-line react-hooks/exhaustive-deps

	// Load available consultants when modal opens
	useEffect(() => {
		if (!isSupervisionEnabledForCurrentChat) {
			setIsSupervisorModalOpen(false);
			return;
		}
		if (isSupervisorModalOpen) {
			const agencyId =
				activeSession.agency?.id || activeSession.item?.agencyId;
			if (agencyId) {
				loadAvailableConsultants();
			} else {
				// console.warn('Cannot load consultants: No agency ID in session');
			}
		}
	}, [
		isSupervisorModalOpen,
		activeSession.agency?.id,
		activeSession.item?.agencyId,
		isSupervisionEnabledForCurrentChat
	]); // eslint-disable-line react-hooks/exhaustive-deps

	const loadSupervisors = async () => {
		if (!isSupervisionEnabledForCurrentChat) {
			setSupervisors([]);
			return;
		}
		if (!activeSession.item.id) return;
		setIsLoadingSupervisors(true);
		try {
			const data = await apiGetSessionSupervisors(activeSession.item.id);
			setSupervisors(data);
			// Also load consultants to get names for supervisors
			const agencyId =
				activeSession.agency?.id || activeSession.item?.agencyId;
			if (agencyId) {
				try {
					const consultants = await apiGetAgencyConsultantList(
						agencyId.toString()
					);
					const uniqueConsultants = dedupeConsultants(consultants);
					setAllConsultants(uniqueConsultants); // Store all consultants for name lookup
					// Filter: only supervisors, exclude current user and already added supervisors
					const supervisorIds = data.map(
						(s) => s.supervisorConsultantId
					);
					const filtered = uniqueConsultants.filter(
						(c) =>
							c.isSupervisor === true &&
							c.consultantId !== userData.userId &&
							!supervisorIds.includes(c.consultantId)
					);
					setAvailableConsultants(filtered);
				} catch (err) {
					// console.error('Failed to load consultants for supervisor names:', err);
				}
			}
		} catch (error) {
			// console.error('Failed to load supervisors:', error);
		} finally {
			setIsLoadingSupervisors(false);
		}
	};

	// Helper function to get consultant name from supervisor
	const getSupervisorName = (supervisor: SessionSupervisor): string => {
		// Use allConsultants (unfiltered) to find the supervisor's name
		const consultant = allConsultants.find(
			(c) => c.consultantId === supervisor.supervisorConsultantId
		);
		if (consultant) {
			return `${consultant.firstName} ${consultant.lastName}`;
		}
		// Fallback to username if consultant not found (shouldn't happen, but just in case)
		return (
			supervisor.supervisorUsername || supervisor.supervisorConsultantId
		);
	};

	const dedupeConsultants = (consultants: Consultant[]): Consultant[] => {
		const uniqueById = new Map<string, Consultant>();
		consultants.forEach((consultant) => {
			if (!uniqueById.has(consultant.consultantId)) {
				uniqueById.set(consultant.consultantId, consultant);
			}
		});
		return Array.from(uniqueById.values());
	};

	const loadAvailableConsultants = async () => {
		// Try to get agency ID from session.agency.id or session.item.agencyId
		const agencyId =
			activeSession.agency?.id || activeSession.item?.agencyId;
		if (!agencyId) {
			// console.error('No agency ID found in session:', activeSession);
			setAvailableConsultants([]);
			setIsLoadingConsultants(false);
			return;
		}
		setIsLoadingConsultants(true);
		try {
			const consultants = await apiGetAgencyConsultantList(
				agencyId.toString()
			);
			const uniqueConsultants = dedupeConsultants(consultants);
			// console.log('Loaded consultants from agency:', agencyId, uniqueConsultants);
			// Store all consultants for name lookup
			setAllConsultants(uniqueConsultants);
			// Filter: only supervisors, exclude current user and already added supervisors
			const supervisorIds = supervisors.map(
				(s) => s.supervisorConsultantId
			);
			const filtered = uniqueConsultants.filter(
				(c) =>
					c.isSupervisor === true &&
					c.consultantId !== userData.userId &&
					!supervisorIds.includes(c.consultantId)
			);
			// console.log('Filtered consultants (after removing current user and supervisors):', filtered);
			setAvailableConsultants(filtered);
		} catch (error) {
			// console.error('Failed to load consultants:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate(
					'sessionHeader.supervisor.error.loadConsultants.title',
					'Fehler'
				),
				text: translate(
					'sessionHeader.supervisor.error.loadConsultants.text',
					'Berater konnten nicht geladen werden.'
				),
				closeable: true,
				timeout: 5000
			});
		} finally {
			setIsLoadingConsultants(false);
		}
	};

	const postSupervisorAddedSystemMessage = async (supervisorName: string) => {
		const matrixRoomId = isMatrixRoomId(activeSession.rid)
			? activeSession.rid
			: activeSession.item?.matrixRoomId;
		if (!matrixRoomId || !activeSession.item.id) {
			return;
		}
		const payload = JSON.stringify({
			title: translate(
				'message.supervisionEnabledTitle',
				'Supervision Enabled!'
			),
			description: translate(
				'message.supervisionEnabledDescription',
				'{{name}} was added as a consultant supervisor to this chat.',
				{ name: supervisorName }
			)
		});
		try {
			const matrixClientService = (window as any).matrixClientService;
			const client = matrixClientService?.getClient?.();
			if (client) {
				await (client as any).sendMessage(matrixRoomId, {
					msgtype: 'm.text',
					body: `${SYSTEM_NOTIFICATION_PREFIX}${payload}`
				});
				return;
			}
			await apiSendMessage(
				`${SYSTEM_NOTIFICATION_PREFIX}${payload}`,
				activeSession.rid,
				false,
				false,
				activeSession.item.id,
				matrixRoomId,
				null,
				true,
				'system',
				null
			);
		} catch (_error) {
			// Non-blocking: supervisor add succeeded; timeline system note can fail silently.
		}
	};

	const handleAddSupervisor = async () => {
		if (!selectedConsultantId || !activeSession.item.id) return;
		if (!supervisionReason.trim()) {
			setSupervisionReasonError(true);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate(
					'sessionHeader.supervisor.error.reasonRequired.title',
					'Grund erforderlich'
				),
				text: translate(
					'sessionHeader.supervisor.error.reasonRequired.text',
					'Bitte geben Sie den Grund für die Supervision an.'
				),
				closeable: true,
				timeout: 5000
			});
			return;
		}
		setIsAddingSupervisor(true);
		const selectedSupervisor = allConsultants.find(
			(c) => c.consultantId === selectedConsultantId
		);
		const selectedSupervisorName = selectedSupervisor
			? `${selectedSupervisor.firstName || ''} ${
					selectedSupervisor.lastName || ''
				}`.trim()
			: selectedConsultantId;
		const chatDisplayName =
			contact?.username || `Session ${activeSession.item.id}`;
		try {
			await apiAddSessionSupervisor(
				activeSession.item.id,
				selectedConsultantId,
				supervisionReason
			);
			await postSupervisorAddedSystemMessage(selectedSupervisorName);
			await loadSupervisors();
			setSelectedConsultantId('');
			setSupervisionReason('');
			setSupervisionReasonError(false);
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate(
					'sessionHeader.supervisor.success.add.title',
					'Supervisor hinzugefügt'
				),
				text: `${translate(
					'sessionHeader.supervisor.success.add.text',
					'Der Supervisor wurde erfolgreich hinzugefügt.'
				)} (${selectedSupervisorName} -> ${chatDisplayName})`,
				closeable: true,
				timeout: 5000
			});
			addEventNotification({
				type: NOTIFICATION_TYPE_SUCCESS,
				eventType: 'supervisor.added',
				title: translate(
					'sessionHeader.supervisor.success.add.title',
					'Supervisor hinzugefügt'
				),
				text: `${translate(
					'sessionHeader.supervisor.success.add.text',
					'Der Supervisor wurde erfolgreich hinzugefügt.'
				)} (${selectedSupervisorName} -> ${chatDisplayName})`,
				actionPath: history.location.pathname + history.location.search,
				actionLabel: translate(
					'notifications.center.open',
					'Open chat'
				),
				sourceSessionId: activeSession.item.id,
				category: 'system'
			});
			// Reload consultants list
			await loadAvailableConsultants();
			// Close modal after successful add
			setIsSupervisorModalOpen(false);
		} catch (error) {
			// console.error('Failed to add supervisor:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate(
					'sessionHeader.supervisor.error.add.title',
					'Fehler'
				),
				text: translate(
					'sessionHeader.supervisor.error.add.text',
					'Supervisor konnte nicht hinzugefügt werden.'
				),
				closeable: true,
				timeout: 5000
			});
		} finally {
			setIsAddingSupervisor(false);
		}
	};

	const handleRemoveSupervisor = async (supervisorId: number) => {
		if (!activeSession.item.id) return;
		if (
			!window.confirm(
				translate(
					'sessionHeader.supervisor.remove.confirm',
					'Möchten Sie diesen Supervisor wirklich entfernen?'
				)
			)
		) {
			return;
		}
		const supervisorToRemove = supervisors.find(
			(s) => s.id === supervisorId
		);
		const supervisorToRemoveName = supervisorToRemove
			? getSupervisorName(supervisorToRemove)
			: String(supervisorId);
		const chatDisplayName =
			contact?.username || `Session ${activeSession.item.id}`;
		try {
			await apiRemoveSessionSupervisor(
				activeSession.item.id,
				supervisorId
			);
			await loadSupervisors();
			await loadAvailableConsultants();
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate(
					'sessionHeader.supervisor.success.remove.title',
					'Supervisor entfernt'
				),
				text: `${translate(
					'sessionHeader.supervisor.success.remove.text',
					'Der Supervisor wurde erfolgreich entfernt.'
				)} (${supervisorToRemoveName} <- ${chatDisplayName})`,
				closeable: true,
				timeout: 5000
			});
			addEventNotification({
				type: NOTIFICATION_TYPE_SUCCESS,
				eventType: 'supervisor.removed',
				title: translate(
					'sessionHeader.supervisor.success.remove.title',
					'Supervisor entfernt'
				),
				text: `${translate(
					'sessionHeader.supervisor.success.remove.text',
					'Der Supervisor wurde erfolgreich entfernt.'
				)} (${supervisorToRemoveName} <- ${chatDisplayName})`,
				actionPath: history.location.pathname + history.location.search,
				actionLabel: translate(
					'notifications.center.open',
					'Open chat'
				),
				sourceSessionId: activeSession.item.id,
				category: 'system'
			});
			// Close modal after successful remove
			setIsSupervisorModalOpen(false);
		} catch (error) {
			// console.error('Failed to remove supervisor:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate(
					'sessionHeader.supervisor.error.remove.title',
					'Fehler'
				),
				text: translate(
					'sessionHeader.supervisor.error.remove.text',
					'Supervisor konnte nicht entfernt werden.'
				),
				closeable: true,
				timeout: 5000
			});
		}
	};

	const sessionView = getViewPathForType(type);
	const userProfileLink = `/sessions/consultant/${sessionView}/${
		activeSession.item.groupId
	}/${activeSession.item.id}/userProfile${getSessionListTab()}`;

	const handleBackButton = () => {
		mobileListView();
	};

	const isConsultantUser =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
		(userData?.userRoles || []).includes('CONSULTANT');
	const isAskerUser =
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
		hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, userData) ||
		(userData?.userRoles || []).includes('USER') ||
		(userData?.userRoles || []).includes('ANONYMOUS');
	const isAnonymousAsker =
		isAnonymousChat && isAskerUser && !isConsultantUser;
	const showEndAnonymousChatButton =
		isAnonymousAsker && activeSession.isSession && !isChatFinished;
	const showConsultantEndAnonymousChatButton =
		isConsultantUser &&
		isAnonymousChat &&
		!isSupervisor &&
		!activeSession.isEnquiry &&
		activeSession.isSession &&
		!isChatFinished;

	const handleRequestEndAnonymousChat = () => {
		if (isFinishingChat || isChatFinished) {
			return;
		}
		setEndChatOverlayItem(
			showConsultantEndAnonymousChatButton
				? finishAnonymousChatConsultantSecurityOverlayItem
				: finishAnonymousChatSecurityOverlayItem
		);
		setIsEndChatOverlayActive(true);
	};

	const handleEndChatOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setIsEndChatOverlayActive(false);
			setEndChatOverlayItem(null);
			return;
		}

		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			setIsEndChatOverlayActive(false);
			setEndChatOverlayItem(null);
			if (isConsultantUser && isAnonymousChat) {
				history.push('/sessions/consultant/sessionView');
			} else {
				window.location.href = appConfig.urls.toEntry;
			}
			return;
		}

		if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			void logout();
			return;
		}

		if (buttonFunction !== OVERLAY_FUNCTIONS.FINISH_ANONYMOUS_CHAT) {
			return;
		}

		if (isFinishingChat || !activeSession.item?.id) {
			return;
		}

		setIsFinishingChat(true);
		void (async () => {
			const sessionId = activeSession.item.id;
			try {
				await apiFinishAnonymousConversation(sessionId);
				setIsChatFinished(true);
				setEndChatOverlayItem(
					showConsultantEndAnonymousChatButton
						? finishAnonymousChatConsultantSuccessOverlayItem
						: finishAnonymousChatSuccessOverlayItem
				);
				if (isConsultantUser) {
					removeSessionFromSidebar(sessionId);
				}
			} catch (error: unknown) {
				if (
					error instanceof Error &&
					error.message === FETCH_ERRORS.CONFLICT
				) {
					setIsChatFinished(true);
					setEndChatOverlayItem(
						showConsultantEndAnonymousChatButton
							? finishAnonymousChatConsultantSuccessOverlayItem
							: finishAnonymousChatSuccessOverlayItem
					);
					if (isConsultantUser) {
						removeSessionFromSidebar(sessionId);
					}
					return;
				}
				setEndChatOverlayItem(finishAnonymousChatErrorOverlayItem);
			} finally {
				setIsFinishingChat(false);
			}
		})();
	};

	const handleDeleteAnonymousAccount = async () => {
		if (isAccountDeleted || isDeletingAccount) {
			return;
		}

		if (
			!window.confirm(
				translate(
					'sessionHeader.anonymous.deleteAccount.confirm',
					'Möchten Sie das Konto dieses anonymen Benutzers wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
				)
			)
		) {
			return;
		}

		setIsDeletingAccount(true);
		try {
			const deletedSessionId = activeSession.item.id;
			await apiDeleteSessionAndUser(deletedSessionId);
			setIsAccountDeleted(true);
			removeSessionFromSidebar(deletedSessionId);
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate(
					'sessionHeader.anonymous.deleteAccount.success.title',
					'Konto gelöscht'
				),
				text: `${translate(
					'sessionHeader.anonymous.deleteAccount.success.text',
					'Das anonyme Benutzerkonto wurde erfolgreich gelöscht.'
				)} (${contact?.username || 'Anonymous'} | Session ${activeSession.item.id})`,
				closeable: true,
				timeout: 5000
			});
			addEventNotification({
				type: NOTIFICATION_TYPE_SUCCESS,
				eventType: 'anonymous.account.deleted',
				title: translate(
					'sessionHeader.anonymous.deleteAccount.success.title',
					'Konto gelöscht'
				),
				text: `${translate(
					'sessionHeader.anonymous.deleteAccount.success.text',
					'Das anonyme Benutzerkonto wurde erfolgreich gelöscht.'
				)} (${contact?.username || 'Anonymous'} | Session ${activeSession.item.id})`,
				actionPath: listPath + getSessionListTab(),
				actionLabel: translate(
					'notifications.center.open',
					'Open chat'
				),
				sourceSessionId: activeSession.item.id,
				category: 'system'
			});
			setTimeout(() => {
				history.push(listPath + getSessionListTab());
			}, 2000);
		} catch (error) {
			setIsDeletingAccount(false);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate(
					'sessionHeader.anonymous.deleteAccount.error.title',
					'Fehler beim Löschen'
				),
				text: translate(
					'sessionHeader.anonymous.deleteAccount.error.text',
					'Das Konto konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
				),
				closeable: true,
				timeout: 5000
			});
		}
	};

	const handleWindowClick = (event) => {
		const flyoutElement = document.querySelector(
			'.sessionInfo__metaInfo__flyout'
		);
		if (
			flyoutElement &&
			!flyoutElement.contains(event.target) &&
			event.target.id !== 'subscriberButton'
		) {
			setIsSubscriberFlyoutOpen(false);
		}
	};

	const enquiryUserProfileCondition =
		typeof settings?.user?.profile?.visibleOnEnquiry === 'function'
			? settings.user.profile.visibleOnEnquiry(userSessionData ?? {})
			: settings?.user?.profile?.visibleOnEnquiry;

	const isAskerInfoAvailable = () =>
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		consultingType?.showAskerProfile &&
		activeSession.isSession &&
		((type === SESSION_LIST_TYPES.ENQUIRY && enquiryUserProfileCondition) ||
			SESSION_LIST_TYPES.ENQUIRY !== type);

	if (activeSession.isGroup) {
		return (
			<GroupChatHeader
				hasUserInitiatedStopOrLeaveRequest={
					props.hasUserInitiatedStopOrLeaveRequest
				}
				isJoinGroupChatView={props.isJoinGroupChatView}
				bannedUsers={props.bannedUsers}
			/>
		);
	}

	return (
		<div className="sessionInfo">
			<div className="sessionInfo__headerWrapper">
				<Link
					to={listPath + getSessionListTab()}
					onClick={handleBackButton}
					className="sessionInfo__backButton"
				>
					<BackIcon />
				</Link>
				<div
					className={clsx('sessionInfo__username', {
						'sessionInfo__username--deactivate':
							!isAskerInfoAvailable()
					})}
				>
					{(() => {
						/* Just the "+" on the avatar stack is the supervisor
						   "add / manage" trigger for 1-on-1 chats (normal +
						   anonymous). The avatar itself is NOT clickable —
						   only the plus. Visibility conditions mirror the
						   old Supervision On/Off pill: feature flag on for
						   this chat type, caller is a consultant, session is
						   1-on-1, not enquiry, not viewed by a supervisor.
						   Mobile keeps the existing session-menu entry;
						   this wires only the desktop plus. */
						const canOpenSupervisorModal =
							isSupervisionEnabledForCurrentChat &&
							hasUserAuthority(
								AUTHORITIES.CONSULTANT_DEFAULT,
								userData
							) &&
							!activeSession.isGroup &&
							!isSupervisor &&
							!activeSession.isEnquiry &&
							!untilL;
						return (
							<div className="sessionInfo__memberStack">
								{canOpenSupervisorModal && (
									<button
										type="button"
										className="sessionInfo__memberStackPlus sessionInfo__memberStackPlus--interactive"
										aria-label={translate(
											'sessionHeader.supervisor.modal.title',
											'Supervisor hinzufügen'
										)}
										onClick={() =>
											setIsSupervisorModalOpen(true)
										}
									>
										<svg
											width="32"
											height="32"
											viewBox="0 0 32 32"
											fill="none"
											aria-hidden="true"
										>
											<path
												d="M15.167 16.8333H10.167V15.1666H15.167V10.1666H16.8337V15.1666H21.8337V16.8333H16.8337V21.8333H15.167V16.8333Z"
												fill="#CC1E1C"
												fillOpacity="0.6"
											/>
										</svg>
									</button>
								)}
								<div className="sessionInfo__memberBubble">
									{hasUserAuthority(
										AUTHORITIES.ASKER_DEFAULT,
										userData
									) && !activeSession.consultant ? (
										<ConsultantSearchLoader size="32px" />
									) : (
										<UserAvatar
											username={
												contact?.username || 'User'
											}
											displayName={contact?.displayName}
											userId={
												contact?.username || 'unknown'
											}
											size="32px"
										/>
									)}
								</div>
							</div>
						);
					})()}
					{hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) && (
						<h3>
							{contact?.displayName ||
								contact?.username ||
								translate('sessionList.user.consultantUnknown')}
						</h3>
					)}
					{hasUserAuthority(
						AUTHORITIES.CONSULTANT_DEFAULT,
						userData
					) ? (
						isAskerInfoAvailable() ? (
							<Link to={userProfileLink}>
								<h3>
									{contact?.username ||
										translate(
											'sessionList.user.consultantUnknown'
										)}
								</h3>
							</Link>
						) : (
							<h3>
								{contact?.username ||
									translate(
										'sessionList.user.consultantUnknown'
									)}
							</h3>
						)
					) : null}
				</div>
				{/* End Chat for anonymous askers (waiting room or active chat) */}
				{showEndAnonymousChatButton && (
					<button
						type="button"
						onClick={handleRequestEndAnonymousChat}
						disabled={isFinishingChat}
						className="sessionInfo__endChatButton"
						data-cy="session-header-end-anonymous-chat"
					>
						{isFinishingChat
							? translate(
									'sessionHeader.anonymous.endChat.ending',
									'Ending…'
								)
							: translate(
									'sessionHeader.anonymous.endChat.label',
									'End chat'
								)}
					</button>
				)}
				{/* End Chat for consultants in anonymous live chat */}
				{showConsultantEndAnonymousChatButton && !untilL && (
					<button
						type="button"
						onClick={handleRequestEndAnonymousChat}
						disabled={isFinishingChat}
						className="sessionInfo__endChatButton"
						data-cy="session-header-end-anonymous-chat-consultant"
					>
						{isFinishingChat
							? translate(
									'sessionHeader.anonymous.endChat.ending',
									'Ending…'
								)
							: translate(
									'sessionHeader.anonymous.endChat.consultant.label',
									'End chat'
								)}
					</button>
				)}
				{/* Delete Account Button for Consultants viewing Anonymous Chats (not supervisors, not during enquiry) */}
				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
					isAnonymousChat &&
					!isSupervisor &&
					!activeSession.isEnquiry &&
					!untilL && (
						<button
							onClick={handleDeleteAnonymousAccount}
							disabled={isAccountDeleted || isDeletingAccount}
							style={{
								padding: '8px 16px',
								marginRight: '20px',
								borderRadius: '20px', // Oval button
								border: 'none',
								backgroundColor: isAccountDeleted
									? '#9e9e9e'
									: '#c62828',
								color: 'white',
								fontSize: '14px',
								fontWeight: '500',
								cursor:
									isAccountDeleted || isDeletingAccount
										? 'not-allowed'
										: 'pointer',
								opacity:
									isAccountDeleted || isDeletingAccount
										? 0.6
										: 1,
								transition: 'all 0.3s ease',
								marginLeft: '12px'
							}}
						>
							{isAccountDeleted
								? translate(
										'sessionHeader.anonymous.deleteAccount.deleted',
										'Gelöscht'
									)
								: isDeletingAccount
									? translate(
											'sessionHeader.anonymous.deleteAccount.deleting',
											'Löschen...'
										)
									: translate(
											'sessionHeader.anonymous.deleteAccount.label',
											'Konto löschen'
										)}
						</button>
					)}
				{/* Supervisor Management Button replaced by the "+" overlay on
				    the avatar stack above. Keeping the render behind a hard
				    `false` preserves the original markup for reference without
				    surfacing a duplicate entry point. */}
				{false &&
					isSupervisionEnabledForCurrentChat &&
					hasUserAuthority(
						AUTHORITIES.CONSULTANT_DEFAULT,
						userData
					) &&
					!activeSession.isGroup &&
					!isSupervisor &&
					!activeSession.isEnquiry &&
					!untilL && (
						<button
							onClick={() => setIsSupervisorModalOpen(true)}
							className="sessionInfo__supervisionButton"
						>
							<span
								className="sessionInfo__supervisionIcon"
								aria-hidden="true"
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
								>
									<path
										d="M8.3 17.8C9.05 16.2833 10.05 15.2708 11.3 14.7625C12.55 14.2542 13.6167 14 14.5 14C14.8833 14 15.2583 14.0333 15.625 14.1C15.9917 14.1667 16.35 14.25 16.7 14.35C17.1 13.7167 17.4167 13.0333 17.65 12.3C17.8833 11.5667 18 10.8 18 10C18 7.76667 17.225 5.875 15.675 4.325C14.125 2.775 12.2333 2 10 2C7.76667 2 5.875 2.775 4.325 4.325C2.775 5.875 2 7.76667 2 10C2 10.75 2.09583 11.4667 2.2875 12.15C2.47917 12.8333 2.76667 13.4667 3.15 14.05C3.83333 13.7167 4.54167 13.4583 5.275 13.275C6.00833 13.0917 6.75 13 7.5 13C8.03333 13 8.54583 13.0458 9.0375 13.1375C9.52917 13.2292 10.0167 13.35 10.5 13.5C10.1167 13.7 9.75417 13.9333 9.4125 14.2C9.07083 14.4667 8.75 14.75 8.45 15.05C8.25 15.0167 8.07917 15 7.9375 15H7.5C6.96667 15 6.4375 15.0583 5.9125 15.175C5.3875 15.2917 4.88333 15.4667 4.4 15.7C4.93333 16.2333 5.52917 16.6792 6.1875 17.0375C6.84583 17.3958 7.55 17.65 8.3 17.8ZM6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20C8.61667 20 7.31667 19.7375 6.1 19.2125ZM5.025 10.475C4.34167 9.79167 4 8.96667 4 8C4 7.03333 4.34167 6.20833 5.025 5.525C5.70833 4.84167 6.53333 4.5 7.5 4.5C8.46667 4.5 9.29167 4.84167 9.975 5.525C10.6583 6.20833 11 7.03333 11 8C11 8.96667 10.6583 9.79167 9.975 10.475C9.29167 11.1583 8.46667 11.5 7.5 11.5C6.53333 11.5 5.70833 11.1583 5.025 10.475ZM8.5625 9.0625C8.85417 8.77083 9 8.41667 9 8C9 7.58333 8.85417 7.22917 8.5625 6.9375C8.27083 6.64583 7.91667 6.5 7.5 6.5C7.08333 6.5 6.72917 6.64583 6.4375 6.9375C6.14583 7.22917 6 7.58333 6 8C6 8.41667 6.14583 8.77083 6.4375 9.0625C6.72917 9.35417 7.08333 9.5 7.5 9.5C7.91667 9.5 8.27083 9.35417 8.5625 9.0625ZM12.725 11.775C12.2417 11.2917 12 10.7 12 10C12 9.3 12.2417 8.70833 12.725 8.225C13.2083 7.74167 13.8 7.5 14.5 7.5C15.2 7.5 15.7917 7.74167 16.275 8.225C16.7583 8.70833 17 9.3 17 10C17 10.7 16.7583 11.2917 16.275 11.775C15.7917 12.2583 15.2 12.5 14.5 12.5C13.8 12.5 13.2083 12.2583 12.725 11.775Z"
										fill="#1C1B1F"
									/>
								</svg>
							</span>
							<span>
								{supervisors.length > 0
									? translate(
											'sessionHeader.supervisor.status.on',
											'Supervision On'
										)
									: translate(
											'sessionHeader.supervisor.status.off',
											'Supervision Off'
										)}
							</span>
						</button>
					)}
				<SessionMenu
					hasUserInitiatedStopOrLeaveRequest={
						props.hasUserInitiatedStopOrLeaveRequest
					}
					isAskerInfoAvailable={isAskerInfoAvailable()}
					bannedUsers={props.bannedUsers}
					isSupervisor={isSupervisor}
					showMobileSupervisionAction={
						untilL &&
						isSupervisionEnabledForCurrentChat &&
						hasUserAuthority(
							AUTHORITIES.CONSULTANT_DEFAULT,
							userData
						) &&
						!activeSession.isGroup &&
						!isSupervisor &&
						!activeSession.isEnquiry
					}
					onMobileSupervisionAction={() =>
						setIsSupervisorModalOpen(true)
					}
					showMobileDeleteAnonymousAccountAction={
						untilL &&
						hasUserAuthority(
							AUTHORITIES.CONSULTANT_DEFAULT,
							userData
						) &&
						isAnonymousChat &&
						!isSupervisor &&
						!activeSession.isEnquiry
					}
					onMobileDeleteAnonymousAccountAction={
						handleDeleteAnonymousAccount
					}
					mobileDeleteAnonymousAccountDisabled={
						isAccountDeleted || isDeletingAccount
					}
					showMobileEndAnonymousChatAction={
						showEndAnonymousChatButton ||
						showConsultantEndAnonymousChatButton
					}
					onMobileEndAnonymousChatAction={
						handleRequestEndAnonymousChat
					}
					mobileEndAnonymousChatDisabled={
						isFinishingChat || isChatFinished
					}
				/>
			</div>

			{(hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) && (
				<div className="sessionInfo__metaInfo">
					{activeSession.agency?.name && (
						<div className="sessionInfo__metaInfo__content">
							{translate(
								[
									`agency.${activeSession.agency.id}.name`,
									activeSession.agency.name
								],
								{ ns: 'agencies' }
							)}
						</div>
					)}
					{topic?.name && (
						<div className="sessionInfo__metaInfo__content">
							{topic.name}
							<span className="sessionInfo__topicDots">•••</span>
						</div>
					)}
				</div>
			)}

			{/* Supervisor Management Modal - Rendered via Portal */}
			{isSupervisionEnabledForCurrentChat &&
				isSupervisorModalOpen &&
				createPortal(
					<div
						style={{
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							zIndex: 9999,
							pointerEvents: 'auto'
						}}
						onClick={(e) => {
							if (e.target === e.currentTarget) {
								setIsSupervisorModalOpen(false);
							}
						}}
					>
						<div
							style={{
								backgroundColor: 'white',
								borderRadius: '8px',
								padding: '24px',
								maxWidth: '500px',
								width: '90%',
								maxHeight: '80vh',
								overflowY: 'auto',
								position: 'relative',
								zIndex: 10000,
								boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
							}}
							onClick={(e) => {
								e.stopPropagation();
							}}
						>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: '20px'
								}}
							>
								<h2 style={{ margin: 0 }}>
									{translate(
										'sessionHeader.supervisor.modal.title',
										'Supervisor verwalten'
									)}
								</h2>
								<button
									onClick={() =>
										setIsSupervisorModalOpen(false)
									}
									style={{
										background: 'none',
										border: 'none',
										fontSize: '24px',
										cursor: 'pointer',
										color: '#666'
									}}
								>
									×
								</button>
							</div>

							{/* Current Supervisors */}
							<div style={{ marginBottom: '24px' }}>
								<h3
									style={{
										marginBottom: '12px',
										fontSize: '16px',
										fontWeight: '600'
									}}
								>
									{translate(
										'sessionHeader.supervisor.modal.current',
										'Aktuelle Supervisor'
									)}
								</h3>
								<div
									style={{
										marginBottom: '8px',
										fontSize: '12px',
										color: '#666'
									}}
								>
									{translate(
										'sessionHeader.supervisor.modal.note',
										'If you want any supervisors to supervise in future, you can add them in advance.'
									)}
								</div>
								{isLoadingSupervisors ? (
									<div>
										{translate(
											'sessionHeader.supervisor.modal.loading',
											'Lädt...'
										)}
									</div>
								) : supervisors.length === 0 ? (
									<div style={{ color: '#666' }}>
										{translate(
											'sessionHeader.supervisor.modal.noSupervisors',
											'Keine Supervisor hinzugefügt'
										)}
									</div>
								) : (
									<div>
										{supervisors.map((supervisor) => (
											<div
												key={supervisor.id}
												style={{
													display: 'flex',
													justifyContent:
														'space-between',
													alignItems: 'center',
													padding: '12px',
													border: '1px solid #ddd',
													borderRadius: '4px',
													marginBottom: '8px',
													backgroundColor: '#fff'
												}}
											>
												<div style={{ flex: 1 }}>
													<div
														style={{
															fontWeight: '500',
															fontSize: '14px',
															color: '#3F373F'
														}}
													>
														{getSupervisorName(
															supervisor
														)}
													</div>
													<div
														style={{
															fontSize: '12px',
															color: '#666',
															marginTop: '4px'
														}}
													>
														{translate(
															'sessionHeader.supervisor.modal.added',
															'Hinzugefügt'
														)}
														:{' '}
														{new Date(
															supervisor.addedDate
														).toLocaleDateString()}
													</div>
													{supervisor.notes && (
														<div
															style={{
																fontSize:
																	'12px',
																color: '#666',
																marginTop:
																	'8px',
																fontStyle:
																	'normal'
															}}
														>
															<strong>
																{translate(
																	'sessionHeader.supervisor.modal.reason',
																	'Grund'
																)}
																:
															</strong>{' '}
															{supervisor.notes}
														</div>
													)}
												</div>
												<button
													onClick={() =>
														handleRemoveSupervisor(
															supervisor.id
														)
													}
													style={{
														padding: '6px 12px',
														borderRadius: '4px',
														border: '1px solid #c62828',
														backgroundColor:
															'transparent',
														color: '#c62828',
														cursor: 'pointer',
														fontSize: '12px',
														fontWeight: '500'
													}}
													title={translate(
														'sessionHeader.supervisor.modal.remove',
														'Entfernen'
													)}
												>
													{translate(
														'sessionHeader.supervisor.modal.remove',
														'Entfernen'
													)}
												</button>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Add Supervisor */}
							<div>
								<h3
									style={{
										marginBottom: '12px',
										fontSize: '16px',
										fontWeight: '600'
									}}
								>
									{translate(
										'sessionHeader.supervisor.modal.add',
										'Supervisor hinzufügen'
									)}
								</h3>
								{isLoadingConsultants ? (
									<div>
										{translate(
											'sessionHeader.supervisor.modal.loadingConsultants',
											'Lädt Berater...'
										)}
									</div>
								) : availableConsultants.length === 0 ? (
									<div style={{ color: '#666' }}>
										{translate(
											'sessionHeader.supervisor.modal.noConsultants',
											'Keine verfügbaren Berater'
										)}
									</div>
								) : (
									<div>
										<div style={{ width: '100%' }}>
											<SelectDropdown
												{...consultantSelectDropdown}
											/>
										</div>
										<div style={{ marginTop: '12px' }}>
											<label
												style={{
													display: 'block',
													marginBottom: '8px',
													fontSize: '14px',
													fontWeight: '500',
													color: '#3F373F'
												}}
											>
												{translate(
													'sessionHeader.supervisor.modal.reasonLabel',
													'Grund für die Supervision'
												)}
											</label>
											<textarea
												value={supervisionReason}
												onChange={(e) => {
													setSupervisionReason(
														e.target.value
													);
													if (
														supervisionReasonError &&
														e.target.value.trim()
													) {
														setSupervisionReasonError(
															false
														);
													}
												}}
												placeholder={translate(
													'sessionHeader.supervisor.modal.reasonPlaceholder',
													'Bitte geben Sie den Grund für die Supervision an...'
												)}
												style={{
													width: '100%',
													minHeight: '80px',
													padding: '8px',
													border: supervisionReasonError
														? '1px solid #c62828'
														: '1px solid #ddd',
													borderRadius: '4px',
													fontSize: '14px',
													fontFamily: 'inherit',
													resize: 'vertical'
												}}
											/>
											{supervisionReasonError && (
												<div
													style={{
														marginTop: '6px',
														color: '#c62828',
														fontSize: '12px'
													}}
												>
													{translate(
														'sessionHeader.supervisor.modal.reasonError',
														'Bitte geben Sie einen Grund an.'
													)}
												</div>
											)}
										</div>
										<div
											style={{
												marginTop: '12px',
												display: 'flex',
												justifyContent: 'center'
											}}
										>
											<Button
												item={addSupervisorButton}
												buttonHandle={
													handleAddSupervisor
												}
												disabled={
													!selectedConsultantId ||
													!supervisionReason.trim() ||
													isAddingSupervisor
												}
											/>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>,
					document.body
				)}

			{isEndChatOverlayActive && endChatOverlayItem && (
				<Overlay
					item={endChatOverlayItem}
					handleOverlay={handleEndChatOverlayAction}
					handleOverlayClose={() => {
						if (!isFinishingChat) {
							setIsEndChatOverlayActive(false);
							setEndChatOverlayItem(null);
						}
					}}
					loading={isFinishingChat}
				/>
			)}
		</div>
	);
};
