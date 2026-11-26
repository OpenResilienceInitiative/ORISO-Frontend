// @vitest-environment oriso-jsdom
/**
 * The breathing wave is drawn from the scene's measured size. Before the first
 * layout (or while the companion sits in a hidden container) that size can be
 * 0, which turned the time scale into a division by zero and the wave's
 * look-ahead into an endless loop: the whole tab froze. These tests start
 * the exercise with a zero-sized scene and only need it to finish.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import BreathingCompanion from './BreathingCompanion';

beforeEach(() => {
	// Only the drawing is under test: keep the frame loop idle.
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('BreathingCompanion with a zero-sized scene (never freezes)', () => {
	it.each([
		['with motion', false],
		['with reduced motion', true]
	])(
		'starts the exercise %s while the scene measures 0 × 0',
		(_, reducedMotion) => {
			render(
				<BreathingCompanion
					onClose={() => {}}
					reducedMotion={reducedMotion}
				/>
			);
			fireEvent.click(screen.getByRole('button', { name: /Beginnen/ }));
			expect(
				screen.queryByRole('button', { name: /Beginnen/ })
			).toBeNull();
		}
	);
});
