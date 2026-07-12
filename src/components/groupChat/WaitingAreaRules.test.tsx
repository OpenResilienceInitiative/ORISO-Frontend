// @vitest-environment jsdom
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitingAreaRules } from './WaitingAreaRules';

const ACTIVE = 'joinChat__rule--active';

describe('WaitingAreaRules', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('renders nothing when there are no rules', () => {
		const { container } = render(<WaitingAreaRules rules={[]} />);
		expect(container.querySelector('.joinChat__rules')).toBeNull();
	});

	it('renders every rule so assistive tech always has the full list', () => {
		const rules = ['Be kind', 'Stay on topic', 'No ads'];
		const { container } = render(<WaitingAreaRules rules={rules} />);
		const items = container.querySelectorAll('.joinChat__rule');
		expect(items).toHaveLength(3);
		expect(Array.from(items, (el) => el.textContent)).toEqual(rules);
	});

	it('marks exactly the first rule active initially', () => {
		const { container } = render(
			<WaitingAreaRules rules={['a', 'b', 'c']} />
		);
		const active = container.querySelectorAll(`.${ACTIVE}`);
		expect(active).toHaveLength(1);
		expect(active[0].textContent).toBe('a');
	});

	it('advances the active rule after ~4 seconds', () => {
		const { container } = render(
			<WaitingAreaRules rules={['a', 'b', 'c']} />
		);
		act(() => {
			vi.advanceTimersByTime(4000);
		});
		const active = container.querySelector(`.${ACTIVE}`);
		expect(active?.textContent).toBe('b');
	});

	it('does not cycle a single rule (it stays active)', () => {
		const { container } = render(<WaitingAreaRules rules={['only']} />);
		act(() => {
			vi.advanceTimersByTime(20000);
		});
		const active = container.querySelectorAll(`.${ACTIVE}`);
		expect(active).toHaveLength(1);
		expect(active[0].textContent).toBe('only');
	});

	it('exposes the list with the provided aria-label', () => {
		const { container } = render(
			<WaitingAreaRules rules={['a']} ariaLabel="Chat rules" />
		);
		expect(
			container.querySelector('.joinChat__rules')?.getAttribute('aria-label')
		).toBe('Chat rules');
	});

	it('does not cycle when the user prefers reduced motion', () => {
		const mql = {
			matches: true,
			media: '(prefers-reduced-motion: reduce)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		};
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue(mql as unknown as MediaQueryList)
		);
		const { container } = render(
			<WaitingAreaRules rules={['a', 'b', 'c']} />
		);
		act(() => {
			vi.advanceTimersByTime(8000);
		});
		const active = container.querySelector(`.${ACTIVE}`);
		expect(active?.textContent).toBe('a');
		vi.unstubAllGlobals();
	});
});
