// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { LocaleProvider } from './LocaleProvider';
import { TenantProvider } from './TenantProvider';
import { AppConfigContext } from './AppConfigProvider';
import { AppConfigInterface } from '../interfaces';
import { setValueInCookie } from '../../components/sessionCookie/accessSessionCookie';

// External animation player needs canvas; this test does not render animations.
vi.mock('lottie-react', () => ({ default: () => null }));
const api = vi.hoisted(() => ({ tenant: vi.fn() }));
vi.mock('../../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: api.tenant
}));

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

beforeEach(() => {
	api.tenant.mockReset();
	localStorage.clear();
	document.cookie = 'keycloak=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
	window.history.replaceState(null, '', '/registration/account-data');
});
afterEach(cleanup);

it('finishes in-flight registration navigation after the authenticated tenant loads', async () => {
	const tenant = deferred<{ settings: { activeLanguages: string[] } }>();
	const completion = deferred<void>();
	api.tenant
		.mockResolvedValueOnce({ settings: { activeLanguages: ['de'] } })
		.mockReturnValueOnce(tenant.promise);

	// Public consumer: sign-in writes the token before its asynchronous
	// handover completes, just as registration waits for Matrix and sessions.
	const Registration = () => {
		const navigate = useNavigate();
		return (
			<button
				onClick={async () => {
					setValueInCookie(
						'keycloak',
						`header.${btoa(JSON.stringify({ tenantId: 14 }))}.signature`
					);
					await completion.promise;
					navigate('/sessions/user/view/session/177');
				}}
			>
				Register
			</button>
		);
	};
	render(
		<AppConfigContext.Provider
			value={
				{
					useTenantService: true,
					i18n: { supportedLngs: ['de'], lng: 'de' },
					translation: {}
				} as AppConfigInterface
			}
		>
			<TenantProvider>
				<LocaleProvider>
					<BrowserRouter>
						<Routes>
							<Route
								path="/registration/account-data"
								element={<Registration />}
							/>
							<Route
								path="/sessions/user/view/session/177"
								element={<h1>Chat room</h1>}
							/>
						</Routes>
					</BrowserRouter>
				</LocaleProvider>
			</TenantProvider>
		</AppConfigContext.Provider>
	);
	fireEvent.click(await screen.findByRole('button', { name: 'Register' }));
	await waitFor(() => expect(api.tenant).toHaveBeenCalledTimes(2));
	await act(async () => {
		tenant.resolve({ settings: { activeLanguages: ['de'] } });
	});
	await screen.findByRole('button', { name: 'Register' });
	await act(async () => {
		completion.resolve();
	});
	// The address alone changed even with the defect. The destination must render.
	expect(window.location.pathname).toBe('/sessions/user/view/session/177');
	expect(
		await screen.findByRole('heading', { name: 'Chat room' })
	).toBeTruthy();
});
