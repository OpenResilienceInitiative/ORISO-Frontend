import * as React from 'react';
import { useContext, useMemo } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { RouterConfigUser, RouterConfigConsultant } from './RouterConfig';
import { AbsenceHandler } from './AbsenceHandler';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	ConsultingTypesContext,
	E2EEProvider
} from '../../globalState';
import { NavigationBar } from './NavigationBar';
import { Header } from '../header/Header';
import { ReleaseNote } from '../releaseNote/ReleaseNote';
import { NonPlainRoutesWrapper } from './NonPlainRoutesWrapper';
import { Walkthrough } from '../walkthrough/Walkthrough';
import { TwoFactorNag } from '../twoFactorAuth/TwoFactorNag';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useAskerHasAssignedConsultant } from '../../containers/bookings/hooks/useAskerHasAssignedConsultant';
import { TermsAndConditions } from '../termsandconditions/TermsAndConditions';
import NotFound from '../notFound/NotFound';
import { SessionsZone } from './SessionsZone';
import { toV7Paths } from '../../utils/routeHelpers';

interface RoutingProps {
	logout?: Function;
}

export const Routing = (props: RoutingProps) => {
	const location = useLocation();
	const settings = useAppConfig();
	const { userData } = useContext(UserDataContext);
	const { consultingTypes } = useContext(ConsultingTypesContext);
	const hasAssignedConsultant = useAskerHasAssignedConsultant();

	const routerConfig = useMemo(() => {
		if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			return RouterConfigConsultant(settings);
		}
		return RouterConfigUser(settings, hasAssignedConsultant);
	}, [userData, settings, hasAssignedConsultant]);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const defaultSessionsPath =
		'/sessions/' +
		(isConsultant ? 'consultant/sessionPreview' : 'user/view');

	const useEmbeddedNotificationsLayout =
		new URLSearchParams(location.search).get('embeddedNotifications') ===
		'1';

	// Child routes of the pathless layout route take relative paths.
	const rel = (path: string) => path.replace(/^\//, '');
	const logout = () => props.logout();

	return (
		<Routes>
			{/* Plain routes render WITHOUT the app shell (no NavigationBar). */}
			{routerConfig.plainRoutes
				?.filter(
					(route: any) =>
						!route.condition ||
						route.condition(userData, consultingTypes)
				)
				.flatMap((route: any) =>
					toV7Paths(route).map((path) => (
						<Route
							key={`plain-${path}`}
							path={path}
							element={<route.component />}
						/>
					))
				)}

			{/* Authenticated app shell (layout route): chrome + <Outlet/>. */}
			<Route
				element={
					<>
						<Walkthrough />
						<E2EEProvider>
							<NonPlainRoutesWrapper logoutHandler={logout}>
								<div
									className={`app__wrapper ${
										useEmbeddedNotificationsLayout
											? 'app__wrapper--embeddedNotifications'
											: ''
									}`}
								>
									<NavigationBar
										routerConfig={routerConfig}
										onLogout={logout}
									/>
									<section className="contentWrapper">
										<Header />
										<div className="contentWrapper__content">
											<Outlet />
										</div>
									</section>
									{/* Privacy / data-protection overlay: askers only
									    (incl. anonymous), not consultants */}
									{hasUserAuthority(
										AUTHORITIES.ASKER_DEFAULT,
										userData
									) && <TermsAndConditions />}
									{hasUserAuthority(
										AUTHORITIES.CONSULTANT_DEFAULT,
										userData
									) && <AbsenceHandler />}
									{hasUserAuthority(
										AUTHORITIES.CONSULTANT_DEFAULT,
										userData
									) && <ReleaseNote />}
									{hasUserAuthority(
										AUTHORITIES.CONSULTANT_DEFAULT,
										userData
									) && <TwoFactorNag />}
								</div>
							</NonPlainRoutesWrapper>
						</E2EEProvider>
					</>
				}
			>
				<Route
					path="sessions/*"
					element={<SessionsZone routerConfig={routerConfig} />}
				/>

				{routerConfig.profileRoutes
					?.filter(
						(route: any) =>
							!route.condition ||
							route.condition(userData, consultingTypes)
					)
					.flatMap((route: any) =>
						toV7Paths(route).map((path) => (
							<Route
								key={`profile-${path}`}
								path={rel(path)}
								element={
									<div className="contentWrapper__profile">
										<route.component
											type={route.type || null}
										/>
									</div>
								}
							/>
						))
					)}

				{routerConfig.appointmentRoutes?.flatMap((route: any) =>
					toV7Paths(route).map((path) => (
						<Route
							key={`booking-${path}`}
							path={rel(path)}
							element={
								<div className="contentWrapper__booking">
									<route.component type={route.type || null} />
								</div>
							}
						/>
					))
				)}

				{routerConfig.toolsRoutes?.flatMap((route: any) =>
					toV7Paths(route).map((path) => (
						<Route
							key={`tools-${path}`}
							path={rel(path)}
							element={
								<div className="contentWrapper__tools">
									<route.component type={route.type || null} />
								</div>
							}
						/>
					))
				)}

				{/* Temporary route for 404 page testing */}
				<Route path="404" element={<NotFound />} />

				{/* Catch-all → default session view for the user's role. */}
				<Route
					path="*"
					element={<Navigate to={defaultSessionsPath} replace />}
				/>
			</Route>
		</Routes>
	);
};
