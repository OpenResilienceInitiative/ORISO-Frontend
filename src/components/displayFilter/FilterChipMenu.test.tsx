// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterChipMenu } from './FilterChipMenu';
import { EMPTY_DISPLAY_FILTER, setKindSetting } from './displayFilterTypes';

const Icon = (props: React.SVGProps<SVGSVGElement>) => (
	<svg data-testid="chip-icon" {...props} />
);

const KINDS = [
	{ id: 'unread', label: 'Ungelesen', icon: Icon, unreadCount: 0 },
	{ id: 'nearby', label: 'Mail', icon: Icon, unreadCount: 2 },
	{ id: 'liveChat', label: 'Live-Chat', icon: Icon, unreadCount: 0 },
	{
		id: 'circle',
		label: 'Gesprächskreis',
		icon: Icon,
		unreadCount: 1,
		availability: 'deactivated' as const
	},
	{
		id: 'internalGroup',
		label: 'Intern',
		icon: Icon,
		unreadCount: 0,
		availability: 'absent' as const
	}
];

const LABELS = {
	group: 'Anfragen filtern',
	deactivated: (kind: string) => `${kind} (vom Träger deaktiviert)`
};

describe('FilterChipMenu (#1377, Frank 2026-09-16)', () => {
	afterEach(cleanup);

	it('lists every shown kind with its pill on, badges unread, auto-sorts unread to the left, drops absent kinds', () => {
		render(
			<FilterChipMenu
				kinds={KINDS}
				value={{ ...EMPTY_DISPLAY_FILTER, autoSort: true }}
				activeKindId={null}
				labels={LABELS}
				onToggle={() => undefined}
				onDeactivatedClick={() => undefined}
			/>
		);
		const names = screen
			.getAllByRole('button')
			.map((b) => b.getAttribute('aria-label'));
		expect(names).toEqual([
			'Mail (2)',
			'Gesprächskreis (1) (vom Träger deaktiviert)',
			'Ungelesen',
			'Live-Chat'
		]);
		expect(
			screen.getByRole('group', { name: 'Anfragen filtern' })
		).toBeTruthy();
	});

	it('keeps the section order when auto-sort is off and hides a kind whose pill is off', () => {
		const value = setKindSetting(
			{ ...EMPTY_DISPLAY_FILTER, autoSort: false },
			'liveChat',
			{ pill: false }
		);
		render(
			<FilterChipMenu
				kinds={KINDS}
				value={value}
				activeKindId="nearby"
				labels={LABELS}
				onToggle={() => undefined}
				onDeactivatedClick={() => undefined}
			/>
		);
		const buttons = screen.getAllByRole('button');
		expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
			'Ungelesen',
			'Mail (2)',
			'Gesprächskreis (1) (vom Träger deaktiviert)'
		]);
		expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
	});

	it('toggles an available kind and routes a deactivated kind to the notice instead', () => {
		const onToggle = vi.fn();
		const onDeactivatedClick = vi.fn();
		render(
			<FilterChipMenu
				kinds={KINDS}
				value={EMPTY_DISPLAY_FILTER}
				activeKindId={null}
				labels={LABELS}
				onToggle={onToggle}
				onDeactivatedClick={onDeactivatedClick}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Mail (2)' }));
		expect(onToggle).toHaveBeenCalledWith('nearby');
		const locked = screen.getByRole('button', {
			name: 'Gesprächskreis (1) (vom Träger deaktiviert)'
		});
		expect(locked.getAttribute('aria-disabled')).toBe('true');
		fireEvent.click(locked);
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onDeactivatedClick).toHaveBeenCalledWith('circle');
	});

	it('renders the compact text view without icons', () => {
		render(
			<FilterChipMenu
				kinds={KINDS}
				value={{ ...EMPTY_DISPLAY_FILTER, view: 'text' }}
				activeKindId="liveChat"
				labels={LABELS}
				onToggle={() => undefined}
				onDeactivatedClick={() => undefined}
			/>
		);
		expect(screen.queryAllByTestId('chip-icon')).toHaveLength(0);
		const active = screen.getByRole('button', { name: 'Live-Chat' });
		expect(active.className).toContain('sessionsListToolbar__chip--text');
		expect(active.className).toContain('sessionsListToolbar__chip--active');
		expect(active.textContent).toContain('Live-Chat');
	});

	it('renders icon and label for every chip in the labels view', () => {
		render(
			<FilterChipMenu
				kinds={KINDS}
				value={{ ...EMPTY_DISPLAY_FILTER, view: 'labels' }}
				activeKindId={null}
				labels={LABELS}
				onToggle={() => undefined}
				onDeactivatedClick={() => undefined}
			/>
		);
		const mail = screen.getByRole('button', { name: 'Mail (2)' });
		expect(mail.className).toContain('sessionsListToolbar__chip--labelled');
		expect(mail.className).not.toContain(
			'sessionsListToolbar__chip--iconOnly'
		);
		expect(mail.querySelector('[data-testid="chip-icon"]')).not.toBeNull();
		expect(
			mail
				.querySelector('.sessionsListToolbar__chipLabel')
				?.getAttribute('aria-hidden')
		).not.toBe('true');
	});
});
