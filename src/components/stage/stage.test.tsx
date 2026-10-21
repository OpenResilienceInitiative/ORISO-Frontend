// @vitest-environment jsdom

import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { TenantDataInterface } from '../../globalState/interfaces';
import { Stage, StageProps } from './stage';

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

const stageView = (
	tenant: TenantDataInterface | undefined,
	props: StageProps = {}
) => (
	<TenantContext.Provider value={{ tenant, setTenant: vi.fn() }}>
		<LegalLinksContext.Provider value={[]}>
			<Stage {...props} />
		</LegalLinksContext.Provider>
	</TenantContext.Provider>
);

const renderStage = (tenant: TenantDataInterface | undefined) =>
	render(stageView(tenant));

/**
 * The stage centre carries the animated composition (lamp map) and nothing
 * else. The tenant/association mark used to render between the claim and the
 * carrier logos; the owner removed it from the design ("nehme bitte das Logo
 * raus, dort in der Mitte", 2026-08-19) — it doubled the branding already on
 * the header/registration surfaces and covered the composition's area.
 * The carrier marks at the panel's foot are a separate element and stay.
 */
describe('Stage centre branding', () => {
	afterEach(cleanup);

	it('renders no tenant mark even when the tenant configured one', () => {
		const { container } = renderStage(
			tenantWith({
				associationLogo: 'https://cdn.test.local/assoc.svg',
				logo: 'https://cdn.test.local/tenant.svg'
			})
		);

		expect(container.querySelector('.stage__tenantLogo')).toBeNull();
		expect(container.querySelector('img')).toBeNull();
	});

	it('keeps the carrier marks at the foot of the panel', () => {
		const { container } = renderStage(tenantWith({}));

		expect(
			container.querySelector('[data-cy="stage-carrier-logos"]')
		).toBeTruthy();
	});

	it('keeps the loading decoration until the stage is ready, then removes it', () => {
		vi.useFakeTimers();
		const canvas = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockReturnValue(null);
		try {
			const { rerender } = render(
				stageView(undefined, { hasAnimation: true, isReady: false })
			);
			expect(screen.getByText('app.wait')).toBeTruthy();
			act(() => vi.advanceTimersByTime(10000));
			expect(screen.getByText('app.wait')).toBeTruthy();
			rerender(
				stageView(undefined, { hasAnimation: true, isReady: true })
			);
			expect(screen.queryByText('app.wait')).toBeNull();
		} finally {
			canvas.mockRestore();
			vi.useRealTimers();
		}
	});
});
