import { describe, expect, it } from 'vitest';
import { TenantDataInterface } from '../../../globalState/interfaces';
import {
	DEFAULT_CLOSING_VARIANT,
	resolveTenantClosingAnimation
} from './closingVariants';

const tenantWith = (desktop: unknown, mobile: unknown) =>
	({
		theming: {
			closingAnimationDesktop: desktop,
			closingAnimationMobile: mobile
		}
	}) as unknown as TenantDataInterface;

/**
 * ORISO-Frontend#1737. The Admin panel stores one choice for desktop and one
 * for mobile; the frontend reads the one that belongs to the screen it is on.
 */
describe('resolveTenantClosingAnimation', () => {
	it('maps every contract value to its design', () => {
		const names = {
			CURTAIN: 'curtain',
			SLIDE_REVEAL: 'slideReveal'
		} as const;
		for (const [value, design] of Object.entries(names)) {
			expect(
				resolveTenantClosingAnimation(tenantWith(value, null), true)
			).toBe(design);
			expect(
				resolveTenantClosingAnimation(tenantWith(null, value), false)
			).toBe(design);
		}
	});

	it('reads the desktop choice on desktop and the mobile choice on mobile', () => {
		const tenant = tenantWith('SLIDE_REVEAL', 'CURTAIN');
		expect(resolveTenantClosingAnimation(tenant, true)).toBe('slideReveal');
		expect(resolveTenantClosingAnimation(tenant, false)).toBe('curtain');
	});

	it('gives a tenant that chose the circle zoom, taken out before release, the default', () => {
		const tenant = tenantWith('CIRCLE_ZOOM', 'CIRCLE_ZOOM');
		expect(resolveTenantClosingAnimation(tenant, true)).toBe(
			DEFAULT_CLOSING_VARIANT
		);
		expect(resolveTenantClosingAnimation(tenant, false)).toBe(
			DEFAULT_CLOSING_VARIANT
		);
	});

	it('falls back to the platform default for a tenant that never chose', () => {
		expect(
			resolveTenantClosingAnimation(tenantWith(null, null), true)
		).toBe(DEFAULT_CLOSING_VARIANT);
		expect(
			resolveTenantClosingAnimation(
				tenantWith(undefined, undefined),
				false
			)
		).toBe(DEFAULT_CLOSING_VARIANT);
	});

	it('falls back when only the other width was chosen', () => {
		expect(
			resolveTenantClosingAnimation(
				tenantWith('SLIDE_REVEAL', null),
				false
			)
		).toBe(DEFAULT_CLOSING_VARIANT);
	});

	it('falls back when the backend does not send theming at all', () => {
		// Older TenantService, or a request that failed: the person must still arrive.
		expect(resolveTenantClosingAnimation(undefined, true)).toBe(
			DEFAULT_CLOSING_VARIANT
		);
		expect(resolveTenantClosingAnimation(null, false)).toBe(
			DEFAULT_CLOSING_VARIANT
		);
		expect(
			resolveTenantClosingAnimation({} as TenantDataInterface, true)
		).toBe(DEFAULT_CLOSING_VARIANT);
	});

	it('falls back for a value this frontend does not know', () => {
		// A newer Admin could offer a design this build has no code for.
		expect(
			resolveTenantClosingAnimation(
				tenantWith('CONFETTI', 'CONFETTI'),
				true
			)
		).toBe(DEFAULT_CLOSING_VARIANT);
	});
});
