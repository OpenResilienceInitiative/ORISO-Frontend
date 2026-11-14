// @vitest-environment oriso-jsdom
/**
 * The story harness seeds its local entries once per scenario: changing the
 * `role` or `empty` control must start over, not keep the old entries.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarPageProps } from './CalendarPage';
import meta from './CalendarPage.stories';
import { ME } from './calendarStoryData';

let props: CalendarPageProps;
vi.mock('./CalendarPage', () => ({
	CalendarPage: (p: CalendarPageProps) => {
		props = p;
		return null;
	}
}));

afterEach(cleanup);

const Harness = meta.component as React.ComponentType<{
	role?: 'consultant' | 'asker';
	empty?: boolean;
	shell?: boolean;
}>;

const own = () => props.entries.filter((e) => e.ownerId === props.ownerId);

describe('Calendar story harness', () => {
	it('empties the calendar when the empty control is switched on', () => {
		const { rerender } = render(<Harness shell={false} />);
		expect(own().length).toBeGreaterThan(0);
		rerender(<Harness shell={false} empty />);
		expect(own()).toHaveLength(0);
	});

	it('shows only advice-seeker entries after switching the role', () => {
		const { rerender } = render(<Harness shell={false} />);
		rerender(<Harness shell={false} role="asker" />);
		expect(props.ownerId).toBe('asker');
		expect(props.entries.some((e) => e.ownerId === ME)).toBe(false);
	});
});
