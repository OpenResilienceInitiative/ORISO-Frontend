import * as React from 'react';
import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SessionTypeProvider } from '../../globalState';
import { SessionListViewStateProvider } from '../sessionsList/SessionListViewStateContext';
import { Loading } from './Loading';
import { toV7Paths, stripPrefix } from '../../utils/routeHelpers';

const SESSIONS_PREFIX = '/sessions/';

/**
 * The two-column session view (list + detail). Both columns render
 * simultaneously for the same `/sessions/...` URL — in v7 each `<Routes>`
 * matches the descendant path (the parent's `sessions/*` splat) independently,
 * which reproduces the v5 parallel-panel layout where the list stays mounted
 * while the detail column swaps.
 *
 * `type` is still passed both as a prop and via `SessionTypeProvider` (context),
 * exactly as in v5 — components read whichever they already used. The v5
 * `render`-prop `logout`/`match` spreads were unused by these components and are
 * dropped.
 */
export const SessionsZone = ({ routerConfig }: { routerConfig: any }) => (
	<SessionListViewStateProvider>
		<div className="contentWrapper__list">
			<Routes>
				{(routerConfig.listRoutes ?? []).flatMap((route: any) =>
					toV7Paths(route).map((path) => (
						<Route
							key={`list-${path}`}
							path={stripPrefix(path, SESSIONS_PREFIX)}
							element={
								<SessionTypeProvider type={route.type || null}>
									<route.component
										sessionTypes={route.sessionTypes}
									/>
								</SessionTypeProvider>
							}
						/>
					))
				)}
			</Routes>
		</div>
		<div className="contentWrapper__detail">
			<Suspense fallback={<Loading />}>
				<Routes>
					{(routerConfig.userProfileRoutes ?? []).flatMap(
						(route: any) =>
							toV7Paths(route).map((path) => (
								<Route
									key={`userProfile-${path}`}
									path={stripPrefix(path, SESSIONS_PREFIX)}
									element={
										<div className="contentWrapper__userProfile">
											<SessionTypeProvider
												type={route.type || null}
											>
												<route.component
													type={route.type || null}
												/>
											</SessionTypeProvider>
										</div>
									}
								/>
							))
					)}
					{(routerConfig.detailRoutes ?? []).flatMap((route: any) =>
						toV7Paths(route).map((path) => (
							<Route
								key={`detail-${path}`}
								path={stripPrefix(path, SESSIONS_PREFIX)}
								element={
									<SessionTypeProvider
										type={route.type || null}
									>
										<route.component
											type={route.type || null}
										/>
									</SessionTypeProvider>
								}
							/>
						))
					)}
					<Route path="*" element={null} />
				</Routes>
			</Suspense>
		</div>
	</SessionListViewStateProvider>
);
