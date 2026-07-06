import { describe, expect, it } from 'vitest';
import { getMenuDirection } from './menuDirection';

describe('getMenuDirection', () => {
	it('opens bottom-to-top when the composer is minimized (default docked state)', () => {
		expect(getMenuDirection({ isExpanded: false, isMobile: false })).toBe(
			'up'
		);
	});

	it('opens bottom-to-top on mobile, even in fullscreen', () => {
		expect(getMenuDirection({ isExpanded: false, isMobile: true })).toBe(
			'up'
		);
		expect(getMenuDirection({ isExpanded: true, isMobile: true })).toBe(
			'up'
		);
	});

	it('opens top-down in desktop fullscreen mode', () => {
		expect(getMenuDirection({ isExpanded: true, isMobile: false })).toBe(
			'down'
		);
	});
});
