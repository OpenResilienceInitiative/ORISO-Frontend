import { describe, expect, it } from 'vitest';
import { hasChanged } from './hasChanged';

/**
 * `hasChanged` decides whether the blocking "our privacy policy was updated"
 * overlay appears. It used to treat a missing user confirmation as "updated",
 * which is what put that overlay in front of every anonymous help-seeker in the
 * waiting room and blocked the live chat (ORISO-Frontend#1087).
 */

const tenant = (date: string | null) =>
	({ content: { dataPrivacyConfirmation: date } }) as never;
const user = (date: string | null) =>
	({ dataPrivacyConfirmation: date }) as never;

const check = (t: unknown, u: unknown) =>
	hasChanged(t as never, u as never, 'dataPrivacyConfirmation');

describe('hasChanged', () => {
	it('does not report an update to someone who never agreed', () => {
		// The waiting room: no Beratungsstelle assigned, so nothing of theirs
		// can have been updated. This is the defect.
		expect(check(tenant('2026-08-01T00:00:00Z'), user(null))).toBe(false);
	});

	it('reports an update when the user agreed before the tenant published', () => {
		expect(
			check(tenant('2026-08-01T00:00:00Z'), user('2026-07-01T00:00:00Z'))
		).toBe(true);
	});

	it('reports no update when the user agreed after the tenant published', () => {
		expect(
			check(tenant('2026-07-01T00:00:00Z'), user('2026-08-01T00:00:00Z'))
		).toBe(false);
	});

	it('reports no update when the tenant has published nothing', () => {
		expect(check(tenant(null), user('2026-07-01T00:00:00Z'))).toBe(false);
		expect(check({}, user('2026-07-01T00:00:00Z'))).toBe(false);
		expect(check(undefined, user('2026-07-01T00:00:00Z'))).toBe(false);
	});

	it('survives an absent user object without throwing', () => {
		expect(check(tenant('2026-08-01T00:00:00Z'), undefined)).toBe(false);
	});
});
