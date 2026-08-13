// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonGroup } from './ButtonGroup';

/**
 * jsdom has no layout engine, so every box measures 0. The auto-stacking
 * decision is pure geometry, so the tests below install a width oracle keyed
 * on the element's role in the group: the visible track is "what fits", the
 * hidden twin is "what the row needs".
 */
const withWidths = ({
	available,
	required
}: {
	available: number;
	required: number;
}) => {
	const original = Element.prototype.getBoundingClientRect;
	Element.prototype.getBoundingClientRect = function () {
		const width = this.classList.contains('buttonGroup__track--mirror')
			? required
			: this.classList.contains('buttonGroup')
				? available
				: 0;
		return {
			width,
			height: 0,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			toJSON: () => ({})
		} as DOMRect;
	};
	return () => {
		Element.prototype.getBoundingClientRect = original;
	};
};

const items = [
	{ id: 'approve', label: 'Zugriff freigeben', onClick: vi.fn() },
	{ id: 'decline', label: 'Zugriff verweigern', onClick: vi.fn() }
];

let restoreWidths: (() => void) | undefined;

beforeEach(() => {
	// A no-op observer is enough: the component measures once on layout too,
	// and the tests never resize.
	(globalThis as any).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

afterEach(() => {
	restoreWidths?.();
	restoreWidths = undefined;
	cleanup();
	vi.clearAllMocks();
});

describe('ButtonGroup', () => {
	it('exposes the items as a labelled group of real buttons', () => {
		render(<ButtonGroup items={items} ariaLabel="Consent options" />);

		const group = screen.getByRole('group', { name: 'Consent options' });
		expect(screen.getAllByRole('button', { name: /Zugriff/ })).toHaveLength(
			2
		);
		expect(group).toBeTruthy();
	});

	it('numbers the items with a decorative badge that stays out of the name', () => {
		render(<ButtonGroup items={items} numbered />);

		// The badge must not leak into the accessible name — screen-reader
		// users would hear "1 Zugriff freigeben".
		expect(
			screen.getByRole('button', { name: 'Zugriff freigeben' })
		).toBeTruthy();
		expect(document.querySelectorAll('.buttonGroup__badge').length).toBe(4);
	});

	it('sets the NATIVE disabled attribute, not only a class', () => {
		render(
			<ButtonGroup items={[{ ...items[0], disabled: true }, items[1]]} />
		);

		const disabled = screen.getByRole('button', {
			name: 'Zugriff freigeben'
		}) as HTMLButtonElement;
		expect(disabled.disabled).toBe(true);
		expect(disabled.hasAttribute('disabled')).toBe(true);

		fireEvent.click(disabled);
		expect(items[0].onClick).not.toHaveBeenCalled();
	});

	it('fires the item handler on click', () => {
		render(<ButtonGroup items={items} />);
		fireEvent.click(
			screen.getByRole('button', { name: 'Zugriff verweigern' })
		);
		expect(items[1].onClick).toHaveBeenCalledTimes(1);
	});

	it('stays on one line while the row fits', () => {
		restoreWidths = withWidths({ available: 560, required: 440 });
		render(<ButtonGroup items={items} alignment="horizontal-flex" />);

		const group = screen.getByRole('group');
		expect(group.dataset.alignment).toBe('horizontal-flex');
		expect(group.dataset.autoStacked).toBeUndefined();
	});

	it('falls back to stacked once the row no longer fits', () => {
		restoreWidths = withWidths({ available: 320, required: 440 });
		render(<ButtonGroup items={items} alignment="horizontal-flex" />);

		const group = screen.getByRole('group');
		expect(group.dataset.alignment).toBe('stacked');
		expect(group.dataset.autoStacked).toBe('true');
		expect(group.className).toContain('buttonGroup--stacked');
	});

	it('does not stack on a row that fits exactly', () => {
		// Integer clientWidth/scrollWidth rounding used to flip this case, and
		// a bubble that hugs the group hits it every single time.
		restoreWidths = withWidths({ available: 445, required: 445 });
		render(<ButtonGroup items={items} alignment="horizontal-flex" />);

		expect(screen.getByRole('group').dataset.alignment).toBe(
			'horizontal-flex'
		);
	});

	it('never overrides an explicitly chosen alignment', () => {
		restoreWidths = withWidths({ available: 100, required: 440 });
		render(<ButtonGroup items={items} alignment="horizontal-scroll" />);

		const group = screen.getByRole('group');
		expect(group.dataset.alignment).toBe('horizontal-scroll');
		// …and it renders no measuring twin it would never consult.
		expect(
			document.querySelector('.buttonGroup__track--mirror')
		).toBeNull();
	});

	it('re-measures when the observed box changes', () => {
		let trigger: (() => void) | undefined;
		(globalThis as any).ResizeObserver = class {
			constructor(cb: () => void) {
				trigger = cb;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		};
		restoreWidths = withWidths({ available: 560, required: 440 });
		render(<ButtonGroup items={items} alignment="horizontal-flex" />);
		expect(screen.getByRole('group').dataset.alignment).toBe(
			'horizontal-flex'
		);

		restoreWidths();
		restoreWidths = withWidths({ available: 300, required: 440 });
		act(() => trigger?.());

		expect(screen.getByRole('group').dataset.alignment).toBe('stacked');
	});
});
