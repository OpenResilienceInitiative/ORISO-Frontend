import { clearLoginRecoveryPassword } from '../../services/loginRecoveryHandoff';
import { startAuthenticatedChatRecovery } from '../../services/authenticatedChatRecovery';
import { setRecoveryRuntimeStatus } from '../../services/recoveryReminderState';
import { RecoveryKeySaveReminder } from '../E2EEncryptionSupportBanner/RecoveryKeySaveReminder';
import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Routing } from './Routing';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	ConsultingTypesContext,
	InformalContext,
	LocaleContext,
	NotificationsContext
} from '../../globalState';
import { apiGetConsultingTypes } from '../../api';
import { Loading } from './Loading';
import { RegistrationHandover } from './registrationLoader/RegistrationHandover';
import { POST_REGISTRATION_LOADER_KEY } from '../registration/autoLogin';
import { groupEntryRoomPath } from '../groupChat/entryRoom/GroupEntryRoom';
import { handleTokenRefresh } from '../auth/auth';
import { logout } from '../logout/logout';
import './authenticatedApp.styles';
import './navigation.styles';
import { requestPermissions } from '../../utils/notificationHelpers';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { useJoinGroupChat } from '../../hooks/useJoinGroupChat';
import { useCall } from '../../globalState/provider/CallProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { E2EEncryptionSupportBanner } from '../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner';
import { KeyBackupRecoveryPrompt } from '../E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { withAuthenticatedSessionContext } from './authenticatedMatrixLoginData';
import { getPlatformVersion } from '../../resources/scripts/runtimeConfig';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	clearAuthSession,
	CONSULTANT_LOGIN_BLOCKED_ERROR,
	markConsultantLoginBlocked
} from '../auth/consultantLoginBlock';
import { appConfig } from '../../utils/appConfig';
import { withTimeout } from '../../utils/promiseTimeout';

interface AuthenticatedAppProps {
	onAppReady: Function;
	onLogout: Function;
}

