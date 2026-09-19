import { describe, expect, it } from 'vitest';
import { requiresSecondFactorSetup } from './mandatorySecondFactor';

const userData = (twoFactorAuth?: Record<string, unknown>) =>
	({ twoFactorAuth }) as any;

describe('requiresSecondFactorSetup', () => {
	it('blocks a provisioned counsellor who has no factor yet', () => {
		expect(
			requiresSecondFactorSetup(
				userData({ isEnabled: true, isRequired: true, isActive: false })
			)
		).toBe(true);
	});

	it('lets a provisioned counsellor through once the factor is active', () => {
		expect(
			requiresSecondFactorSetup(
				userData({ isEnabled: true, isRequired: true, isActive: true })
			)
		).toBe(false);
	});

	it('leaves accounts without the requirement alone', () => {
		expect(
			requiresSecondFactorSetup(
				userData({
					isEnabled: true,
					isRequired: false,
					isActive: false
				})
			)
		).toBe(false);
	});

	// The flag is absent on any backend released before it. Blocking then would
	// lock out every counsellor at once over an unknown that means "no
	// requirement" everywhere else.
	it('does not block when the backend does not send the flag', () => {
		expect(
			requiresSecondFactorSetup(
				userData({ isEnabled: true, isActive: false })
			)
		).toBe(false);
	});

	it('does not block when there is no two-factor data at all', () => {
		expect(requiresSecondFactorSetup(userData(undefined))).toBe(false);
		expect(requiresSecondFactorSetup(undefined)).toBe(false);
	});

	// Fail closed on the other half: once the requirement is known, only a
	// confirmed active factor opens the gate.
	it('blocks when the requirement is known but the factor state is not', () => {
		expect(
			requiresSecondFactorSetup(
				userData({ isEnabled: true, isRequired: true })
			)
		).toBe(true);
	});

	it('is not satisfied by a truthy non-boolean active value', () => {
		expect(
			requiresSecondFactorSetup(
				userData({ isRequired: true, isActive: 'yes' })
			)
		).toBe(true);
	});
});
