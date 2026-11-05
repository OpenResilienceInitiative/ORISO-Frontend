import {
	MatrixBootstrapThrottledError,
	retryMatrixBootstrap
} from '../../services/matrixBootstrapRetry';
import { clearLoginRecoveryPassword } from '../../services/loginRecoveryHandoff';
import { RecoveryKeySaveReminder } from '../E2EEncryptionSupportBanner/RecoveryKeySaveReminder';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { loginPathForEmailPreferences } from '../../utils/emailPreferencesReturn';
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
import { PostRegistrationHandover } from './registrationLoader/PostRegistrationHandover';
import { canCloseHandover } from './registrationLoader/handoverClose';
import {
	forgetHandoverDepartment,
	readHandoverGroupJoin
} from './registrationLoader/handoverDepartment';
import {
	markHandoverMilestone,
	resetHandoverProgress
} from './registrationLoader/handoverProgress';
import { loadEntryScreens } from './appChunks';
import { useGroupJoinHandoverCopy } from '../groupChat/groupJoinHandoverCopy';
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
import { useOneShotSessionFlag } from '../../hooks/useOneShotSessionFlag';
import { E2EEncryptionSupportBanner } from '../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner';
import { KeyBackupRecoveryPrompt } from '../E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import { PracticeLayer } from '../../practice/PracticeLayer';
import { JoinRequestCenter } from '../groupChat/joinRequest/JoinRequestCenter';
import { httpJoinRequestTransport } from '../groupChat/joinRequest/httpJoinRequestTransport';
import {
	getCurrentAuthSubject,
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { AUTH_SESSION_CHANGE_EVENT } from '../sessionCookie/accessSessionCookie';
import { withAuthenticatedSessionContext } from './authenticatedMatrixLoginData';
import { AuthenticatedBuildIdentityBoundary } from './BuildIdentity';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { useDisplayFilterStoreBinding } from '../../hooks/useDisplayFilter';
import { useTimelineSettingsStoreBinding } from '../../hooks/useTimelineSettings';
import { useAccountInactivityActivity } from '../../hooks/useAccountInactivityActivity';
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
	/** An authenticated surface outside the counselling app, e.g. a call guest. */
	content?: React.ReactNode;
	loginPath?: string;
}

