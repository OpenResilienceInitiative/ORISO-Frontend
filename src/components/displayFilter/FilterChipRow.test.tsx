// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { chipTargets, FilterChipRow } from './FilterChipRow';
import { FilterChip } from './FilterChip';

const Icon = (props: React.SVGProps<SVGSVGElement>) => (
	<svg data-testid="chip-icon" {...props} />
);

describe('FilterChipRow / FilterChip (#1377)', () => {
	afterEach(cleanup);

	it('renders a labelled group with pressed state, badge and trailing slot', () => {
		const onClick = vi.fn();
		render(
			<FilterChipRow
				label="Filter"
				trailing={<button type="button">trailing</button>}
			>
				<FilterChip
					label="Nachrichten"
					icon={Icon}
					count={5}
					active
					onClick={onClick}
				/>
				<FilterChip label="Anrufe" icon={Icon} count={0} />
			</FilterChipRow>
		);
		expect(screen.getByRole('group', { name: 'Filter' })).toBeTruthy();
		const active = screen.getByRole('button', { name: 'Nachrichten (5)' });
		expect(active.getAttribute('aria-pressed')).toBe('true');
		expect(active.className).toContain('sessionsListToolbar__chip--active');
		expect(active.textContent).toContain('5');
		const rest = screen.getByRole('button', { name: 'Anrufe' });
		expect(rest.className).toContain('sessionsListToolbar__chip--iconOnly');
		expect(
			rest.querySelector('.sessionsListToolbar__chipBadge')
		).toBeNull();
		fireEvent.click(active);
		expect(onClick).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: 'trailing' })).toBeTruthy();
	});

	it('caps the badge at 99+', () => {
		render(<FilterChip label="System" icon={Icon} count={250} />);
		expect(
			screen.getByRole('button', { name: 'System (99+)' }).textContent
		).toContain('99+');
	});

	it('scrolls a chip that becomes active into view (Frank 2026-09-21)', async () => {
		const row = (active: boolean) => (
			<FilterChipRow label="Filter" scrollDataCy="chips">
				<FilterChip label="Alle" icon={Icon} count={0} />
				<FilterChip
					label="Supervision"
					icon={Icon}
					count={0}
					active={active}
				/>
			</FilterChipRow>
		);
		const { rerender, container } = render(row(false));
		const scroller =
			container.querySelector<HTMLElement>('[data-cy="chips"]')!;
		Object.defineProperty(scroller, 'clientWidth', { value: 520 });
		scroller.getBoundingClientRect = () =>
			({ left: 0, width: 520 }) as DOMRect;
		screen.getByRole('button', {
			name: 'Supervision'
		}).getBoundingClientRect = () => ({ left: 460, width: 140 }) as DOMRect;

		rerender(row(true));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(scroller.scrollLeft).toBe(600 + 12 - 520);
	});

	const twoChipRow = (family: boolean, unread: boolean) => (
		<FilterChipRow label="Filter" scrollDataCy="chips">
			<FilterChip
				label="Nachrichten"
				icon={Icon}
				count={0}
				active={family}
			/>
			<FilterChip
				label="Ungelesen"
				icon={Icon}
				count={0}
				active={unread}
			/>
		</FilterChipRow>
	);

	const stubGeometry = (container: HTMLElement, width: { value: number }) => {
		const scroller =
			container.querySelector<HTMLElement>('[data-cy="chips"]')!;
		Object.defineProperty(scroller, 'clientWidth', {
			get: () => width.value
		});
		scroller.getBoundingClientRect = () =>
			({ left: 0, width: width.value }) as DOMRect;
		screen.getByRole('button', {
			name: 'Nachrichten'
		}).getBoundingClientRect = () => ({ left: 20, width: 100 }) as DOMRect;
		screen.getByRole('button', {
			name: 'Ungelesen'
		}).getBoundingClientRect = () => ({ left: 460, width: 140 }) as DOMRect;
		return scroller;
	};

	it('reveals a second chip that becomes active while another stays active', async () => {
		const { rerender, container } = render(twoChipRow(true, false));
		const scroller = stubGeometry(container, { value: 520 });

		rerender(twoChipRow(true, true));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(scroller.scrollLeft).toBe(600 + 12 - 520);
	});

	it('reveals a chip chosen while the row was hidden once it is shown again', async () => {
		let onResize: (() => void) | undefined;
		const original = globalThis.ResizeObserver;
		globalThis.ResizeObserver = class {
			constructor(callback: () => void) {
				onResize = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
		try {
			const width = { value: 0 };
			const { rerender, container } = render(twoChipRow(false, false));
			const scroller = stubGeometry(container, width);

			rerender(twoChipRow(false, true));
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(scroller.scrollLeft).toBe(0);

			width.value = 520;
			onResize?.();

			expect(scroller.scrollLeft).toBe(600 + 12 - 520);
		} finally {
			globalThis.ResizeObserver = original;
		}
	});

	it('keeps the active chip in view when the row gets narrower', async () => {
		let onResize: (() => void) | undefined;
		const original = globalThis.ResizeObserver;
		globalThis.ResizeObserver = class {
			constructor(callback: () => void) {
				onResize = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
		try {
			const width = { value: 700 };
			const { rerender, container } = render(twoChipRow(false, false));
			const scroller = stubGeometry(container, width);
			// Browsers fire the observer once on observe() with the real size.
			onResize?.();

			rerender(twoChipRow(false, true));
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(scroller.scrollLeft).toBe(0);

			width.value = 520;
			onResize?.();

			expect(scroller.scrollLeft).toBe(600 + 12 - 520);
		} finally {
			globalThis.ResizeObserver = original;
		}
	});
});

/**
 * A 300px chip row scrolled to 0, 10px from the viewport edge, whose chips
 * span 0-90, 100-240, 250-470 and 480-580 px of its 600px content. jsdom does
 * no layout, so geometry is stubbed.
 */
const stubRow = (scroller: HTMLElement) => {
	Object.defineProperty(scroller, 'scrollWidth', { value: 600 });
	Object.defineProperty(scroller, 'clientWidth', { value: 300 });
	scroller.getBoundingClientRect = () => ({ left: 10 }) as DOMRect;
	const chips = Array.from(scroller.firstElementChild?.children ?? []);
	[
		[0, 90],
		[100, 240],
		[250, 470],
		[480, 580]
	].forEach(([left, right], index) => {
		if (chips[index])
			chips[index].getBoundingClientRect = () =>
				({ left: 10 + left, right: 10 + right }) as DOMRect;
	});
};

describe('FilterChipRow arrows (#2390)', () => {
	afterEach(cleanup);

	const chips = ['Unread', 'Drafts', 'Mail', 'Archived'].map((label) => (
		<FilterChip key={label} label={label} icon={Icon} count={0} />
	));

	it('targets every chip, clamped to what the row can scroll', () => {
		render(
			<FilterChipRow label="Filter" scrollDataCy="chips">
				{chips}
			</FilterChipRow>
		);
		const scroller = document.querySelector(
			'[data-cy=chips]'
		) as HTMLElement;
		stubRow(scroller);
		expect(chipTargets(scroller)).toEqual([0, 100, 250, 300]);
	});

	it('offers a next arrow on an overflowing row and starts the next page at the cut-off chip', () => {
		render(
			<FilterChipRow label="Filter" scrollDataCy="chips">
				{chips}
			</FilterChipRow>
		);
		const scroller = document.querySelector(
			'[data-cy=chips]'
		) as HTMLElement;
		stubRow(scroller);
		scroller.scrollTo = vi.fn();
		fireEvent.scroll(scroller);
		expect(
			document.querySelector('[data-cy=filter-chip-row-arrows-previous]')
		).toBeNull();
		const next = document.querySelector(
			'[data-cy=filter-chip-row-arrows-next]'
		) as HTMLElement;
		expect(next).toBeTruthy();
		fireEvent.click(next);
		// The third chip (250-470) is the first one cut off on the right.
		expect(scroller.scrollTo).toHaveBeenCalledWith({ left: 250 });
	});
});
