// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StageControlButton } from './StageControlButton';

/*
 * SPECIFICATION — the stage header control, ticket 05
 *
 * "Header control is a 44 px icon-only button with a tooltip; no label."
 *
 * The 44 and the radius are CSS and are measured in the browser. What this
 * file holds to account is the pair the sentence actually sets up: icon-only
 * on screen, but never nameless to a screen reader. A tooltip is not an
 * accessible name — it does not exist for a keyboard or a screen-reader
 * user, and `title` alone is read inconsistently — so the same words go in
 * `aria-label` as well.
 */

afterEach(cleanup);

describe('StageControlButton', () => {
	it('shows no label, and still has one', () => {
		render(
			<StageControlButton
				label="Atmosphäre wählen"
				icon={<svg data-testid="glyph" />}
				onClick={vi.fn()}
			/>
		);
		const button = screen.getByRole('button', {
			name: 'Atmosphäre wählen'
		});
		// Nothing readable on screen — the glyph is the whole of it.
		expect(button.textContent?.trim()).toBe('');
		expect(screen.getByTestId('glyph')).toBeDefined();
	});

	it('carries the tooltip as well as the name', () => {
		// Both, not either: the tooltip serves the mouse, the label serves
		// everyone else.
		render(
			<StageControlButton
				label="Atmosphäre wählen"
				icon={<svg />}
				onClick={vi.fn()}
			/>
		);
		const button = screen.getByRole('button');
		expect(button.getAttribute('title')).toBe('Atmosphäre wählen');
		expect(button.getAttribute('aria-label')).toBe('Atmosphäre wählen');
	});

	it('hides its glyph from assistive technology', () => {
		// Announced once, by the label — not twice.
		render(
			<StageControlButton
				label="Atmosphäre wählen"
				icon={<svg data-testid="glyph" />}
				onClick={vi.fn()}
			/>
		);
		expect(
			screen.getByTestId('glyph').closest('[aria-hidden="true"]')
		).not.toBeNull();
	});

	it('reports a press', async () => {
		const onClick = vi.fn();
		render(
			<StageControlButton
				label="Atmosphäre wählen"
				icon={<svg />}
				onClick={onClick}
			/>
		);
		await userEvent.setup().click(screen.getByRole('button'));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('says when it has something open', () => {
		// The atmosphere control opens a chooser, so it owes a screen reader
		// the expanded state rather than silently toggling a panel.
		render(
			<StageControlButton
				label="Atmosphäre wählen"
				icon={<svg />}
				onClick={vi.fn()}
				expanded
			/>
		);
		expect(
			screen.getByRole('button').getAttribute('aria-expanded')
		).toBe('true');
	});

	it('stays quiet about expansion when it opens nothing', () => {
		render(
			<StageControlButton
				label="Ton aus"
				icon={<svg />}
				onClick={vi.fn()}
			/>
		);
		expect(
			screen.getByRole('button').getAttribute('aria-expanded')
		).toBeNull();
	});

	it('is a button, not a submit', () => {
		// Dropped into a header that happens to sit in a form, a default
		// submit button sends it.
		render(
			<StageControlButton
				label="Ton aus"
				icon={<svg />}
				onClick={vi.fn()}
			/>
		);
		expect(screen.getByRole('button').getAttribute('type')).toBe('button');
	});
});
