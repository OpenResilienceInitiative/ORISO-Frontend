import '@mui/material/styles/styled';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import de from '../../src/resources/i18n/de/common.json';
import en from '../../src/resources/i18n/en/common.json';
import theme from '../../src/resources/scripts/theme';
import '../../src/resources/styles/styles.scss';
import '../../src/resources/styles/mui-variables-mapping.scss';
import {
	NotificationsProvider,
	NotificationsContext
} from '../../src/globalState/provider/NotificationsProvider';
import { NotificationsCenter } from '../../src/components/notificationsCenter/NotificationsCenter';
import { UserDataContext, SessionsDataContext } from '../../src/globalState';
import { setAppConfig } from '../../src/utils/appConfig';
const lang = new URLSearchParams(location.search).get('locale') || 'de';
await i18n.use(initReactI18next).init({
	lng: lang,
	fallbackLng: 'de',
	resources: { de: { common: de }, en: { common: en } },
	defaultNS: 'common',
	ns: ['common'],
	interpolation: { escapeValue: false }
});
const token =
	btoa(JSON.stringify({ alg: 'none' })) +
	'.' +
	btoa(
		JSON.stringify({
			sub: 'local-synthetic-1665',
			sid: 'fixture-session-A',
			tenantId: 77,
			exp: 4102444800
		})
	) +
	'.fixture';
document.cookie = 'keycloak=' + token + ';path=/';
setAppConfig({ releaseToggles: { enableNewNotifications: true } } as any);
function FixtureControls() {
	const ctx = React.useContext(NotificationsContext)!;
	(window as any).fixture = { refresh: ctx.refreshNotificationFeed };
	return (
		<aside
			style={{
				padding: '12px',
				background: '#fff3cd',
				borderBottom: '1px solid #c9ad44',
				fontFamily: 'sans-serif'
			}}
		>
			<strong>
				LOCAL SYNTHETIC FIXTURE — no Dev, real accounts or mail
			</strong>
			<div role="status" data-testid="state">
				Unread {ctx.unreadNotificationCount} ·{' '}
				{ctx.notificationFeed
					.map((x) => x.id + ':' + (x.readAt ? 'read' : 'unread'))
					.join(',')}
			</div>
			<button onClick={() => ctx.markNotificationAsRead('2')}>
				Fixture read 2
			</button>{' '}
			<button onClick={ctx.markAllNotificationsAsRead}>
				Fixture read all
			</button>{' '}
			<button onClick={ctx.clearNotificationFeed}>Fixture clear</button>{' '}
			<button onClick={ctx.refreshNotificationFeed}>
				Fixture refresh
			</button>
		</aside>
	);
}
createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<I18nextProvider i18n={i18n}>
			<ThemeProvider theme={theme}>
				<MemoryRouter initialEntries={['/notifications']}>
					<UserDataContext.Provider
						value={
							{
								userData: {
									userId: 'local-synthetic-1665',
									userName: 'Synthetic counsellor',
									grantedAuthorities: [
										'ROLE_CONSULTANT_DEFAULT'
									],
									agencies: [],
									isWalkThroughEnabled: false
								},
								setUserData: () => {}
							} as any
						}
					>
						<SessionsDataContext.Provider
							value={{
								sessions: [],
								ready: true,
								dispatch: () => {}
							}}
						>
							<NotificationsProvider>
								<FixtureControls />
								<NotificationsCenter />
							</NotificationsProvider>
						</SessionsDataContext.Provider>
					</UserDataContext.Provider>
				</MemoryRouter>
			</ThemeProvider>
		</I18nextProvider>
	</React.StrictMode>
);
