// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterChipRow } from './FilterChipRow';
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
});
