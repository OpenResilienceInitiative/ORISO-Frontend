// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposerToolbar } from './ComposerToolbar';

afterEach(() => cleanup());

const translate = ((_key: string, fallback?: string) =>
	fallback ?? _key) as any;

const renderToolbar = (
	extra: Partial<React.ComponentProps<typeof ComposerToolbar>> = {}
) =>
	render(
		<ComposerToolbar
			direction="up"
			isMobile={false}
			isExpanded={false}
			onAction={vi.fn()}
			isActionSelected={() => false}
			onCollapse={vi.fn()}
			onExpandToggle={vi.fn()}
			translate={translate}
			{...extra}
		/>
	);

/**
 * T23 (review v5 finding): the expanded formatting toolbar carries the same
 * two navigation arrows as the compact action bar — back (phone only) and
 * scroll to newest (everywhere) — so the phone never loses its way back
 * while formatting.
 */
describe('ComposerToolbar navigation arrows', () => {
	it('puts scroll-to-newest first, as a real arrow-down icon', () => {
		const onScrollToNewest = vi.fn();
		renderToolbar({ onScrollToNewest });
		const buttons = screen.getAllByRole('button');
		expect(buttons[0].getAttribute('aria-label')).toBe('Scroll to bottom');
		expect(
			buttons[0].querySelector('[data-testid="ArrowDownwardIcon"]')
		).toBeTruthy();
		buttons[0].click();
		expect(onScrollToNewest).toHaveBeenCalledTimes(1);
	});

	it('shows the back arrow before it on the phone and badges the unread count', () => {
		const onBack = vi.fn();
		renderToolbar({
			showBack: true,
			onBack,
			onScrollToNewest: vi.fn(),
			unreadCount: 4
		});
		const buttons = screen.getAllByRole('button');
		expect(buttons[0].getAttribute('aria-label')).toBe('Navigate up');
		expect(buttons[1].getAttribute('aria-label')).toBe(
			'Scroll to bottom – 4'
		);
		buttons[0].click();
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('renders neither arrow when the host wires none (nothing reserved)', () => {
		renderToolbar();
		expect(
			screen.queryByRole('button', { name: 'Navigate up' })
		).toBeNull();
		expect(
			screen.queryByRole('button', { name: /Scroll to bottom/ })
		).toBeNull();
	});
});
