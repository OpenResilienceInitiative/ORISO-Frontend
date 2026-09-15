// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from './LocaleProvider';
import { LocaleContext } from '../context/LocaleContext';

// `../../globalState` is a barrel that drags in the animated illustration,
// whose lottie player touches a canvas 2d context at module load.
vi.mock('lottie-react', () => ({ default: () => null }));

const mocks = vi.hoisted(() => ({
	init: vi.fn(),
	changeLanguage: vi.fn(),
	tenant: {
		settings: { activeLanguages: ['de'] }
	} as { settings: { activeLanguages: string[] } } | null
}));

vi.mock('../../i18n', () => ({
	default: { language: 'de', changeLanguage: mocks.changeLanguage },
	init: mocks.init,
	FALLBACK_LNG: 'de'
}));

// The tenant the provider reads; the theming hook itself is inert here.
vi.mock('./TenantProvider', () => ({
	useTenant: () => mocks.tenant
}));
vi.mock('../../utils/useTenantTheming', () => ({ default: () => false }));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		useTenantService: true,
		i18n: { supportedLngs: ['de'] },
		translation: {}
	})
}));

const Probe = () => {
	const context = React.useContext(LocaleContext);
	return (
		<span data-testid="locales">{(context?.locales ?? []).join(',')}</span>
	);
};

const renderProvider = () =>
	render(
		<LocaleProvider>
			<Probe />
		</LocaleProvider>
	);

describe('LocaleProvider – tenant switch', () => {
	beforeEach(() => {
		cleanup();
		vi.clearAllMocks();
		localStorage.clear();
		mocks.tenant = { settings: { activeLanguages: ['de'] } };
		// i18next reports the supported languages it settled on, deduplicated
		// and without the informal variants the picker never offers.
		mocks.init.mockImplementation(async (options: any) => [
			...new Set(
				((options.supportedLngs ?? ['de']) as string[]).filter(
					(lng) => !lng.includes('@informal')
				)
			)
		]);
	});

	// Signing in switches the tenant inside this provider. A counsellor whose
	// Träger offers Russian must get Russian — the language list was built on
	// the login screen, for the subdomain tenant.
	it('rebuilds the language list when the tenant changes', async () => {
		const view = renderProvider();

		await waitFor(() =>
			expect(screen.getByTestId('locales').textContent).toBe('de')
		);

		mocks.tenant = { settings: { activeLanguages: ['de', 'ru'] } };
		view.rerender(
			<LocaleProvider>
				<Probe />
			</LocaleProvider>
		);

		await waitFor(() =>
			expect(screen.getByTestId('locales').textContent).toBe('de,ru')
		);
	});

	it('does not re-initialise while the tenant languages stay the same', async () => {
		const view = renderProvider();

		await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));

		view.rerender(
			<LocaleProvider>
				<Probe />
			</LocaleProvider>
		);

		await waitFor(() =>
			expect(screen.getByTestId('locales').textContent).toBe('de')
		);
		expect(mocks.init).toHaveBeenCalledTimes(1);
	});
});
