import './configureMatrixLogging';
import './polyfill';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './compound.css';
import { App } from './components/app/app';
import { Stage } from './components/stage/stage';
import { config, routePathNames } from './resources/scripts/config';
import { UrlParamsProvider } from './globalState/provider/UrlParamsProvider';
import { RegistrationProvider } from './globalState';
import './resources/styles/mui-variables-mapping.scss';
import { syncLocalTenantCookie } from './utils/localTenantCookie';
import { purgeLegacyDraftStorage } from './services/clientStorageHygiene';
import { purgeParkedRecoveryKeys } from './services/pendingRecoveryKeyStore';
import { Navigate } from 'react-router-dom';
import { Privacy } from './components/legalInformationLinks/Privacy';
import { Imprint } from './components/legalInformationLinks/Imprint';
import { initMeterProvider } from './utils/observability/meterProvider';
import { initWebVitals } from './utils/observability/webVitals';
import { initUtdTracking } from './utils/observability/utdTracker';
import { lazyWithReload } from './utils/chunkLoadRecovery';
import { installAddonShared } from './addons/addonShared';
import { AppThemeProvider } from './resources/scripts/AppThemeProvider';

// OBS-P8 (ORISO-Helm#62): browser-side Real User Monitoring. Register the
// MeterProvider before anything else gets a chance to call
// metrics.getMeter(...) -- a meter obtained before this runs stays a no-op
// meter forever, even after this later registers a real provider -- then
// wire up the Web Vitals capture, which only needs to run once per page
// load. Both are best-effort: see the try/catch in each module.
initMeterProvider();
initWebVitals();
// OBS-P9 (ORISO-Helm#62, ORISO-Frontend#440): Unable-To-Decrypt (UTD)
// failure tracking for encrypted counselling conversations.
initUtdTracking();

const ThemeDemo = lazyWithReload(() =>
	import('./components/themeDemo/ThemeDemo').then((m) => ({
		default: m.ThemeDemo
	}))
);

const Registration = lazyWithReload(() =>
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

// #1071: devices that ran an older build still carry counselling drafts in
// plaintext under `oriso.chatDrafts.v1`. Drafts have been server-side and
// room-key encrypted for a while; this drops the leftovers on first load.
purgeLegacyDraftStorage();
// Parked recovery keys the login password protects expire after a week.
purgeParkedRecoveryKeys('expired');

// Add-ons render with this React instead of bundling their own (ADR-034).
installAddonShared();

// React 19 uses createRoot API
syncLocalTenantCookie();

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
						// v7 dropped optional params (:step?), so the wizard's
						// step is captured by explicit routes; Registration reads
						// it via useParams and renders the WelcomeScreen when absent.
						route: {
							path: [
								'/registration',
								'/registration/:step',
								'/:topicSlug/registration',
								'/:topicSlug/registration/:step'
							]
						},
						component: NewRegistration
					},
					{
						route: {
							path: '/themen'
						},
						component: () => (
							<Navigate
								to={'/registration/topic-selection'}
								replace
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
