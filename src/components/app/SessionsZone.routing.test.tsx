// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, it, expect } from 'vitest';
import { SessionsZone } from './SessionsZone';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';

/**
 * Routing smoke for the v7 session view. Renders the REAL SessionsZone with a
 * synthetic routerConfig whose paths mirror the real RouterConfig (Matrix-only
 * `session/:id` + `:groupId/:id` variants, optional-param list
 * routes, empty view) but with stub components, so we can assert v7 best-match
 * routing without pulling the whole component graph.
 *
 * This covers the authenticated session URLs that the Playwright public-route
 * smoke cannot reach (they require login).
 */

const stub = (testId: string) => () => <div data-testid={testId} />;

const consultantConfig = {
	listRoutes: [
		{
			path: '/sessions/consultant/sessionView/:groupId?/:sessionId?',
			exact: false,
			component: stub('list'),
			type: SESSION_LIST_TYPES.MY_SESSION
		}
	],
	userProfileRoutes: [
		{
			path: '/sessions/consultant/sessionView/session/:sessionId/userProfile',
			component: stub('askerInfo'),
			type: SESSION_LIST_TYPES.MY_SESSION
		},
		{
			path: '/sessions/consultant/sessionView/:groupId/:sessionId/userProfile',
			component: stub('askerInfo'),
			type: SESSION_LIST_TYPES.MY_SESSION
		}
	],
	detailRoutes: [
		{
			path: '/sessions/consultant/sessionView/session/:sessionId',
			component: stub('sessionView'),
			type: SESSION_LIST_TYPES.MY_SESSION
		},
		{
			path: '/sessions/consultant/sessionView/:groupId/:sessionId/',
			component: stub('sessionView'),
			type: SESSION_LIST_TYPES.MY_SESSION
		},
		{
			path: '/sessions/consultant/sessionView/',
			component: stub('empty'),
			type: SESSION_LIST_TYPES.MY_SESSION
		}
	]
};

const userData = {
	userId: 'c1',
	grantedAuthorities: ['anonymous'],
	userRoles: []
} as any;

// Mount SessionsZone under a `sessions/*` parent route exactly as Routing.tsx
// does, so its descendant <Routes> resolve relative to /sessions/.
const renderAt = (path: string) =>
	render(
		<UserDataContext.Provider
			value={{ userData, reloadUserData: async () => userData } as any}
		>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route
						path="/sessions/*"
						element={
							<SessionsZone routerConfig={consultantConfig} />
						}
					/>
				</Routes>
			</MemoryRouter>
		</UserDataContext.Provider>
	);

describe('SessionsZone v7 routing — consultant', () => {
	afterEach(() => cleanup());

	it('keeps the list column mounted on a detail URL (parallel panels)', () => {
		renderAt('/sessions/consultant/sessionView/session/42');
		// list column stays mounted thanks to the /* splat on the list route
		expect(screen.getByTestId('list')).toBeDefined();
	});

	it('slides the list column away when a mobile detail route is active', () => {
		renderAt('/sessions/consultant/sessionView/session/42');

		expect(screen.getByTestId('list').parentElement?.classList).toContain(
			'contentWrapper__list--smallInactive'
		);
		expect(
			screen.getByTestId('sessionView').parentElement?.classList
		).not.toContain('contentWrapper__detail--smallInactive');
	});

	it('matches the Matrix-only detail route (session/:id)', () => {
		renderAt('/sessions/consultant/sessionView/session/42');
		expect(screen.getByTestId('sessionView')).toBeDefined();
		expect(screen.queryByTestId('empty')).toBeNull();
	});

	it('matches the detail route (:groupId/:id)', () => {
		renderAt('/sessions/consultant/sessionView/GRP1/42');
		expect(screen.getByTestId('sessionView')).toBeDefined();
	});

	it('prefers the more specific userProfile route over the detail route', () => {
		renderAt('/sessions/consultant/sessionView/session/42/userProfile');
		expect(screen.getByTestId('askerInfo')).toBeDefined();
		expect(screen.queryByTestId('sessionView')).toBeNull();
	});

	it('renders the empty session view on the bare list path', () => {
		renderAt('/sessions/consultant/sessionView/');
		expect(screen.getByTestId('empty')).toBeDefined();
		expect(
			screen.getByTestId('list').parentElement?.classList
		).not.toContain('contentWrapper__list--smallInactive');
		expect(screen.getByTestId('empty').parentElement?.classList).toContain(
			'contentWrapper__detail--smallInactive'
		);
	});

	it('toggles list --smallInactive with detail vs empty routes ', () => {
		// Active conversation → list flagged inactive → CSS hides white pill.
		const { unmount } = renderAt(
			'/sessions/consultant/sessionView/session/42'
		);
		expect(screen.getByTestId('list').parentElement?.classList).toContain(
			'contentWrapper__list--smallInactive'
		);
		unmount();

		// Empty desk → no --smallInactive → pill stays visible.
		renderAt('/sessions/consultant/sessionView/');
		expect(
			screen.getByTestId('list').parentElement?.classList
		).not.toContain('contentWrapper__list--smallInactive');
	});
});

// Asker (user) role — the post-registration "Anfrage stellen" enquiry flow and
// the user session deep-links, which mirror RouterConfigUser's optional-param
// list routes + the WriteEnquiry detail route.
const userConfig = {
	listRoutes: [
		{
			path: '/sessions/user/view/write/:sessionId?',
			exact: false,
			component: stub('list')
		},
		{
			path: '/sessions/user/view/:groupId?/:sessionId?',
			exact: false,
			component: stub('list')
		}
	],
	userProfileRoutes: [],
	detailRoutes: [
		{
			path: '/sessions/user/view/write/:sessionId?',
			component: stub('writeEnquiry')
		},
		{
			path: '/sessions/user/view/session/:sessionId',
			component: stub('sessionView')
		},
		{
			path: '/sessions/user/view/:groupId/:sessionId',
			component: stub('sessionView')
		},
		{ path: '/sessions/user/view/', component: stub('empty') }
	]
};

const renderUserAt = (path: string) =>
	render(
		<UserDataContext.Provider
			value={{ userData, reloadUserData: async () => userData } as any}
		>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route
						path="/sessions/*"
						element={<SessionsZone routerConfig={userConfig} />}
					/>
				</Routes>
			</MemoryRouter>
		</UserDataContext.Provider>
	);

describe('SessionsZone v7 routing — asker (user)', () => {
	afterEach(() => cleanup());

	it('mounts WriteEnquiry (enquiry flow) + keeps the list column', () => {
		renderUserAt('/sessions/user/view/write/99');
		expect(screen.getByTestId('writeEnquiry')).toBeDefined();
		expect(screen.getByTestId('list')).toBeDefined();
		expect(screen.queryByTestId('sessionView')).toBeNull();
	});

	it('matches the Matrix-only asker session route (session/:id)', () => {
		renderUserAt('/sessions/user/view/session/42');
		expect(screen.getByTestId('sessionView')).toBeDefined();
	});

	it('matches the asker session route (:groupId/:id)', () => {
		renderUserAt('/sessions/user/view/GRP1/42');
		expect(screen.getByTestId('sessionView')).toBeDefined();
	});

	it('renders the empty session view on the bare list path', () => {
		renderUserAt('/sessions/user/view/');
		expect(screen.getByTestId('empty')).toBeDefined();
	});
});