export const AuthenticatedApp = ({
	onLogout,
	onAppReady
}: AuthenticatedAppProps) => {
	const { releaseToggles } = useAppConfig();
	const { setConsultingTypes } = useContext(ConsultingTypesContext);
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { locale, setLocale } = useContext(LocaleContext);
	const { setInformal } = useContext(InformalContext);
	const { joinGroupChat, tenantReady } = useJoinGroupChat();
	const navigate = useNavigate();
	const { setNotifications } = useContext(NotificationsContext);
	const callContext = useCall();
	const { matrixClientService, setMatrixClientService } = useMatrixClient();
	const recoveryClients = useRef(new WeakSet<object>());
	const recoveryMode = userData?.chatRecoveryMode;
	const recoveryRevision = userData?.chatRecoveryPolicyRevision;
	const recoveryAnonymous =
		!!userData && hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, userData);
	const recoveryUserLoaded = !!userData;
	useEffect(() => {
		if (!matrixClientService || !recoveryUserLoaded) return;
		let cancelled = false;
		const unsubscribe = matrixClientService.onSyncStateChange((state) => {
			if (state !== 'PREPARED' && state !== 'SYNCING') return;
			const client = matrixClientService.getClient();
			const userId = client?.getUserId();
			if (!client || !userId || recoveryClients.current.has(client))
				return;
			if (recoveryAnonymous) {
				clearLoginRecoveryPassword();
				return;
			}
			try {
				void startAuthenticatedChatRecovery(
					client,
					{
						chatRecoveryMode: recoveryMode,
						chatRecoveryPolicyRevision: recoveryRevision
					},
					recoveryClients.current,
					() => cancelled
				);
			} catch {
				setRecoveryRuntimeStatus(userId, 'retryable-failure');
			}
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [
		matrixClientService,
		recoveryUserLoaded,
		recoveryAnonymous,
		recoveryMode,
		recoveryRevision
	]);
	// Ask for notification permission (incoming calls) on the user's first
	// gesture — but only inside the authenticated app. This used to sit at
	// the router root, where the very first click on the LOGIN page popped
	// the browser's permission dialog for anonymous visitors (owner report,
	// 2026-08-19).
	useNotificationPermission();
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
			clearLoginRecoveryPassword();
		},
		[]
	);

	const [appReady, setAppReady] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	const [userDataRequested, setUserDataRequested] = useState<boolean>(false);
	// Freshly-registered askers get a welcome loading animation bridging the
	// bootstrap below (one-shot flag set just before the post-registration redirect).
	const [showPostRegLoader, setShowPostRegLoader] = useState<boolean>(() => {
		const flagged =
			sessionStorage.getItem(POST_REGISTRATION_LOADER_KEY) === 'true';
		if (flagged) {
			sessionStorage.removeItem(POST_REGISTRATION_LOADER_KEY);
		}
		/* Someone who registered through a group link is not about to
		   write an enquiry — the group's entry room is their handover. */
		const cameForAGroup = Boolean(
			new URLSearchParams(window.location.search).get('gcid')
		);
		return flagged && !cameForAGroup;
	});

	useEffect(() => {
		// CRITICAL: Clear ALL old notifications on app mount (prevents phantom call notifications!)
		// console.log('🧹 Clearing all old notifications on app mount...');
		setNotifications([]);
	}, [setNotifications]);

	/* The group-chat id from the link (`?gcid=`) is read once, at mount. It
	   used to be re-read from `window.location` inside an effect that ran
	   again when the tenant arrived — by then the router had already
	   replaced the URL and the id was gone, so the assignment never fired
	   (#974, #1216). Now: keep the id, wait for the tenant, assign, then
	   open the group's entry room. */
	const [pendingGroupChatId, setPendingGroupChatId] = useState<string | null>(
		() => new URLSearchParams(window.location.search).get('gcid')
	);
	useEffect(() => {
		if (!pendingGroupChatId || !tenantReady) {
			return;
		}
		const gcid = pendingGroupChatId;
		setPendingGroupChatId(null);
		joinGroupChat(gcid)
			.then((assigned) => {
				if (assigned) {
					navigate(groupEntryRoomPath(gcid), { replace: true });
				}
			})
			.catch(() => {
				/* Already assigned (409) or gone — the entry room says so. */
				navigate(groupEntryRoomPath(gcid), { replace: true });
			});
	}, [pendingGroupChatId, tenantReady, joinGroupChat, navigate]);

	useEffect(() => {
		if (
			!releaseToggles?.enableNewNotifications &&
			userData &&
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		) {
			requestPermissions();
		}
	}, [releaseToggles?.enableNewNotifications, userData]);

	useEffect(() => {
		if (!userDataRequested) {
			setUserDataRequested(true);

			handleTokenRefresh(false)
				.then(() => {
					Promise.all([reloadUserData(), apiGetConsultingTypes()])
						.then(([userProfileData, consultingTypes]) => {
							if (
								appConfig.blockConsultantAppLogin &&
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userProfileData
								)
							) {
								clearAuthSession();
								markConsultantLoginBlocked();
								throw new Error(CONSULTANT_LOGIN_BLOCKED_ERROR);
							}

							// set informal / formal cookie depending on the given userdata
							setInformal(!userProfileData.formalLanguage);
							setConsultingTypes(consultingTypes);

							if (userProfileData.preferredLanguage) {
								setLocale(userProfileData.preferredLanguage);
							}
							return userProfileData;
						})
						.then(async (userProfileData) => {
							const matrixBootstrapActive = { current: true };
							try {
								await withTimeout(
									(async () => {
										const matrixLoginData =
											await getMatrixAccessToken();
										persistMatrixLoginData(matrixLoginData);
										const { homeserverUrl } =
											matrixLoginData;
										if (homeserverUrl) {
											const { MatrixClientService } =
												await import(
													'../../services/matrixClientService'
												);
											const matrixClientService =
												new MatrixClientService();
											await matrixClientService.initializeClient(
												withAuthenticatedSessionContext(
													matrixLoginData,
													hasUserAuthority(
														AUTHORITIES.ANONYMOUS_DEFAULT,
														userProfileData
													)
												)
											);
											if (
												!matrixBootstrapActive.current ||
												!mounted.current
											) {
												matrixClientService.stopAndCleanup();
												return;
											}

											setMatrixClientService(
												matrixClientService
											);
											(window as any).callContext =
												callContext;

											const { matrixLiveEventBridge } =
												await import(
													'../../services/matrixLiveEventBridge'
												);
											if (
												!matrixBootstrapActive.current ||
												!mounted.current
											) {
												matrixClientService.stopAndCleanup();
												return;
											}
											const matrixClient =
												matrixClientService.getClient();
											if (!matrixClient) {
												throw new Error(
													'Matrix client missing after initialization'
												);
											}
											matrixLiveEventBridge.initialize(
												matrixClient
											);
										}
									})(),
									15_000,
									'Matrix bootstrap timed out'
								);
							} catch (matrixError) {
								matrixBootstrapActive.current = false;
								clearLoginRecoveryPassword();
								console.error(
									'Matrix bootstrap failed; continuing with non-chat features',
									matrixError
								);
							}

							setAppReady(true);
						})
						.catch((error) => {
							console.error(
								'Authenticated app bootstrap failed',
								error
							);
							setLoading(false);
						});
				})
				.catch(() => {
					setLoading(false);
				});
		}
		// callContext is deliberately omitted: the CallProvider context value is
		// recreated on every call-state change and would re-run this bootstrap
		// effect; it is only mirrored to window.callContext here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		locale,
		setConsultingTypes,
		setInformal,
		setLocale,
		setMatrixClientService,
		reloadUserData,
		userDataRequested
	]);

	useEffect(() => {
		onAppReady();
	}, [appReady]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleLogout = useCallback(() => {
		onLogout();
		// Clear the React context's Matrix client reference on sign-out so a
		// stale authenticated client cannot survive into a subsequent session
		// (logout() also resets the module-level registry).
		setMatrixClientService(null);
		logout();
	}, [onLogout, setMatrixClientService]);

	/* The gate opens itself after SLOW_AFTER_MS as an escape hatch, so the
	   click can land while bootstrap is still in flight. Tearing the handover
	   down then drops the user onto the generic spinner — the one screen the
	   gate exists to spare them. Remember the intent instead and let the
	   effect below close it once routing can actually show the message field;
	   the handover shows its `entering` state in the meantime. */
	const [handoverEntered, setHandoverEntered] = useState(false);

	const handlePostRegLoaderFinish = useCallback(() => {
		setHandoverEntered(true);
	}, []);

	useEffect(() => {
		if (handoverEntered && appReady) {
			setShowPostRegLoader(false);
		}
	}, [handoverEntered, appReady]);
	const platformVersion = getPlatformVersion();

	// Post-registration: bridge the bootstrap load with the welcome animation,
	// driven by appReady (the real "everything loaded" signal). Falls through to the
	// usual branches on error (loading=false, appReady=false → redirect to login).
	if (showPostRegLoader && (loading || appReady)) {
		return (
			<RegistrationHandover
				ready={appReady}
				onEnter={handlePostRegLoaderFinish}
			/>
		);
	}

	if (appReady) {
		return (
			<>
				<E2EEncryptionSupportBanner />
				<KeyBackupRecoveryPrompt />
				<RecoveryKeySaveReminder />
				<Routing logout={handleLogout} />
				{platformVersion && (
					<div className="app__platformVersion">
						{platformVersion}
					</div>
				)}
			</>
		);
	} else if (loading) {
		return <Loading />;
	}

	return <Navigate to="/login" replace />;
};
