import { describe, expect, it } from 'vitest';
import { resolveTenantStageEffect } from './tenantStageEffect';
import { TenantDataInterface } from '../../../globalState/interfaces';

const tenantWith = (loginEffect: unknown) =>
	({ theming: { loginEffect } }) as unknown as TenantDataInterface;

describe('resolveTenantStageEffect', () => {
	it('maps every contract value to a loadable effect', () => {
		expect(resolveTenantStageEffect(tenantWith('NONE'))).toBe('none');
		expect(resolveTenantStageEffect(tenantWith('LINES'))).toBe('lines');
		expect(resolveTenantStageEffect(tenantWith('CONNECTED_DOTS'))).toBe(
			'connectedDots'
		);
		expect(resolveTenantStageEffect(tenantWith('CRACKS'))).toBe('cracks');
	});

	it('falls back to none for a tenant that never configured one', () => {
		expect(resolveTenantStageEffect(tenantWith(null))).toBe('none');
		expect(resolveTenantStageEffect(tenantWith(undefined))).toBe('none');
	});

	it('falls back to none when the backend does not send theming at all', () => {
		// Older TenantService, or a request that failed: the login screen must
		// still render, it simply gets no decoration.
		expect(resolveTenantStageEffect(undefined)).toBe('none');
		expect(resolveTenantStageEffect(null)).toBe('none');
		expect(resolveTenantStageEffect({} as TenantDataInterface)).toBe('none');
	});

	it('falls back to none for a value this frontend does not know', () => {
		// A newer Admin could offer an effect this build has no chunk for.
		expect(resolveTenantStageEffect(tenantWith('KALEIDOSCOPE'))).toBe('none');
	});
});
