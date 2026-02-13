import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useHistory } from 'react-router-dom';
import clsx from 'clsx';
import { handleNumericTranslation } from '../../utils/translate';
import { mobileListView } from '../app/navigationHandler';
import { apiDeleteSessionAndUser } from '../../api/apiDeleteSessionAndUser';
import { apiGetSessionSupervisors, SessionSupervisor } from '../../api/apiGetSessionSupervisors';
import { apiAddSessionSupervisor } from '../../api/apiAddSessionSupervisor';
import { apiRemoveSessionSupervisor } from '../../api/apiRemoveSessionSupervisor';
import { apiGetAgencyConsultantList, Consultant } from '../../api/apiGetAgencyConsultantList';
import { NotificationsContext, NOTIFICATION_TYPE_SUCCESS, NOTIFICATION_TYPE_ERROR } from '../../globalState';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext
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
import { useTopic } from '../../globalState';
import { SelectDropdown, SelectDropdownItem } from '../select/SelectDropdown';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { ReactComponent as CloseCircle } from '../../resources/img/icons/close-circle.svg';

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
	const { addNotification } = useContext(NotificationsContext);
	const history = useHistory();
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const topic = useTopic(
		(activeSession.item.topic as TopicSessionInterface).id
	);
	const settings = useAppConfig();

	const contact = getContact(activeSession);
	const userSessionData = contact?.sessionData;

	// Check if this is an anonymous chat
	const isAnonymousChat = activeSession.item.postcode === 0 || 
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-');

	// Check if current user is a supervisor (read-only observer, not the assigned consultant)
	const isSupervisor = hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && 
		activeSession.consultant?.id && 
		activeSession.consultant.id !== userData.userId;

	// State for delete account button
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [isAccountDeleted, setIsAccountDeleted] = useState(false);

	// State for supervisor management
	const [supervisors, setSupervisors] = useState<SessionSupervisor[]>([]);
	const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
	const [availableConsultants, setAvailableConsultants] = useState<Consultant[]>([]);
	const [allConsultants, setAllConsultants] = useState<Consultant[]>([]); // All consultants for name lookup
	const [isLoadingConsultants, setIsLoadingConsultants] = useState(false);
	const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);
	const [selectedConsultantId, setSelectedConsultantId] = useState<string>('');
	const [supervisionReason, setSupervisionReason] = useState<string>('');
	const [supervisionReasonError, setSupervisionReasonError] = useState(false);
	const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);

	// Prepare SelectDropdown for consultant selection
	const consultantSelectDropdown = React.useMemo<SelectDropdownItem>(() => ({
		id: 'supervisor-consultant-select',
		selectedOptions: availableConsultants.map((consultant) => ({
			value: consultant.consultantId,
			label: `${consultant.firstName} ${consultant.lastName}`
		})),
		defaultValue: selectedConsultantId ? {
			value: selectedConsultantId,
			label: availableConsultants.find(c => c.consultantId === selectedConsultantId) 
				? `${availableConsultants.find(c => c.consultantId === selectedConsultantId).firstName} ${availableConsultants.find(c => c.consultantId === selectedConsultantId).lastName}`
				: ''
		} : null,
		handleDropdownSelect: (selectedOption) => {
			setSelectedConsultantId(selectedOption ? selectedOption.value : '');
		},
		selectInputLabel: translate('sessionHeader.supervisor.modal.selectConsultant', 'Berater auswählen...'),
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
	}), [availableConsultants, selectedConsultantId, translate]);

	// Prepare Button for add supervisor
	const addSupervisorButton: ButtonItem = React.useMemo(() => ({
		label: isAddingSupervisor
			? translate('sessionHeader.supervisor.modal.adding', 'Hinzufügen...')
			: translate('sessionHeader.supervisor.modal.addButton', 'Hinzufügen'),
		function: '',
		type: BUTTON_TYPES.PRIMARY,
		disabled: !selectedConsultantId || isAddingSupervisor
	}), [selectedConsultantId, isAddingSupervisor, translate]);

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
		if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && activeSession.item.id) {
			loadSupervisors();
		}
	}, [activeSession.item.id, userData]);

	// Load available consultants when modal opens
	useEffect(() => {
		if (isSupervisorModalOpen) {
			const agencyId = activeSession.agency?.id || activeSession.item?.agencyId;
			if (agencyId) {
				loadAvailableConsultants();
			} else {
				// console.warn('Cannot load consultants: No agency ID in session');
			}
		}
	}, [isSupervisorModalOpen, activeSession.agency?.id, activeSession.item?.agencyId]);

	const loadSupervisors = async () => {
		if (!activeSession.item.id) return;
		setIsLoadingSupervisors(true);
		try {
			const data = await apiGetSessionSupervisors(activeSession.item.id);
			setSupervisors(data);
			// Also load consultants to get names for supervisors
			const agencyId = activeSession.agency?.id || activeSession.item?.agencyId;
			if (agencyId) {
				try {
					const consultants = await apiGetAgencyConsultantList(agencyId.toString());
					const uniqueConsultants = dedupeConsultants(consultants);
					setAllConsultants(uniqueConsultants); // Store all consultants for name lookup
					// Filter: only supervisors, exclude current user and already added supervisors
					const supervisorIds = data.map(s => s.supervisorConsultantId);
					const filtered = uniqueConsultants.filter(
						c => c.isSupervisor === true && 
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
		const consultant = allConsultants.find(c => c.consultantId === supervisor.supervisorConsultantId);
		if (consultant) {
			return `${consultant.firstName} ${consultant.lastName}`;
		}
		// Fallback to username if consultant not found (shouldn't happen, but just in case)
		return supervisor.supervisorUsername || supervisor.supervisorConsultantId;
	};

	const dedupeConsultants = (consultants: Consultant[]): Consultant[] => {
		const uniqueById = new Map<string, Consultant>();
		consultants.forEach(consultant => {
			if (!uniqueById.has(consultant.consultantId)) {
				uniqueById.set(consultant.consultantId, consultant);
			}
		});
		return Array.from(uniqueById.values());
	};

	const loadAvailableConsultants = async () => {
		// Try to get agency ID from session.agency.id or session.item.agencyId
		const agencyId = activeSession.agency?.id || activeSession.item?.agencyId;
		if (!agencyId) {
			// console.error('No agency ID found in session:', activeSession);
			setAvailableConsultants([]);
			setIsLoadingConsultants(false);
			return;
		}
		setIsLoadingConsultants(true);
		try {
			const consultants = await apiGetAgencyConsultantList(agencyId.toString());
			const uniqueConsultants = dedupeConsultants(consultants);
			// console.log('Loaded consultants from agency:', agencyId, uniqueConsultants);
			// Store all consultants for name lookup
			setAllConsultants(uniqueConsultants);
			// Filter: only supervisors, exclude current user and already added supervisors
			const supervisorIds = supervisors.map(s => s.supervisorConsultantId);
			const filtered = uniqueConsultants.filter(
				c => c.isSupervisor === true && 
					c.consultantId !== userData.userId && 
					!supervisorIds.includes(c.consultantId)
			);
			// console.log('Filtered consultants (after removing current user and supervisors):', filtered);
			setAvailableConsultants(filtered);
		} catch (error) {
			// console.error('Failed to load consultants:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate('sessionHeader.supervisor.error.loadConsultants.title', 'Fehler'),
				text: translate('sessionHeader.supervisor.error.loadConsultants.text', 'Berater konnten nicht geladen werden.'),
				closeable: true,
				timeout: 5000
			});
		} finally {
			setIsLoadingConsultants(false);
		}
	};

	const handleAddSupervisor = async () => {
		if (!selectedConsultantId || !activeSession.item.id) return;
		if (!supervisionReason.trim()) {
			setSupervisionReasonError(true);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate('sessionHeader.supervisor.error.reasonRequired.title', 'Grund erforderlich'),
				text: translate('sessionHeader.supervisor.error.reasonRequired.text', 'Bitte geben Sie den Grund für die Supervision an.'),
				closeable: true,
				timeout: 5000
			});
			return;
		}
		setIsAddingSupervisor(true);
		try {
			await apiAddSessionSupervisor(activeSession.item.id, selectedConsultantId, supervisionReason);
			await loadSupervisors();
			setSelectedConsultantId('');
			setSupervisionReason('');
			setSupervisionReasonError(false);
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate('sessionHeader.supervisor.success.add.title', 'Supervisor hinzugefügt'),
				text: translate('sessionHeader.supervisor.success.add.text', 'Der Supervisor wurde erfolgreich hinzugefügt.'),
				closeable: true,
				timeout: 5000
			});
			// Reload consultants list
			await loadAvailableConsultants();
			// Close modal after successful add
			setIsSupervisorModalOpen(false);
		} catch (error) {
			// console.error('Failed to add supervisor:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate('sessionHeader.supervisor.error.add.title', 'Fehler'),
				text: translate('sessionHeader.supervisor.error.add.text', 'Supervisor konnte nicht hinzugefügt werden.'),
				closeable: true,
				timeout: 5000
			});
		} finally {
			setIsAddingSupervisor(false);
		}
	};

	const handleRemoveSupervisor = async (supervisorId: number) => {
		if (!activeSession.item.id) return;
		if (!window.confirm(
			translate('sessionHeader.supervisor.remove.confirm', 'Möchten Sie diesen Supervisor wirklich entfernen?')
		)) {
			return;
		}
		try {
			await apiRemoveSessionSupervisor(activeSession.item.id, supervisorId);
			await loadSupervisors();
			await loadAvailableConsultants();
			addNotification({
				notificationType: NOTIFICATION_TYPE_SUCCESS,
				title: translate('sessionHeader.supervisor.success.remove.title', 'Supervisor entfernt'),
				text: translate('sessionHeader.supervisor.success.remove.text', 'Der Supervisor wurde erfolgreich entfernt.'),
				closeable: true,
				timeout: 5000
			});
			// Close modal after successful remove
			setIsSupervisorModalOpen(false);
		} catch (error) {
			// console.error('Failed to remove supervisor:', error);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate('sessionHeader.supervisor.error.remove.title', 'Fehler'),
				text: translate('sessionHeader.supervisor.error.remove.text', 'Supervisor konnte nicht entfernt werden.'),
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
					{hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
					!activeSession.consultant ? (
						<ConsultantSearchLoader size="40px" />
					) : (
						<UserAvatar
							username={contact?.username || 'User'}
							displayName={contact?.displayName}
							userId={contact?.username || 'unknown'}
							size="40px"
						/>
					)}
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
				{/* Delete Account Button for Consultants viewing Anonymous Chats (not supervisors, not during enquiry) */}
				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && 
					isAnonymousChat && !isSupervisor && !activeSession.isEnquiry && (
					<button
						onClick={async () => {
							if (isAccountDeleted || isDeletingAccount) {
								return;
							}
							
							if (!window.confirm(
								translate(
									'sessionHeader.anonymous.deleteAccount.confirm',
									'Möchten Sie das Konto dieses anonymen Benutzers wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
								)
							)) {
								return;
							}

							setIsDeletingAccount(true);
							try {
								await apiDeleteSessionAndUser(activeSession.item.id);
								setIsAccountDeleted(true);
								addNotification({
									notificationType: NOTIFICATION_TYPE_SUCCESS,
									title: translate(
										'sessionHeader.anonymous.deleteAccount.success.title',
										'Konto gelöscht'
									),
									text: translate(
										'sessionHeader.anonymous.deleteAccount.success.text',
										'Das anonyme Benutzerkonto wurde erfolgreich gelöscht.'
									),
									closeable: true,
									timeout: 5000
								});
								// Redirect to session list after a short delay
								setTimeout(() => {
									history.push(listPath + getSessionListTab());
								}, 2000);
							} catch (error) {
								// console.error('Failed to delete anonymous user account:', error);
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
						}}
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
							cursor: isAccountDeleted || isDeletingAccount ? 'not-allowed' : 'pointer',
							opacity: isAccountDeleted || isDeletingAccount ? 0.6 : 1,
							transition: 'all 0.3s ease',
							marginLeft: '12px'
						}}
					>
						{isAccountDeleted
							? translate('sessionHeader.anonymous.deleteAccount.deleted', 'Gelöscht')
							: isDeletingAccount
							? translate('sessionHeader.anonymous.deleteAccount.deleting', 'Löschen...')
							: translate('sessionHeader.anonymous.deleteAccount.label', 'Konto löschen')}
					</button>
				)}
				{/* Supervisor Management Button - Only for assigned consultants (not supervisors, not during enquiry) */}
				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && !activeSession.isGroup && !isSupervisor && !activeSession.isEnquiry && (
					<button
						onClick={() => setIsSupervisorModalOpen(true)}
						style={{
							padding: '8px 16px',
							marginRight: '12px',
							borderRadius: '4px',
							border: '1px solid #c62828',
							backgroundColor: 'transparent',
							color: '#c62828',
							fontSize: '14px',
							fontWeight: '500',
							cursor: 'pointer',
							transition: 'all 0.3s ease'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#ffebee';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
						}}
					>
						{translate('sessionHeader.supervisor.manage', 'Supervisor verwalten')}
						{supervisors.length > 0 && ` (${supervisors.length})`}
					</button>
				)}
				<SessionMenu
					hasUserInitiatedStopOrLeaveRequest={
						props.hasUserInitiatedStopOrLeaveRequest
					}
					isAskerInfoAvailable={isAskerInfoAvailable()}
					bannedUsers={props.bannedUsers}
					isSupervisor={isSupervisor}
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
						</div>
					)}
				</div>
			)}

			{/* Supervisor Management Modal - Rendered via Portal */}
			{isSupervisorModalOpen && createPortal(
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
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
							<h2 style={{ margin: 0 }}>
								{translate('sessionHeader.supervisor.modal.title', 'Supervisor verwalten')}
							</h2>
							<button
								onClick={() => setIsSupervisorModalOpen(false)}
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
							<h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
								{translate('sessionHeader.supervisor.modal.current', 'Aktuelle Supervisor')}
							</h3>
							<div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
								{translate(
									'sessionHeader.supervisor.modal.note',
									'If you want any supervisors to supervise in future, you can add them in advance.'
								)}
							</div>
							{isLoadingSupervisors ? (
								<div>{translate('sessionHeader.supervisor.modal.loading', 'Lädt...')}</div>
							) : supervisors.length === 0 ? (
								<div style={{ color: '#666' }}>
									{translate('sessionHeader.supervisor.modal.noSupervisors', 'Keine Supervisor hinzugefügt')}
								</div>
							) : (
								<div>
									{supervisors.map((supervisor) => (
										<div
											key={supervisor.id}
											style={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												padding: '12px',
												border: '1px solid #ddd',
												borderRadius: '4px',
												marginBottom: '8px',
												backgroundColor: '#fff'
											}}
										>
											<div style={{ flex: 1 }}>
												<div style={{ fontWeight: '500', fontSize: '14px', color: '#3F373F' }}>
													{getSupervisorName(supervisor)}
												</div>
												<div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
													{translate('sessionHeader.supervisor.modal.added', 'Hinzugefügt')}:{' '}
													{new Date(supervisor.addedDate).toLocaleDateString()}
												</div>
												{supervisor.notes && (
													<div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'normal' }}>
														<strong>{translate('sessionHeader.supervisor.modal.reason', 'Grund')}:</strong> {supervisor.notes}
													</div>
												)}
											</div>
											<button
												onClick={() => handleRemoveSupervisor(supervisor.id)}
												style={{
													padding: '6px 12px',
													borderRadius: '4px',
													border: '1px solid #c62828',
													backgroundColor: 'transparent',
													color: '#c62828',
													cursor: 'pointer',
													fontSize: '12px',
													fontWeight: '500'
												}}
												title={translate('sessionHeader.supervisor.modal.remove', 'Entfernen')}
											>
												{translate('sessionHeader.supervisor.modal.remove', 'Entfernen')}
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Add Supervisor */}
						<div>
							<h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
								{translate('sessionHeader.supervisor.modal.add', 'Supervisor hinzufügen')}
							</h3>
							{isLoadingConsultants ? (
								<div>{translate('sessionHeader.supervisor.modal.loadingConsultants', 'Lädt Berater...')}</div>
							) : availableConsultants.length === 0 ? (
								<div style={{ color: '#666' }}>
									{translate('sessionHeader.supervisor.modal.noConsultants', 'Keine verfügbaren Berater')}
								</div>
							) : (
								<div>
									<div style={{ width: '100%' }}>
										<SelectDropdown {...consultantSelectDropdown} />
									</div>
									<div style={{ marginTop: '12px' }}>
										<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#3F373F' }}>
											{translate('sessionHeader.supervisor.modal.reasonLabel', 'Grund für die Supervision')}
										</label>
										<textarea
											value={supervisionReason}
											onChange={(e) => {
												setSupervisionReason(e.target.value);
												if (supervisionReasonError && e.target.value.trim()) {
													setSupervisionReasonError(false);
												}
											}}
											placeholder={translate('sessionHeader.supervisor.modal.reasonPlaceholder', 'Bitte geben Sie den Grund für die Supervision an...')}
											style={{
												width: '100%',
												minHeight: '80px',
												padding: '8px',
												border: supervisionReasonError ? '1px solid #c62828' : '1px solid #ddd',
												borderRadius: '4px',
												fontSize: '14px',
												fontFamily: 'inherit',
												resize: 'vertical'
											}}
										/>
										{supervisionReasonError && (
											<div style={{ marginTop: '6px', color: '#c62828', fontSize: '12px' }}>
												{translate('sessionHeader.supervisor.modal.reasonError', 'Bitte geben Sie einen Grund an.')}
											</div>
										)}
									</div>
									<div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
										<Button
											item={addSupervisorButton}
											buttonHandle={handleAddSupervisor}
											disabled={!selectedConsultantId || !supervisionReason.trim() || isAddingSupervisor}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>,
				document.body
			)}
		</div>
	);
};
