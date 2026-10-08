// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AUTHORITIES } from '../globalState/helpers/stateHelpers';
import { canUsePractice } from './practiceAccess';

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const consultant = { grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT] };
const asker = { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] };
const on = {
	enableWalkthrough: true,
	releaseToggles: { enablePracticeArea: true }
};

describe('canUsePractice', () => {
	it('lets a counsellor in when the master switch and the release flag are on', () => {
		expect(canUsePractice(on as never, consultant as never)).toBe(true);
	});

	it('does not look at the personal tutorial switch', () => {
		expect(
			canUsePractice(
				on as never,
				{
					...consultant,
					isWalkThroughEnabled: false
				} as never
			)
		).toBe(true);
	});

	it('is locked by the platform master switch', () => {
		expect(
			canUsePractice(
				{ ...on, enableWalkthrough: false } as never,
				consultant as never
			)
		).toBe(false);
	});

	it.each([
		['unset', {}],
		['off', { enablePracticeArea: false }]
	])('stays closed while the release flag is %s', (_name, releaseToggles) => {
		expect(
			canUsePractice(
				{ enableWalkthrough: true, releaseToggles } as never,
				consultant as never
			)
		).toBe(false);
	});

	it('is for counsellors only', () => {
		expect(canUsePractice(on as never, asker as never)).toBe(false);
		expect(canUsePractice(on as never, null as never)).toBe(false);
	});
});
