// @vitest-environment jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyStateAnimation } from './EmptyStateAnimation';

vi.mock('lottie-react', () => ({
	default: () => <div data-lottie="true" />
}));

const stubReducedMotion = (matches: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue({
			matches,
			media: '(prefers-reduced-motion: reduce)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn()
		} as unknown as MediaQueryList)
	);

describe('EmptyStateAnimation over the shared player', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps the class and E2E selectors its styles and specs rely on', () => {
		stubReducedMotion(false);
		const { container } = render(
			<EmptyStateAnimation animationData={{}} variant="archive" />
		);
		const host = container.querySelector('.emptyState__animation');

		expect(host).toBeTruthy();
		expect(host?.getAttribute('data-cy')).toBe('empty-state-animation');
		expect(host?.getAttribute('data-empty-state')).toBe('archive');
	});

	it('runs at the shared speed and never loops', () => {
		stubReducedMotion(false);
		const { container } = render(
			<EmptyStateAnimation animationData={{}} variant="inquiry" />
		);
		const host = container.querySelector('.emptyState__animation');

		expect(host?.getAttribute('data-speed')).toBe('0.5');
		expect(host?.getAttribute('data-loop')).toBe('false');
	});

	it('holds its box under reduced motion, even without a static twin', () => {
		// The empty-state animations have no fallback illustration yet; the host
		// still has to occupy its space so the layout does not collapse.
		stubReducedMotion(true);
		const { container } = render(
			<EmptyStateAnimation animationData={{}} variant="archive" />
		);

		expect(container.querySelector('.emptyState__animation')).toBeTruthy();
		expect(container.querySelector('[data-lottie="true"]')).toBeNull();
	});
});
