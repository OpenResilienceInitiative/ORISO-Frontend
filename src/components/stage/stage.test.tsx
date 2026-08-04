// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage } from './stage';
import { TenantContext } from '../../globalState/provider/TenantProvider';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>
}));

vi.mock('../spinner/Spinner', () => ({
	Spinner: () => <div data-testid="spinner" />
}));

// Reached transitively through the globalState interfaces barrel; lottie-web
// wants a real canvas that jsdom does not provide. Unrelated to the stage.
vi.mock('lottie-react', () => ({
	default: () => null
}));

afterEach(cleanup);

const tenantWithLogo = (logo: string) =>
	({
		id: 1,
		name: 'Example Tenant',
		theming: { logo }
	}) as any;

describe('Stage logo', () => {
	it('renders the tenant logo when one is configured', () => {
		render(
			<TenantContext.Provider
				value={{
					tenant: tenantWithLogo('https://cdn.example.test/logo.svg'),
					setTenant: vi.fn()
				}}
			>
				<Stage />
			</TenantContext.Provider>
		);

		const logo = screen.getByRole('img');
		expect(logo.getAttribute('src')).toBe(
			'https://cdn.example.test/logo.svg'
		);
		expect(logo.getAttribute('alt')).toBe('Example Tenant');
	});

	it('renders no logo, and no third-party fallback, when the tenant has none', () => {
		render(
			<TenantContext.Provider
				value={{ tenant: undefined, setTenant: vi.fn() }}
			>
				<Stage />
			</TenantContext.Provider>
		);

		expect(screen.queryByRole('img')).toBeNull();
	});

	// TenantContext defaults to null; Stage also renders on pre-auth and legal
	// pages, so destructuring the context would crash the whole screen.
	it('renders without a TenantProvider at all', () => {
		expect(() => render(<Stage />)).not.toThrow();
		expect(screen.queryByRole('img')).toBeNull();
	});
});
