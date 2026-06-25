import './polyfill';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './compound.css';
import { App } from './components/app/app';
import { Stage } from './components/stage/stage';
import { config, routePathNames } from './resources/scripts/config';
import { ThemeProvider } from '@mui/material';
import { UrlParamsProvider } from './globalState/provider/UrlParamsProvider';
import { RegistrationProvider } from './globalState';
import { lazy, useEffect, useState } from 'react';
import './resources/styles/mui-variables-mapping.scss';
import { createAppTheme } from './resources/scripts/theme';
import { THEME_APPLIED_EVENT } from './utils/theme/applyTenantTheme';
import { Redirect } from 'react-router-dom';
import { Privacy } from './components/legalInformationLinks/Privacy';
import { Imprint } from './components/legalInformationLinks/Imprint';

const ThemeDemo = lazy(() =>
	import('./components/themeDemo/ThemeDemo').then((m) => ({
		default: m.ThemeDemo
	}))
);

const Registration = lazy(() =>
	import('./components/registration/Registration').then((m) => ({
		default: m.Registration
	}))
);

const NewRegistration = () => (
	<UrlParamsProvider>
		<RegistrationProvider>
			<Registration />
		</RegistrationProvider>
	</UrlParamsProvider>
);

// Recreates the MUI theme when the runtime tenant palette lands at
// :root (THB-05) — theme.jsx reads computed --m3-* values at creation.
const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [theme, setTheme] = useState(() => createAppTheme());

	useEffect(() => {
		const refresh = () => setTheme(createAppTheme());
		window.addEventListener(THEME_APPLIED_EVENT, refresh);
		return () => window.removeEventListener(THEME_APPLIED_EVENT, refresh);
	}, []);

	return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

// React 19 uses createRoot API
const container = document.getElementById('appRoot');
if (container) {
	const root = createRoot(container);
	root.render(
		<AppThemeProvider>
			<App
				config={config}
				extraRoutes={[
					{
						// Auth-free theme demo for the admin's iframe preview
						// (Frontend#144): real markup, mock content, no API.
						route: { path: '/theme-demo' },
						component: ThemeDemo
					},
					{
						route: {
							path: [
								'/registration/:step?',
								'/:topicSlug/registration/:step?'
							]
						},
						component: NewRegistration
					},
					{
						route: {
							path: '/themen'
						},
						component: () => (
							<Redirect
								to={'/registration/topic-selection'}
								from={'/themen'}
							/>
						)
					},
					// {
					// 	route: { path: routePathNames.termsAndConditions },
					// 	component: TermsAndConditions
					// },
					{
						route: { path: routePathNames.imprint },
						component: Imprint
					},
					{
						route: { path: routePathNames.privacy },
						component: Privacy
					}
				]}
				stageComponent={Stage}
			/>
		</AppThemeProvider>
	);
}
