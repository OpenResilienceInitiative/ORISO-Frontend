import * as React from 'react';
import { Navigate } from 'react-router-dom';
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
import { RegistrationLoader } from './registrationLoader/RegistrationLoader';
import { POST_REGISTRATION_LOADER_KEY } from '../registration/autoLogin';
import { handleTokenRefresh } from '../auth/auth';
import { logout } from '../logout/logout';
import './authenticatedApp.styles';
import './navigation.styles';
import { requestPermissions } from '../../utils/notificationHelpers';
import { useJoinGroupChat } from '../../hooks/useJoinGroupChat';
import { useCall } from '../../globalState/provider/CallProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { E2EEncryptionSupportBanner } from '../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner';
import { KeyBackupRecoveryPrompt } from '../E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
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
	const { joinGroupChat } = useJoinGroupChat();
	const { setNotifications } = useContext(NotificationsContext);
	const callContext = useCall();
	const { setMatrixClientService } = useMatrixClient();
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[]
	);

	const [appReady, setAppReady] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	const [userDataRequested, setUserDataRequested] = useState<boolean>(false);
	// Freshly-registered askers get a welcome loading animation bridging the
	// bootstrap below (one-shot flag set just before the post-registration redirect).
	const [showPostRegLoader, setShowPostRegLoader] = useState<boolean>(() => {
		const shouldShow =
			sessionStorage.getItem(POST_REGISTRATION_LOADER_KEY) === 'true';
		if (shouldShow) {
			sessionStorage.removeItem(POST_REGISTRATION_LOADER_KEY);
		}
		return shouldShow;
	});

	useEffect(() => {
		// CRITICAL: Clear ALL old notifications on app mount (prevents phantom call notifications!)
		// console.log('🧹 Clearing all old notifications on app mount...');
		setNotifications([]);

		// When the user has a group chat id that means that we need to join the user in the group chat
		const gcid = new URLSearchParams(window.location.search).get('gcid');
		joinGroupChat(gcid);
	}, [joinGroupChat, setNotifications]);

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
						.then(async () => {
							const matrixBootstrapActive = { current: true };
							try {
								await withTimeout(
									(async () => {
										const matrixLoginData =
											await getMatrixAccessToken();
										persistMatrixLoginData(matrixLoginData);
										const homeserverUrl =
											getMatrixHomeserverUrl();
										if (homeserverUrl) {
											const { MatrixClientService } =
												await import(
													'../../services/matrixClientService'
												);
											const matrixClientService =
												new MatrixClientService();
											await matrixClientService.initializeClient(
												{
													userId: matrixLoginData.userId,
													accessToken:
														matrixLoginData.accessToken,
													deviceId:
														matrixLoginData.deviceId,
													homeserverUrl
												}
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

	const handlePostRegLoaderFinish = useCallback(() => {
		setShowPostRegLoader(false);
	}, []);

	// Post-registration: bridge the bootstrap load with the welcome animation,
	// driven by appReady (the real "everything loaded" signal). Falls through to the
	// usual branches on error (loading=false, appReady=false → redirect to login).
	if (showPostRegLoader && (loading || appReady)) {
		return (
			<RegistrationLoader
				ready={appReady}
				onFinish={handlePostRegLoaderFinish}
			/>
		);
	}

	if (appReady) {
		return (
			<>
				<E2EEncryptionSupportBanner />
				<KeyBackupRecoveryPrompt />
				<Routing logout={handleLogout} />
			</>
		);
	} else if (loading) {
		return <Loading />;
	}

	return <Navigate to="/login" replace />;
};
