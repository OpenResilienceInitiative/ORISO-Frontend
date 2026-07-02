import '../../polyfill';
import * as React from 'react';
import { ComponentType, useState, lazy, Suspense, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StageProps } from '../stage/stage';
import '../../resources/styles/styles';
import { ContextProvider } from '../../globalState/state';
import { WebsocketHandler } from './WebsocketHandler';
import ErrorBoundary from './ErrorBoundary';
import { LanguagesProvider } from '../../globalState/provider/LanguagesProvider';
import { TenantThemingLoader } from './TenantThemingLoader';
import {
	AppConfigProvider,
	InformalProvider,
	LocaleProvider,
	NotificationsContext,
	TenantProvider
} from '../../globalState';
import {
	AppConfigInterface,
	LegalLinkInterface
} from '../../globalState/interfaces';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { DevToolbarWrapper } from '../devToolbar/DevToolbar';
import { PreConditions, preConditionsMet } from './PreConditions';
import { Loading } from './Loading';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsProvider } from '../../globalState/provider/UrlParamsProvider';
import { Notifications } from '../notifications/Notifications';
import { CallProvider } from '../../globalState/provider/CallProvider';
import { MatrixClientProvider } from '../../globalState/context/MatrixClientContext';
import { FloatingCallWidget } from '../call/FloatingCallWidget';
import { GroupCallWidget } from '../call/GroupCallWidget';

const Login = lazy(() =>
	import('../login/Login').then((m) => ({ default: m.Login }))
);
const AuthenticatedApp = lazy(() =>
	import('./AuthenticatedApp').then((m) => ({ default: m.AuthenticatedApp }))
);
const InviteLink = lazy(() =>
	import('../invite/InviteLink').then((m) => ({
		default: m.InviteLink
	}))
);

const VideoConference = lazy(
	() => import('../videoConference/VideoConference')
);
const VideoCall = lazy(() => import('../videoCall/VideoCall'));

type TExtraRoute = {
	route: { path: string | string[] };
	component: ComponentType;
};

export interface AppProps {
	stageComponent: ComponentType<StageProps>;
	legalLinks?: Array<LegalLinkInterface>;
	extraRoutes?: TExtraRoute[];
	spokenLanguages?: string[];
	fixedLanguages?: string[];
	config: AppConfigInterface;
}

export const App = ({
	stageComponent,
	legalLinks,
	extraRoutes = [],
	spokenLanguages = null,
	fixedLanguages = ['de'],
	config
}: AppProps) => {
	// The login is possible both at the root URL as well as with an
	// optional resort name. Since resort names are dynamic, we have
	// to find out if the provided path is a resort name. If not, we
	// use the authenticated app as a catch-all fallback.

	return (
		<ErrorBoundary>
			<AppConfigProvider config={config}>
				<TenantProvider>
					<InformalProvider>
						<LocaleProvider>
							<LanguagesProvider
								fixed={fixedLanguages}
								spoken={spokenLanguages}
							>
								<LegalLinksProvider legalLinks={legalLinks}>
									<GlobalComponentContext.Provider
										value={{ Stage: stageComponent }}
									>
										<RouterWrapper
											extraRoutes={extraRoutes}
										/>
									</GlobalComponentContext.Provider>
								</LegalLinksProvider>
							</LanguagesProvider>
						</LocaleProvider>
					</InformalProvider>
				</TenantProvider>
				<DevToolbarWrapper />
			</AppConfigProvider>
		</ErrorBoundary>
	);
};

interface RouterWrapperProps {
	extraRoutes?: TExtraRoute[];
}

const RouterWrapper = ({ extraRoutes }: RouterWrapperProps) => {
	const settings = useAppConfig();

	// Request notification permission for incoming calls
	useNotificationPermission();

	const [startWebsocket, setStartWebsocket] = useState<boolean>(false);
	const [disconnectWebsocket, setDisconnectWebsocket] =
		useState<boolean>(false);
	const [failedPreCondition, setFailedPreCondition] =
		useState(preConditionsMet());

	if (failedPreCondition) {
		return <PreConditions onPreConditionsMet={setFailedPreCondition} />;
	}

	return (
		<Router>
			{/* v7: providers move above <Routes> (they use no routing hooks);
			    the old pathless catch-all <Route> wrapper is gone. */}
			<ContextProvider>
				<CallProvider>
					<MatrixClientProvider>
						<TenantThemingLoader />
						{startWebsocket && (
							<WebsocketHandler
								disconnect={disconnectWebsocket}
							/>
						)}
						<Suspense fallback={<Loading />}>
							<Routes>
								{settings.urls.landingpage !== '/' && (
									<Route
										path="/"
										element={
											<Navigate
												to={settings.urls.landingpage}
												replace
											/>
										}
									/>
								)}

								{/* Injected routes (registration, legal pages,
								    theme demo); array paths → one <Route> each. */}
								{extraRoutes.flatMap(
									({ route, component: Component }) =>
										(Array.isArray(route.path)
											? route.path
											: [route.path]
										).map((path) => (
											<Route
												key={path}
												path={path}
												element={<Component />}
											/>
										))
								)}

								<Route
									path="/invite/:token"
									element={<InviteLink />}
								/>
								<Route
									path="/invite/:token/:topicSlug"
									element={<InviteLink />}
								/>
								<Route
									path="/login"
									element={
										<UrlParamsProvider>
											<Login />
										</UrlParamsProvider>
									}
								/>
								<Route
									path={settings.urls.videoConference}
									element={<VideoConference />}
								/>
								<Route
									path={settings.urls.videoCall}
									element={<VideoCall />}
								/>

								{/* Catch-all: the authenticated app owns its own
								    routing and redirects to /login when signed out. */}
								<Route
									path="*"
									element={
										<AuthenticatedApp
											onAppReady={() =>
												setStartWebsocket(true)
											}
											onLogout={() =>
												setDisconnectWebsocket(true)
											}
										/>
									}
								/>
							</Routes>
							<NotificationsContainer />
							<FloatingCallWidget />
							<GroupCallWidget />
						</Suspense>
					</MatrixClientProvider>
				</CallProvider>
			</ContextProvider>
		</Router>
	);
};

const NotificationsContainer = () => {
	const { notifications } = useContext(NotificationsContext);
	return (
		notifications.length > 0 && (
			<Notifications notifications={notifications} />
		)
	);
};
