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

	useEffect(() => {
		// CRITICAL: Clear ALL old notifications on app mount (prevents phantom call notifications!)
		console.log('🧹 Clearing all old notifications on app mount...');
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
							const matrixUserId = localStorage.getItem('matrix_user_id');
							const matrixAccessToken = localStorage.getItem('matrix_access_token');
							const matrixDeviceId = localStorage.getItem('matrix_device_id');
							
							if (matrixUserId && matrixAccessToken) {
								console.log('🔷 Initializing Matrix client for user:', matrixUserId);
								
								try {
									const { MatrixClientService } = await import('../../services/matrixClientService');
									const matrixClientService = new MatrixClientService();
									
									// Get homeserver URL from settings or use default
									const homeserverUrl = process.env.REACT_APP_MATRIX_HOMESERVER_URL || 'http://91.99.219.182:8008';
									
								matrixClientService.initializeClient({
									userId: matrixUserId,
									accessToken: matrixAccessToken,
									deviceId: matrixDeviceId || undefined,
									homeserverUrl: homeserverUrl
								});
								
								// Store globally for components to access
								(window as any).matrixClientService = matrixClientService;
								(window as any).callContext = callContext; // Make CallContext globally accessible
								
								console.log('✅ Matrix client initialized successfully!');
								
								// CRITICAL: Initialize event bridge IMMEDIATELY after client init
								// This ensures event listeners are registered BEFORE sync starts
								const { matrixLiveEventBridge } = await import('../../services/matrixLiveEventBridge');
								console.log('📞 Initializing Matrix event bridge early...');
								matrixLiveEventBridge.initialize(matrixClientService.getClient()!);
								console.log('✅ Matrix event bridge ready for call events!');
								} catch (error) {
									console.warn('⚠️ Matrix client initialization failed:', error);
									// Don't fail app startup if Matrix fails
								}
							} else {
								console.warn('⚠️ No Matrix credentials found in localStorage');
							}
							
							setAppReady(true);
						})
						.catch((error) => {
							setLoading(false);
							console.log(error);
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

	if (appReady) {
		return (
			<>
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
			</>
		);
	} else if (loading) {
		return <Loading />;
	}

	return <Redirect to="/login" />;
};
