import * as React from 'react';
import { Redirect } from 'react-router-dom';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Routing } from './Routing';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	ConsultingTypesContext,
	RocketChatProvider,
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
import { RocketChatSubscriptionsProvider } from '../../globalState/provider/RocketChatSubscriptionsProvider';
import { RocketChatUnreadProvider } from '../../globalState/provider/RocketChatUnreadProvider';
import { RocketChatPublicSettingsProvider } from '../../globalState/provider/RocketChatPublicSettingsProvider';
import { RocketChatGetUserRolesProvider } from '../../globalState/provider/RocketChatSytemUsersProvider';
import { useJoinGroupChat } from '../../hooks/useJoinGroupChat';
import { useCall } from '../../globalState/provider/CallProvider';
import { RocketChatUserStatusProvider } from '../../globalState/provider/RocketChatUserStatusProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { E2EEncryptionSupportBanner } from '../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner';
import {
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../sessionCookie/getMatrixAccessToken';
import { matrixClientService } from '../../services/matrixClientService';
import { MatrixClientProvider } from '../../contexts/MatrixClientContext';

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

	const [appReady, setAppReady] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	const [userDataRequested, setUserDataRequested] = useState<boolean>(false);
	// Freshly-registered askers get a welcome loading animation bridging the
	// bootstrap below (one-shot flag set just before the post-registration redirect).
	const [showPostRegLoader, setShowPostRegLoader] = useState<boolean>(
		() => sessionStorage.getItem(POST_REGISTRATION_LOADER_KEY) === 'true'
	);

	useEffect(() => {
		// Consume the one-shot flag so a later manual reload shows the normal spinner.
		if (sessionStorage.getItem(POST_REGISTRATION_LOADER_KEY) === 'true') {
			sessionStorage.removeItem(POST_REGISTRATION_LOADER_KEY);
		}
	}, []);

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
							// set informal / formal cookie depending on the given userdata
							setInformal(!userProfileData.formalLanguage);
							setConsultingTypes(consultingTypes);

							if (userProfileData.preferredLanguage) {
								setLocale(userProfileData.preferredLanguage);
							}
							return userProfileData;
						})
						.then(async (userProfileData) => {
							// 🔷 CRITICAL: Initialize Matrix client for all authenticated users
							try {
								const matrixLoginData =
									await getMatrixAccessToken();
								persistMatrixLoginData(matrixLoginData);
								try {
									matrixClientService.initializeClient(
										matrixLoginData
									);
									(window as any).callContext = callContext;
								} catch (error) {
									// console.warn('⚠️ Matrix client initialization failed:', error);
									// Don't fail app startup if Matrix fails
								}
							} catch {
								// console.warn('⚠️ No Matrix credentials found in localStorage');
							}

							setAppReady(true);
						})
						.catch((error) => {
							setLoading(false);
							// console.log(error);
						});
				})
				.catch(() => {
					setLoading(false);
				});
		}
	}, [
		locale,
		setConsultingTypes,
		setInformal,
		setLocale,
		reloadUserData,
		userDataRequested
	]);

	useEffect(() => {
		onAppReady();
	}, [appReady]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleLogout = useCallback(() => {
		onLogout();
		logout();
	}, [onLogout]);

	// Post-registration: bridge the bootstrap load with the welcome animation,
	// driven by appReady (the real "everything loaded" signal). Falls through to the
	// usual branches on error (loading=false, appReady=false → redirect to login).
	if (showPostRegLoader && (loading || appReady)) {
		return (
			<RegistrationLoader
				ready={appReady}
				onFinish={() => setShowPostRegLoader(false)}
			/>
		);
	}

	if (appReady) {
		return (
			<MatrixClientProvider>
				<RocketChatProvider>
					<RocketChatGetUserRolesProvider>
						<RocketChatPublicSettingsProvider>
							<RocketChatSubscriptionsProvider>
								<RocketChatUnreadProvider>
									<RocketChatUserStatusProvider>
										<E2EEncryptionSupportBanner />
										<Routing logout={handleLogout} />
									</RocketChatUserStatusProvider>
								</RocketChatUnreadProvider>
							</RocketChatSubscriptionsProvider>
						</RocketChatPublicSettingsProvider>
					</RocketChatGetUserRolesProvider>
				</RocketChatProvider>
			</MatrixClientProvider>
		);
	} else if (loading) {
		return <Loading />;
	}

	return <Redirect to="/login" />;
};
