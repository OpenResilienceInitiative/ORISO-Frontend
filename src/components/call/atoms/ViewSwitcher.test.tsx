// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ViewSwitcher, type CallView } from './ViewSwitcher';

/*
 * SPECIFICATION — the view switcher, ticket 05
 *
 * "44 px rail, radius 22, 36 px round buttons. Inactive: icon only. Active:
 * icon + label, padding: 0 14px 0 11px, Inter 500 13/18, letter-spacing .2px.
 * Fill rgb(251,244,211) on dark stages, #a5000a with white ink on light ones."
 *
 * The geometry and the two fills are CSS, and CSS is not loaded here — those
 * are checked in the browser by `scripts/shootCallStages.mjs`. What this file
 * holds to account is the part a stylesheet cannot carry: that the control is
 * a single choice among views, that it is operable from the keyboard, and
 * that the current view is legible without seeing a colour.
 *
 * That last one is the design's own reasoning, not an accessibility tax
 * bolted on: the active view is the only one that spells out its name, "so
 * the control keeps its size no matter how many views the room offers".
 */

const VIEWS: CallView[] = [
	{ key: 'kreis', label: 'Kreis', icon: <svg data-testid="i-kreis" /> },
	{ key: 'kacheln', label: 'Kacheln', icon: <svg data-testid="i-kacheln" /> },
	{
		key: 'spotlight',
		label: 'Spotlight',
		icon: <svg data-testid="i-spotlight" />
	}
];

const renderSwitcher = (
	active = 'kreis',
	onChange = vi.fn<(key: string) => void>()
) => {
	render(
		<ViewSwitcher
			views={VIEWS}
			active={active}
			onChange={onChange}
			label="Ansicht"
		/>
	);
	return onChange;
};

afterEach(cleanup);

describe('ViewSwitcher', () => {
	it('is one choice among the views, not three separate toggles', () => {
		renderSwitcher();
		expect(screen.getByRole('radiogroup', { name: 'Ansicht' })).toBeDefined();
		expect(screen.getAllByRole('radio')).toHaveLength(3);
	});

	it('marks exactly one view as the current one', () => {
		renderSwitcher('kacheln');
		const checked = screen
			.getAllByRole('radio')
			.filter((r) => r.getAttribute('aria-checked') === 'true');
		expect(checked).toHaveLength(1);
		expect(checked[0].getAttribute('data-view')).toBe('kacheln');
	});

	it('spells out only the active view, and keeps the rest icon-only', () => {
		renderSwitcher('kacheln');
		// The design's reason: the control keeps its size however many views
		// the room offers.
		expect(screen.getByText('Kacheln')).toBeDefined();
		expect(screen.queryByText('Kreis')).toBeNull();
		expect(screen.queryByText('Spotlight')).toBeNull();
	});

	it('names every view for a screen reader, including the icon-only ones', () => {
		renderSwitcher('kacheln');
		for (const name of ['Kreis', 'Kacheln', 'Spotlight'])
			expect(screen.getByRole('radio', { name })).toBeDefined();
	});

	it('does not rely on colour to say which view is current', () => {
		// The active view is the only one carrying a visible word, so the
		// state survives a greyscale screenshot and a colour-blind reader.
		renderSwitcher('spotlight');
		const words = screen
			.getAllByRole('radio')
			.filter((r) => r.textContent?.trim() !== '');
		expect(words).toHaveLength(1);
		expect(words[0].getAttribute('data-view')).toBe('spotlight');
	});

	it('reports the view that was picked', async () => {
		const onChange = renderSwitcher('kreis');
		await userEvent
			.setup()
			.click(screen.getByRole('radio', { name: 'Spotlight' }));
		expect(onChange).toHaveBeenCalledWith('spotlight');
	});

	it('says nothing when the current view is picked again', async () => {
		// A no-op that re-renders the whole stage is not a no-op.
		const onChange = renderSwitcher('kreis');
		await userEvent
			.setup()
			.click(screen.getByRole('radio', { name: 'Kreis' }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it('is one tab stop, not three', async () => {
		// Roving tabindex: a radio group is a single stop, and the arrows
		// move inside it. Three stops would make a four-view room tedious.
		renderSwitcher('kacheln');
		const radios = screen.getAllByRole('radio');
		expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual([
			'-1',
			'0',
			'-1'
		]);
	});

	it('moves with the arrow keys', async () => {
		const onChange = renderSwitcher('kreis');
		const user = userEvent.setup();
		screen.getByRole('radio', { name: 'Kreis' }).focus();

		await user.keyboard('{ArrowRight}');
		expect(onChange).toHaveBeenLastCalledWith('kacheln');
		await user.keyboard('{ArrowDown}');
		expect(onChange).toHaveBeenLastCalledWith('kacheln');
	});

	it('wraps at both ends', async () => {
		// Both directions, because they are separate branches and a wrap
		// that only works backwards looks fine until someone presses right.
		const forwards = renderSwitcher('spotlight');
		const user = userEvent.setup();
		screen.getByRole('radio', { name: 'Spotlight' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(forwards).toHaveBeenLastCalledWith('kreis');

		cleanup();
		const backwards = renderSwitcher('kreis');
		screen.getByRole('radio', { name: 'Kreis' }).focus();
		await user.keyboard('{ArrowLeft}');
		expect(backwards).toHaveBeenLastCalledWith('spotlight');
	});

	it('jumps to the ends with Home and End', async () => {
		const onChange = renderSwitcher('kacheln');
		const user = userEvent.setup();
		screen.getByRole('radio', { name: 'Kacheln' }).focus();

		await user.keyboard('{Home}');
		expect(onChange).toHaveBeenLastCalledWith('kreis');
		await user.keyboard('{End}');
		expect(onChange).toHaveBeenLastCalledWith('spotlight');
	});

	it('carries the stage tone, because the fill depends on it', () => {
		// rgb(251,244,211) on a dark stage, #a5000a with white ink on a light
		// one. The component cannot know which it is sitting on, so it is
		// told; the colours themselves live in the stylesheet.
		render(
			<ViewSwitcher
				views={VIEWS}
				active="kreis"
				onChange={vi.fn()}
				label="Ansicht"
				tone="light"
			/>
		);
		expect(
			screen.getByTestId('view-switcher').getAttribute('data-tone')
		).toBe('light');
	});

	it('defaults to the dark stage, which is the common case', () => {
		renderSwitcher();
		expect(
			screen.getByTestId('view-switcher').getAttribute('data-tone')
		).toBe('dark');
	});
});
