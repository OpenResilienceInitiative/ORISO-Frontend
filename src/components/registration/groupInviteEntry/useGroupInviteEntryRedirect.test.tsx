// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useGroupInviteEntryRedirect } from './useGroupInviteEntryRedirect';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';

/*
 * The login page is where every invite link lands (#1499). A newcomer is handed
 * straight to the designed entry screen (Storybook 0a); someone who pressed
 * "Einloggen" there gets the login form with the link still in the URL.
 */

const Where = () => {
	const location = useLocation();
	return (
		<div data-testid="where">{`${location.pathname}${location.search}`}</div>
	);
};

const LoginStub = () => {
	const redirecting = useGroupInviteEntryRedirect();
	return (
		<>
			<Where />
			{!redirecting && <div data-testid="login-form" />}
		</>
	);
};

const renderAt = (
	entry: string | { pathname: string; search: string; state: unknown }
) =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<Routes>
				<Route path="/login" element={<LoginStub />} />
				<Route path="/registration/:step" element={<Where />} />
			</Routes>
		</MemoryRouter>
	);

const where = () => screen.getByTestId('where').textContent;

afterEach(() => {
	document.cookie =
		'keycloak=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	cleanup();
});

describe('invite link on the login page', () => {
	it('sends a newcomer straight to the entry screen, keeping gcid and aid', () => {
		renderAt('/login?gcid=19&aid=19');
		expect(where()).toBe('/registration/account-data?gcid=19&aid=19');
	});

	it('"Einloggen" from the entry shows the login form with the link intact', () => {
		renderAt({
			pathname: '/login',
			search: '?gcid=19&aid=19',
			state: INVITE_LOGIN_STATE
		});
		expect(where()).toBe('/login?gcid=19&aid=19');
		expect(screen.getByTestId('login-form')).toBeTruthy();
	});

	it('leaves a signed-in visitor to the existing join', () => {
		document.cookie = 'keycloak=token; path=/';
		renderAt('/login?gcid=19&aid=19');
		expect(where()).toBe('/login?gcid=19&aid=19');
	});

	it('leaves an old link without the agency on the login page', () => {
		renderAt('/login?gcid=19');
		expect(where()).toBe('/login?gcid=19');
		expect(screen.getByTestId('login-form')).toBeTruthy();
	});
});
