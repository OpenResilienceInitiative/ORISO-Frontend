// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	render,
	renderHook,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { SlideOutPresence } from './SlideOutPresence';
import { StepTransition } from './StepTransition';
import { transitionMotion } from './transitionMotion';
import { useReducedMotion } from './useReducedMotion';

const preferReducedMotion = (reduce: boolean) => {
	window.matchMedia = ((query: string) => ({
		matches: reduce && query.includes('prefers-reduced-motion'),
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
		onchange: null
	})) as typeof window.matchMedia;
};

const step = (viewKey: string, order: number) => (
	<StepTransition viewKey={viewKey} order={order}>
		<p>{viewKey}</p>
	</StepTransition>
);

/**
 * ORISO-Frontend#1736. Registration steps and the login button move through
 * one layer instead of each place doing its own motion (Frank, 2026-10-15:
 * "smooth experience", the middle part slides in, the login button slides out).
 */
describe('StepTransition', () => {
	beforeEach(() => preferReducedMotion(false));
	afterEach(cleanup);

	const direction = () =>
		document
			.querySelector('[data-cy="step-transition"]')
			?.getAttribute('data-slide-from');

	it('slides the next step in from the right and a returning step from the left', () => {
		const { rerender } = render(step('topic-selection', 0));
		rerender(step('zipcode', 1));
		expect(direction()).toBe('right');

		rerender(step('topic-selection', 0));
		expect(direction()).toBe('left');
	});

	it('measures the next move from where the step stands now when steps are inserted before it', () => {
		const { rerender } = render(step('topic-selection', 0));
		rerender(step('account-data', 1));
		// A step appears in front of "account-data": same step, later position.
		rerender(step('account-data', 2));
		expect(direction(), 'the step itself does not replay').toBe('right');

		// The step that now sits at position 1 is *before* it, so it comes
		// back in from the left — not from the right it would take if the old
		// position (1) were still remembered.
		rerender(step('zipcode', 1));
		expect(direction()).toBe('left');
	});

	it('swaps the step, so the one that left is gone and the new one is there', () => {
		const { rerender } = render(step('topic-selection', 0));
		rerender(step('zipcode', 1));

		expect(screen.queryByText('topic-selection')).toBeNull();
		expect(screen.getByText('zipcode')).toBeDefined();
	});

	it('keeps the same step in place when it renders again', () => {
		const { rerender } = render(step('zipcode', 1));
		const node = document.querySelector('[data-cy="step-transition"]');

		rerender(step('zipcode', 1));

		expect(document.querySelector('[data-cy="step-transition"]')).toBe(
			node
		);
	});

	it('does not animate the step a person lands on, only the ones after it', () => {
		const css = () =>
			[...document.querySelectorAll('style')]
				.map((node) => node.textContent ?? '')
				.join('');
		const { rerender } = render(step('topic-selection', 0));
		const first = document.querySelector('[data-cy="step-transition"]')!;
		const className = [...first.classList].find((name) =>
			name.startsWith('css-')
		)!;
		expect(css()).not.toMatch(
			new RegExp(`\\.${className}\\{[^}]*animation:slideIn`)
		);

		rerender(step('zipcode', 1));
		const next = document.querySelector('[data-cy="step-transition"]')!;
		const nextClass = [...next.classList].find((name) =>
			name.startsWith('css-')
		)!;
		expect(css()).toMatch(
			new RegExp(`\\.${nextClass}\\{[^}]*animation:slideInFromRight`)
		);
	});
});

describe('SlideOutPresence', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		preferReducedMotion(false);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	const link = (present: boolean) => (
		<SlideOutPresence present={present}>
			<a href="/login">Einloggen</a>
		</SlideOutPresence>
	);

	it('stays while it slides out and is gone once the exit has played', () => {
		const { rerender } = render(link(true));
		rerender(link(false));

		expect(screen.getByText('Einloggen')).toBeDefined();
		expect(
			screen.getByText('Einloggen').parentElement?.dataset.presence
		).toBe('leaving');

		act(() => {
			vi.advanceTimersByTime(transitionMotion.exitMs + 1);
		});
		expect(screen.queryByText('Einloggen')).toBeNull();
	});

	it('cannot be reached by keyboard or assistive tech while it slides out', () => {
		const { rerender } = render(link(true));
		const wrapper = () =>
			screen.getByText('Einloggen').parentElement as HTMLElement;
		expect(wrapper().hasAttribute('inert')).toBe(false);

		rerender(link(false));
		expect(wrapper().hasAttribute('inert')).toBe(true);

		rerender(link(true));
		expect(wrapper().hasAttribute('inert')).toBe(false);
	});

	it('is back and clickable when it applies again before the exit ends', () => {
		const { rerender } = render(link(true));
		rerender(link(false));
		act(() => {
			vi.advanceTimersByTime(transitionMotion.exitMs / 2);
		});
		rerender(link(true));
		act(() => {
			vi.advanceTimersByTime(transitionMotion.exitMs);
		});

		expect(
			screen.getByText('Einloggen').parentElement?.dataset.presence
		).toBe('present');
	});

	it('leaves at once for a person who asked for less motion', () => {
		preferReducedMotion(true);
		const { rerender } = render(link(true));
		rerender(link(false));
		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(screen.queryByText('Einloggen')).toBeNull();
	});
});

describe('useReducedMotion', () => {
	afterEach(cleanup);

	it('already knows about the preference on the very first render', () => {
		preferReducedMotion(true);
		const seen: boolean[] = [];
		renderHook(() => {
			const reduced = useReducedMotion();
			seen.push(reduced);
			return reduced;
		});

		expect(
			seen[0],
			'the first render is not a guess of "no preference"'
		).toBe(true);
	});
});
