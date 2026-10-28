import '@mui/material/styles/styled';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Context as ResponsiveContext } from 'react-responsive';
import { ThemeProvider } from '@mui/material';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '../../src/resources/i18n/en/common.json';
import theme from '../../src/resources/scripts/theme';
import '../../src/resources/styles/styles.scss';
import '../../src/resources/styles/mui-variables-mapping.scss';
import {
	ActiveSessionContext,
	UserDataContext,
	SessionTypeContext,
	ConsultantListContext,
	ConsultingTypesContext,
	TopicsContext,
	SessionsDataContext,
	ServerSettingsContext
} from '../../src/globalState';
import { NotificationsContext } from '../../src/globalState/provider/NotificationsProvider';
import { LocaleContext } from '../../src/globalState/context/LocaleContext';
import { MatrixClientContext } from '../../src/globalState/context/MatrixClientContext';
import { MatrixClientService } from '../../src/services/matrixClientService';
import { setMatrixClientServiceRef } from '../../src/services/matrixClientRegistry';
import { setTenantSettings } from '../../src/utils/tenantSettingsHelper';
import { setAppConfig } from '../../src/utils/appConfig';
import { SessionStream } from '../../src/components/session/SessionStream';
import { SESSION_LIST_TYPES } from '../../src/components/session/sessionHelpers';

const translations = createInstance().use(initReactI18next);
await translations.init({
	lng: 'en',
	fallbackLng: 'en',
	resources: { en: { common: en } },
	defaultNS: 'common',
	ns: ['common']
});
setTenantSettings({ featureTeamDiscussionEnabled: false } as any);
setAppConfig({ releaseToggles: {} } as any);
const service = new MatrixClientService();
await service.initializeClient({
	userId: '@history-reader:example.org',
	deviceId: 'HISTORY_FIXTURE',
	accessToken: 'synthetic-history-token',
	homeserverUrl: 'http://127.0.0.1:9021'
});
setMatrixClientServiceRef(service);
if (
	!service.isReady() &&
	!new URLSearchParams(window.location.search).has('cold')
) {
	await new Promise<void>((resolve) => {
		const detach = service.onSyncStateChange((state) => {
			if (state === 'PREPARED' || state === 'SYNCING') {
				detach();
				resolve();
			}
		});
	});
}
window.addEventListener('pagehide', () => {
	service.stopAndCleanup();
	setMatrixClientServiceRef(null);
});
const activeSession = {
	isGroup: false,
	isSession: true,
	isEnquiry: false,
	consultant: { id: 'history-reader', username: 'History reader' },
	user: { username: 'Synthetic asker', userId: 'history-asker' },
	item: {
		id: 1718,
		topic: {},
		matrixRoomId: '!history:example.org',
		status: 2,
		active: true,
		agencyId: 1,
		consultingType: 0,
		conversationType: 'AGENCY_COUNSELLING',
		askerMatrixUserId: '@history-asker:example.org'
	}
};
const providers: [React.Context<any>, any][] = [
	[ResponsiveContext, { width: 1440 }],
	[
		UserDataContext,
		{
			userData: {
				userId: 'history-reader',
				userName: 'History reader',
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
				agencies: [{ id: 1 }],
				preferredLanguage: 'en'
			},
			setUserData: () => {}
		}
	],
	[
		ActiveSessionContext,
		{
			activeSession,
			reloadActiveSession: () => {},
			readActiveSession: () => {}
		}
	],
	[
		SessionTypeContext,
		{
			type: SESSION_LIST_TYPES.MY_SESSION,
			path: '/sessions/consultant/sessionView'
		}
	],
	[
		ConsultantListContext,
		{ consultantList: [], setConsultantList: () => {} }
	],
	[ServerSettingsContext, { getSetting: () => undefined }],
	[SessionsDataContext, { sessionsData: {}, dispatch: () => {} }],
	[TopicsContext, { topics: [], setTopics: () => {} }],
	[
		ConsultingTypesContext,
		{
			consultingTypes: [{ id: 0, isVideoCallAllowed: false }],
			setConsultingTypes: () => {}
		}
	],
	[
		NotificationsContext,
		{
			notifications: [],
			notificationFeed: [],
			addEventNotification: (notification: { eventType?: string }) => {
				const observations = document.getElementById(
					'notification-observations'
				);
				if (observations)
					observations.textContent += `${notification.eventType}\n`;
			}
		}
	],
	[LocaleContext, { locale: 'en' }],
	[
		MatrixClientContext,
		{ matrixClientService: service, setMatrixClientService: () => {} }
	]
];
createRoot(document.getElementById('root')!).render(
	<I18nextProvider i18n={translations}>
		<ThemeProvider theme={theme}>
			<MemoryRouter
				initialEntries={['/sessions/consultant/sessionView/1718']}
			>
				{providers.reduceRight(
					(child, [Context, value]) => (
						<Context.Provider value={value}>
							{child}
						</Context.Provider>
					),
					<SessionStream
						readonly={false}
						bannedUsers={[]}
						checkMutedUserForThisSession={() => {}}
					/>
				)}
			</MemoryRouter>
		</ThemeProvider>
	</I18nextProvider>
);
