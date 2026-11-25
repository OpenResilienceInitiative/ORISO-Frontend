// @vitest-environment oriso-jsdom
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	beginLoginHandover,
	endLoginHandover,
	finishLoginHandover,
	isLoginHandoverActive,
	LOGIN_HANDOVER_CONTENT_GRACE_MS,
	resetLoginHandoverForTests
} from './loginHandover';
import { TenantThemingLoader } from './TenantThemingLoader';

/*
 * #2272 review: the app can be ready before the signed-in tenant's theme.
 * Ending the handover then revealed the white theme modal, a second loading
 * screen. The handover waits for the theme on the ready path.
 */

let isLoadingTheme = true;
vi.mock('../../utils/useTenantTheming', () => ({
	default: () => isLoadingTheme
}));
vi.mock('../modal/Modal', () => ({
	Modal: ({ children }: any) => <div data-cy="theme-modal">{children}</div>
}));
vi.mock('../spinner/Spinner', () => ({ Spinner: () => null }));

const frames = () =>
	act(
		() =>
			new Promise<void>((resolve) =>
				setTimeout(resolve, LOGIN_HANDOVER_CONTENT_GRACE_MS + 20)
			)
	);

describe('TenantThemingLoader during a login handover', () => {
	beforeEach(() => {
		isLoadingTheme = true;
		resetLoginHandoverForTests(false);
	});
	afterEach(() => {
		cleanup();
		endLoginHandover();
	});

	it('keeps the handover until the theme is loaded after the app is ready', async () => {
		beginLoginHandover();
		const view = render(<TenantThemingLoader />, { wrapper: MemoryRouter });

		act(() => finishLoginHandover());
		await frames();
		expect(isLoginHandoverActive()).toBe(true);
		expect(
			view.container.querySelector('[data-cy="theme-modal"]')
		).toBeNull();

		isLoadingTheme = false;
		view.rerender(<TenantThemingLoader />, { wrapper: MemoryRouter });
		await frames();
		expect(isLoginHandoverActive()).toBe(false);
		expect(
			view.container.querySelector('[data-cy="theme-modal"]')
		).toBeNull();
	});

	it('shows the theme loader outside the handover until the tenant is resolved', () => {
		const view = render(<TenantThemingLoader />, { wrapper: MemoryRouter });
		expect(
			view.container.querySelector('[data-cy="theme-modal"]')
		).not.toBeNull();

		isLoadingTheme = false;
		view.rerender(<TenantThemingLoader />);
		expect(
			view.container.querySelector('[data-cy="theme-modal"]')
		).toBeNull();
	});

	it('ends at once when the theme is already there', async () => {
		isLoadingTheme = false;
		beginLoginHandover();
		render(<TenantThemingLoader />, { wrapper: MemoryRouter });
		act(() => finishLoginHandover());
		await frames();
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('failure exits still end at once while the theme loads', () => {
		beginLoginHandover();
		render(<TenantThemingLoader />, { wrapper: MemoryRouter });
		act(() => endLoginHandover());
		expect(isLoginHandoverActive()).toBe(false);
	});
});
