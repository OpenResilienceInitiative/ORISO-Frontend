import { clearLoginRecoveryPassword } from '../../services/loginRecoveryHandoff';
import { RecoveryKeySaveReminder } from '../E2EEncryptionSupportBanner/RecoveryKeySaveReminder';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Routing } from './Routing';
import { AccountSetupGate } from '../twoFactorAuth/AccountSetupGate';
import {
	isAccountSetupPending,
	resolveAccountSetupStep
} from '../twoFactorAuth/accountSetupStep';
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
import {
	handleTokenRefresh,
	isTokenRefreshUnavailableError
} from '../auth/auth';
import { logout, teardownLocalSession } from '../logout/logout';
import './authenticatedApp.styles';
import './navigation.styles';
import { requestPermissions } from '../../utils/notificationHelpers';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { useAuthenticatedChatRecovery } from '../../hooks/useAuthenticatedChatRecovery';
import { usePendingGroupChatJoin } from '../../hooks/usePendingGroupChatJoin';
import { useCall } from '../../globalState/provider/CallProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { E2EEncryptionSupportBanner } from '../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner';
import { KeyBackupRecoveryPrompt } from '../E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { withAuthenticatedSessionContext } from './authenticatedMatrixLoginData';
import { AuthenticatedBuildIdentityBoundary } from './BuildIdentity';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { useDisplayFilterStoreBinding } from '../../hooks/useDisplayFilter';
import { displayFilterStore } from '../../utils/displayFilter/store';
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
	const { setNotifications } = useContext(NotificationsContext);
	const callContext = useCall();
	const { matrixClientService, setMatrixClientService } = useMatrixClient();
	// #1377: the display-filter store follows the published client (and
	// detaches on logout, before the storage hygiene runs).
	useDisplayFilterStoreBinding();
	useAuthenticatedChatRecovery(matrixClientService, userData);
	usePendingGroupChatJoin(userData);
	// Ask for notification permission (incoming calls) on the user's first
	// gesture — but only inside the authenticated app. This used to sit at
	// the router root, where the very first click on the LOGIN page popped
	// the browser's permission dialog for anonymous visitors (owner report,
	// 2026-08-19). Withheld until the profile says the account is the counsellor's
	// own: an account that still owes its password or second factor takes no calls,
	// and the dialog would land over the setup gate. Unknown counts as pending here.
	useNotificationPermission(!!userData && !isAccountSetupPending(userData));
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
	/* Every path that ends in `<Navigate to="/login">` below goes through
	   here: the old session is torn down *before* the login form renders,
	   so no provider above the router (notification poller, Matrix client)
	   keeps running on leftover cookies, and the next sign-in starts from a
	   clean Matrix registry instead of inheriting the old device. */
	const abandonSession = useCallback(() => {
		displayFilterStore.detachClient();
		setMatrixClientService(null);
		teardownLocalSession();
		setLoading(false);
	}, [setMatrixClientService]);
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

	useEffect(() => {
		if (
			!releaseToggles?.enableNewNotifications &&
			userData &&
			!isAccountSetupPending(userData) &&
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

											// Deliberately NOT gated: the client has
											// already started, and the password step needs
											// a PREPARED client whenever there is
											// key-backup material to rotate. What IS
											// withheld is everything acting on the content:
											// live events, notifications, the deep link.
											if (
												isAccountSetupPending(
													userProfileData
												)
											) {
												return;
											}

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
							abandonSession();
						});
				})
				.catch((error) => {
					if (isTokenRefreshUnavailableError(error)) {
						window.setTimeout(() => {
							if (mounted.current) {
								setUserDataRequested(false);
							}
						}, 2_000);
						return;
					}
					abandonSession();
				});
		}
		// callContext is deliberately omitted: the CallProvider context value is
		// recreated on every call-state change and would re-run this bootstrap
		// effect; it is only mirrored to window.callContext here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		abandonSession,
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
		// Synchronously, before the async pre-logout handlers and the storage
		// purge: a pending display-filter write must not recreate this user's
		// mirror afterwards (#1377 §7.5). The effect cleanup detaches again.
		displayFilterStore.detachClient();
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
		// Account setup comes before the app, not on top of it: until the counsellor's
		// own password and a second factor are settled, the only ways on are completing
		// them or logging out. Replacing the routed app is what makes that true.
		if (resolveAccountSetupStep(userData) !== null) {
			return (
				<AuthenticatedBuildIdentityBoundary>
					<AccountSetupGate onLogout={handleLogout} />
				</AuthenticatedBuildIdentityBoundary>
			);
		}

		return (
			<AuthenticatedBuildIdentityBoundary>
				<E2EEncryptionSupportBanner />
				<KeyBackupRecoveryPrompt />
				<RecoveryKeySaveReminder />
				<Routing logout={handleLogout} />
			</AuthenticatedBuildIdentityBoundary>
		);
	} else if (loading) {
		return <Loading />;
	}

	return <Navigate to="/login" replace />;
};
