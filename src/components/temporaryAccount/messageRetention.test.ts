import { describe, expect, it } from 'vitest';
import { effectiveRetention, mustAskGuest } from './messageRetention';

describe('messageRetention (#1869)', () => {
	it('follows the platform when it does not let the guest decide', () => {
		expect(effectiveRetention('ALWAYS_TEMPORARY', 'keep')).toBe('delete');
		expect(effectiveRetention('ALWAYS_PERSISTENT', 'delete')).toBe('keep');
		expect(mustAskGuest('ALWAYS_TEMPORARY')).toBe(false);
		expect(mustAskGuest('ALWAYS_PERSISTENT')).toBe(false);
	});

	it('asks the guest once and then uses the answer', () => {
		expect(mustAskGuest('GUEST_DECIDES')).toBe(true);
		expect(effectiveRetention('GUEST_DECIDES')).toBeUndefined();
		expect(mustAskGuest('GUEST_DECIDES', 'delete')).toBe(false);
		expect(effectiveRetention('GUEST_DECIDES', 'delete')).toBe('delete');
	});
});
