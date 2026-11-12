// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	INBOX_NAV_CIRCLE_FILL,
	INBOX_NAV_CIRCLE_TEXT,
	InboxNavIcon
} from './InboxNavIcon';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count === undefined ? key : `${key}|${options.count}`
	})
}));

afterEach(cleanup);

describe('InboxNavIcon', () => {
	it('renders no circle for empty, opened and single enquiries', () => {
		for (const [total, unopened] of [
			[0, 0],
			[4, 0],
			[4, 1]
		]) {
			const { unmount } = render(
				<InboxNavIcon totalCount={total} unopenedCount={unopened} />
			);
			expect(screen.queryByTestId('inbox-nav-icon-circle')).toBeNull();
			unmount();
		}
	});

	it('renders the digit for two to nine and the star above nine', () => {
		const { rerender } = render(
			<InboxNavIcon totalCount={9} unopenedCount={9} />
		);
		const circle = screen.getByTestId('inbox-nav-icon-circle');
		expect(circle.textContent).toBe('9');
		expect(circle.querySelector('circle')?.getAttribute('fill')).toBe(
			INBOX_NAV_CIRCLE_FILL
		);
		expect(circle.querySelector('text')?.getAttribute('fill')).toBe(
			INBOX_NAV_CIRCLE_TEXT
		);
		rerender(<InboxNavIcon totalCount={10} unopenedCount={10} />);
		expect(screen.getByTestId('inbox-nav-icon-star')).toBeTruthy();
		expect(screen.getByTestId('inbox-nav-icon-circle').textContent).toBe(
			''
		);
	});

	it('announces the exact count above nine and hides the circle itself', () => {
		render(<InboxNavIcon totalCount={37} unopenedCount={37} />);
		expect(
			screen.getByRole('img', {
				name: 'navigation.consultant.inboxState.unopened|37'
			})
		).toBeTruthy();
		expect(
			screen
				.getByTestId('inbox-nav-icon-circle')
				.getAttribute('aria-hidden')
		).toBe('true');
	});

	it('uses the overdue icon, with a mask only when a circle is shown', () => {
		const { container, rerender } = render(
			<InboxNavIcon totalCount={3} unopenedCount={0} overdue />
		);
		expect(container.querySelector('svg')?.dataset.inboxIcon).toBe(
			'overdue'
		);
		expect(container.querySelector('mask')).toBeNull();
		rerender(<InboxNavIcon totalCount={3} unopenedCount={3} overdue />);
		expect(container.querySelector('mask')).not.toBeNull();
		expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
			'navigation.consultant.inboxState.overdueUnopened|3'
		);
	});

	it('is hidden from screen readers when the link carries the label', () => {
		const { container } = render(
			<InboxNavIcon totalCount={3} unopenedCount={3} announce={false} />
		);
		expect(
			container.querySelector('svg')?.getAttribute('aria-hidden')
		).toBe('true');
		expect(screen.queryByRole('img')).toBeNull();
	});
});
