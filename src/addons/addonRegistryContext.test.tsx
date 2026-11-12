// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	act,
	cleanup,
	render,
	renderHook,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActiveSessionContext, LocaleContext } from '../globalState';
import { apiGetAddonRegistry } from './addonRegistryApi';
import {
	REGISTRY_REFRESH_DEBOUNCE_MS,
	refreshAddonRegistries,
	resetAddonRegistryForTests,
	useAddonRegistry,
	useAddonRegistryLoader,
	useCaseAddonRegistry
} from './addonRegistry';
import { AddonSessionActions } from './AddonSessionActions';
import { AvailableAddon } from './addonTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.count !== undefined ? `${key}:${options.count}` : key
	})
}));

vi.mock('./addonRegistryApi', () => ({
	apiGetAddonRegistry: vi.fn()
}));

const addon = (badge?: number): AvailableAddon => ({
	name: 'digisucht-tools',
	version: '1.0.0',
	entry: '/e.js',
	apiBase: '/api',
	apps: [
		{
			id: 'goals',
			title: { de: 'Ziele' },
			slots: ['consultant.session'],
			badge
		}
	]
});

const context = { agencyId: 3, sessionId: 42 };

describe('add-on registry in context', () => {
	beforeEach(() => {
		resetAddonRegistryForTests();
		vi.mocked(apiGetAddonRegistry).mockReset();
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('loads the case registry with its agency and session once for all users of it', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([addon()]);
		const { result } = renderHook(() => {
			useAddonRegistryLoader('u1');
			const first = useCaseAddonRegistry(context);
			useCaseAddonRegistry(context);
			return first;
		});
		expect(result.current.loaded).toBe(false);
		await waitFor(() => expect(result.current.addons).toHaveLength(1));
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledWith(context);
	});

	it('has no case registry without a session or before the user registry', () => {
		const withoutSession = renderHook(() =>
			useCaseAddonRegistry({ agencyId: 3 })
		);
		const withoutLogin = renderHook(() => useCaseAddonRegistry(context));
		expect(withoutSession.result.current).toEqual({
			addons: [],
			loaded: false
		});
		expect(withoutLogin.result.current.loaded).toBe(false);
		expect(vi.mocked(apiGetAddonRegistry)).not.toHaveBeenCalled();
	});

	it('loads both registries again after a debounced refresh and on window focus', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([addon(1)]);
		const { result } = renderHook(() => {
			useAddonRegistryLoader('u1');
			return {
				global: useAddonRegistry(),
				inCase: useCaseAddonRegistry(context)
			};
		});
		await waitFor(() => expect(result.current.inCase.loaded).toBe(true));
		await waitFor(() => expect(result.current.global.loaded).toBe(true));
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledTimes(2);

		vi.useFakeTimers();
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([addon(5)]);
		act(() => {
			refreshAddonRegistries();
			window.dispatchEvent(new Event('focus'));
			refreshAddonRegistries();
		});
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledTimes(2);
		await act(async () => {
			vi.advanceTimersByTime(REGISTRY_REFRESH_DEBOUNCE_MS);
		});
		vi.useRealTimers();
		await waitFor(() =>
			expect(result.current.inCase.addons[0].apps[0].badge).toBe(5)
		);
		expect(result.current.global.addons[0].apps[0].badge).toBe(5);
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledTimes(4);
	});
});

describe('AddonSessionActions', () => {
	beforeEach(() => {
		resetAddonRegistryForTests();
		vi.mocked(apiGetAddonRegistry).mockReset();
	});
	afterEach(cleanup);

	const Loader = () => {
		useAddonRegistryLoader('u1');
		return null;
	};

	const renderActions = () =>
		render(
			<MemoryRouter>
				<LocaleContext.Provider value={{ locale: 'de' } as never}>
					<ActiveSessionContext.Provider
						value={
							{
								activeSession: {
									item: { id: 42, agencyId: 3 }
								}
							} as never
						}
					>
						<Loader />
						<AddonSessionActions />
					</ActiveSessionContext.Provider>
				</LocaleContext.Provider>
			</MemoryRouter>
		);

	it('shows the button of an add-on in the case registry with its badge', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([addon(150)]);
		renderActions();
		const button = await screen.findByRole('button', {
			name: 'Ziele, addons.badge:150'
		});
		expect(button.textContent).toContain('99+');
		expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalledWith(context);
	});

	it('shows nothing when the case registry does not list the add-on', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([]);
		const { container } = renderActions();
		await waitFor(() =>
			expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalled()
		);
		expect(container.querySelector('button')).toBeNull();
	});
});
