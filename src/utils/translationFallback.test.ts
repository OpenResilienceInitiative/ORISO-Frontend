import { describe, expect, it, vi } from 'vitest';
import { translateWithFallback } from './translationFallback';

describe('translateWithFallback', () => {
	it('uses a resolved translation', () => {
		expect(
			translateWithFallback(
				vi.fn(() => 'Übersetzt'),
				'key',
				'Fallback'
			)
		).toBe('Übersetzt');
	});

	it.each(['', 'key'])(
		'uses the fallback for an unresolved value',
		(value) => {
			expect(
				translateWithFallback(
					vi.fn(() => value),
					'key',
					'Fallback'
				)
			).toBe('Fallback');
		}
	);
});