export const AuthenticatedApp = ({
	onLogout,
	onAppReady,
	content,
	loginPath
}: AuthenticatedAppProps) => {
	const { releaseToggles } = useAppConfig();
	const { setConsultingTypes } = useContext(ConsultingTypesContext);
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { locale, setLocale } = useContext(LocaleContext);
	const { setInformal } = useContext(InformalContext);
	const { setNotifications } = useContext(NotificationsContext);
	const callContext = useCall();
	const { matrixClientService, setMatrixClientService } = useMatrixClient();
	useAccountInactivityActivity();
	// #1377: the display-filter store follows the published client (and
	// detaches on logout, before the storage hygiene runs).
	useDisplayFilterStoreBinding();
	useTimelineSettingsStoreBinding();
	useAuthenticatedChatRecovery(matrixClientService, userData);
	const groupJoinSettled = usePendingGroupChatJoin(userData);
	// Ask for notification permission (incoming calls) on the user's first
	// gesture — but only inside the authenticated app. This used to sit at
	// the router root, where the very first click on the LOGIN page popped
	// the browser's permission dialog for anonymous visitors (owner report,
	// 2026-08-19). Withheld until the profile says the account is the counsellor's
	// own: an account that still owes its password or second factor takes no calls,
	// and the dialog would land over the setup gate. Unknown counts as pending here.
	useNotificationPermission(!!userData && !isAccountSetupPending(userData));
	const mounted = useRef(true);
	const matrixBootstrap = useRef<{
		controller: AbortController;
		subject: string | null;
	} | null>(null);
	useEffect(() => {
		const onAuthSessionChange = () => {
			const bootstrap = matrixBootstrap.current;
			if (bootstrap && bootstrap.subject !== getCurrentAuthSubject()) {
				bootstrap.controller.abort();
			}
		};
		window.addEventListener(AUTH_SESSION_CHANGE_EVENT, onAuthSessionChange);
		return () => {
			window.removeEventListener(
				AUTH_SESSION_CHANGE_EVENT,
				onAuthSessionChange
			);
			mounted.current = false;
			matrixBootstrap.current?.controller.abort();
			clearLoginRecoveryPassword();
		};
	}, []);

	const [appReady, setAppReady] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	/* Every path that ends in `<Navigate to="/login">` below goes through
	   here: the old session is torn down *before* the login form renders,
	   so no provider above the router (notification poller, Matrix client)
	   keeps running on leftover cookies, and the next sign-in starts from a
	   clean Matrix registry instead of inheriting the old device. */
	const abandonSession = useCallback(() => {
		matrixBootstrap.current?.controller.abort();
		displayFilterStore.detachClient();
		setMatrixClientService(null);
		teardownLocalSession();
		setLoading(false);
	}, [setMatrixClientService]);
	const [userDataRequested, setUserDataRequested] = useState<boolean>(false);
	// Freshly-registered askers keep the waiting room they saw before the
	// document load, while the bootstrap below runs (one-shot flag set just
	// before the post-registration redirect, cleared after the first commit).
	const postRegFlagged = useOneShotSessionFlag(POST_REGISTRATION_LOADER_KEY);
	const [showPostRegLoader, setShowPostRegLoader] =
		useState<boolean>(postRegFlagged);
	/* Someone who registered through a group link sees the group's words in
	   the same waiting room, and its button opens the group's entry room
	   instead of an enquiry. It used to get no waiting room at all here —
	   a spinner page, then the group (#1219). The URL keeps `gcid` even when
	   `Registration` did not accept the link, so its decision wins. */
	const [postRegForGroup] = useState(
		() =>
			readHandoverGroupJoin() ??
			Boolean(new URLSearchParams(window.location.search).get('gcid'))
	);
	const groupJoinHandoverCopy = useGroupJoinHandoverCopy();

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
			/* Only for the waiting room: the click on its button must land in
			   a screen that is already loaded, so "ready" waits for these too.
			   Started now, in parallel with everything below. */
			const entryScreens = showPostRegLoader
				? loadEntryScreens(postRegForGroup).then(
						() => markHandoverMilestone('screens'),
						() => markHandoverMilestone('screens')
					)
				: Promise.resolve();

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
							markHandoverMilestone('profile');
							return userProfileData;
						})
						.then(async (userProfileData) => {
							const controller = new AbortController();
							const subject = getCurrentAuthSubject();
							matrixBootstrap.current = { controller, subject };
							const isCurrent = () =>
								mounted.current &&
								!controller.signal.aborted &&
								getCurrentAuthSubject() === subject;
							const startMatrix = async (
								isActive: () => boolean
							) => {
								const loginData = await getMatrixAccessToken();
								if (!isActive()) return;
								persistMatrixLoginData(loginData);
								if (!loginData.homeserverUrl) return;
								const { MatrixClientService } = await import(
									'../../services/matrixClientService'
								);
								if (!isActive()) return;
								const clientService = new MatrixClientService();
								await clientService.initializeClient(
									withAuthenticatedSessionContext(
										loginData,
										hasUserAuthority(
											AUTHORITIES.ANONYMOUS_DEFAULT,
											userProfileData
										)
									)
								);
								if (!isActive()) {
									clientService.stopAndCleanup();
									return;
								}

								setMatrixClientService(clientService);
								markHandoverMilestone('chat');
								(window as any).callContext = callContext;

								// Account setup needs the client for key backup. Live
								// events still wait until the account setup is complete.
								if (isAccountSetupPending(userProfileData))
									return;

								const { matrixLiveEventBridge } = await import(
									'../../services/matrixLiveEventBridge'
								);
								if (!isActive()) {
									clientService.stopAndCleanup();
									return;
								}
								const client = clientService.getClient();
								if (!client) {
									throw new Error(
										'Matrix client missing after initialization'
									);
								}
								matrixLiveEventBridge.initialize(client);
								markHandoverMilestone('liveEvents');
							};
							const connect = async () => {
								if (!isCurrent()) return;
								let active = true;
								try {
									await withTimeout(
										startMatrix(
											() => active && isCurrent()
										),
										15_000,
										'Matrix bootstrap timed out'
									);
								} finally {
									active = false;
								}
							};
							const reportMatrixFailure = (error: unknown) => {
								if (isCurrent()) {
									clearLoginRecoveryPassword();
									console.error(
										'Matrix bootstrap failed; continuing with non-chat features',
										error
									);
								}
							};
							try {
								await connect();
							} catch (error) {
								if (
									error instanceof
									MatrixBootstrapThrottledError
								) {
									// The pending sign-in password has its own expiry and
									// is still needed if the resumed client restores keys.
									void retryMatrixBootstrap(
										connect,
										error,
										controller.signal
									).catch(reportMatrixFailure);
								} else {
									reportMatrixFailure(error);
								}
							}

							/* Without chat (no homeserver, or a failed bootstrap)
							   these steps are over, not pending. */
							markHandoverMilestone('chat');
							markHandoverMilestone('liveEvents');
							await entryScreens;
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
		matrixBootstrap.current?.controller.abort();
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
		if (
			canCloseHandover({
				entered: handoverEntered,
				appReady,
				groupJoinSettled
			})
		) {
			setShowPostRegLoader(false);
			resetHandoverProgress();
			forgetHandoverDepartment();
		}
	}, [handoverEntered, appReady, groupJoinSettled]);

	// Post-registration: bridge the bootstrap load with the welcome animation,
	// driven by appReady (the real "everything loaded" signal). Falls through to the
	// usual branches on error (loading=false, appReady=false → redirect to login).
	if (showPostRegLoader && (loading || appReady)) {
		/* The same frame and the same fill `Registration` showed before the
		   document load, so the person sees one waiting room (#1219). */
		return (
			<PostRegistrationHandover
				/* After a group link the gate also waits for the assignment,
				   so the click lands in the group's entry room. */
				ready={appReady && groupJoinSettled}
				onEnter={handlePostRegLoaderFinish}
				copy={postRegForGroup ? groupJoinHandoverCopy : undefined}
				/* The group's entry room is another waiting room: no message
				   field to close onto, its own gate does that. */
				closing={postRegForGroup ? null : undefined}
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

		if (content)
			return (
				<AuthenticatedBuildIdentityBoundary>
					{content}
				</AuthenticatedBuildIdentityBoundary>
			);

		return (
			<AuthenticatedBuildIdentityBoundary>
				<E2EEncryptionSupportBanner />
				<KeyBackupRecoveryPrompt />
				<RecoveryKeySaveReminder />
				<PracticeLayer>
					<Routing logout={handleLogout} />
				</PracticeLayer>
				<M3SnackbarHost />
				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && (
					<JoinRequestCenter transport={httpJoinRequestTransport} />
				)}
			</AuthenticatedBuildIdentityBoundary>
		);
	} else if (loading) {
		return <Loading />;
	}

	return (
		<Navigate
			to={
				loginPath ??
				loginPathForEmailPreferences(
					window.location.pathname + window.location.search
				)
			}
			replace
		/>
	);
};
