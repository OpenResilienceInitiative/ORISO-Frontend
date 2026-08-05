// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { TenantDataInterface } from '../../globalState/interfaces';
import { Stage } from './stage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	Trans: () => null
}));

// lottie-web touches a real canvas at import time, which jsdom does not have.
vi.mock('lottie-react', () => ({ default: () => null }));

const tenantWith = (
	theming: Partial<TenantDataInterface['theming']>
): TenantDataInterface =>
	({
		id: 1,
		name: 'Test tenant',
		theming: {
			logo: '',
			associationLogo: null,
			favicon: '',
			primaryColor: '',
			secondaryColor: '',
			...theming
		},
		content: {}
	}) as TenantDataInterface;

const renderStage = (tenant: TenantDataInterface | undefined) =>
	render(
		<TenantContext.Provider value={{ tenant, setTenant: vi.fn() }}>
			<LegalLinksContext.Provider value={[]}>
				<Stage />
			</LegalLinksContext.Provider>
		</TenantContext.Provider>
	);

const ALT = 'app.stage.associationLogoAlt';

describe('Stage association branding', () => {
	afterEach(cleanup);

	it('shows the association logo the tenant configured', () => {
		renderStage(
			tenantWith({ associationLogo: 'https://cdn.test.local/assoc.svg' })
		);

		expect(screen.getByAltText(ALT).getAttribute('src')).toBe(
			'https://cdn.test.local/assoc.svg'
		);
	});

	it('falls back to the tenant logo when no association logo is set', () => {
		renderStage(tenantWith({ logo: 'https://cdn.test.local/tenant.svg' }));

		expect(screen.getByAltText(ALT).getAttribute('src')).toBe(
			'https://cdn.test.local/tenant.svg'
		);
	});

	it('renders no third-party branding when the tenant configured none', () => {
		renderStage(tenantWith({}));

		expect(screen.queryByAltText(ALT)).toBeNull();
	});

	it('renders no branding at all before tenant data has loaded', () => {
		renderStage(undefined);

		expect(screen.queryByAltText(ALT)).toBeNull();
	});
});
