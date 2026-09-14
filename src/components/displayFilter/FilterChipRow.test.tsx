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
		const active = screen.getByRole('button', { name: 'Nachrichten' });
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
			screen.getByRole('button', { name: 'System' }).textContent
		).toContain('99+');
	});
});
