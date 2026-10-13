import { describe, expect, it } from 'vitest';
import { counsellorInitials } from './counsellorAvatar';

describe('counsellorInitials', () => {
	it('prefers the public display name', () => {
		expect(
			counsellorInitials({
				displayName: 'Lena B.',
				firstName: 'Marie',
				lastName: 'Muster'
			})
		).toBe('LB');
	});

	it('falls back to first and last name, then the username', () => {
		expect(
			counsellorInitials({ firstName: 'Marie', lastName: 'Muster' })
		).toBe('MM');
		expect(counsellorInitials({ username: 'beraterin' })).toBe('B');
	});

	it('takes at most two letters and returns empty when nothing is known', () => {
		expect(counsellorInitials({ displayName: 'Anna Maria Lena' })).toBe(
			'AM'
		);
		expect(counsellorInitials({ displayName: '   ' })).toBe('');
	});
});
