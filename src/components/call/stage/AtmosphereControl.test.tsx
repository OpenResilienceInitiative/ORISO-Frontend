// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AtmosphereControl } from './AtmosphereControl';

/*
 * SPECIFICATION — the header's backdrop control, ticket 05
 *
 * "Header control is a 44 px icon-only button with a tooltip; no label."
 *
 * The prototype is more specific than the ticket, and the difference is the
 * nice part: the control does not show a picture OF a backdrop, it shows
 * THE backdrop. With a preset it is a 30px round live pond running the very
 * palette the stage is running. Only when the centre has uploaded its own
 * image does it fall back to a glyph on a grey disc — a photograph shrunk
 * to 30px is mud, and the design says so by not doing it.
 */

afterEach(cleanup);

describe('AtmosphereControl', () => {
	it('previews the live atmosphere, not a picture of one', () => {
		render(
			<AtmosphereControl
				label="Atmosphäre wählen"
				atmosphere="nacht"
				onClick={vi.fn()}
			/>
		);
		const preview = document.querySelector('oriso-pond');
		expect(preview).not.toBeNull();
		// The same palette the stage is on, or the control is lying about
		// what pressing it would change.
		expect(preview?.getAttribute('palette')).toBe('nacht');
	});

	it('falls back to a glyph once the centre supplies its own image', () => {
		// A photograph at 30px is mud. The design shows a glyph instead.
		render(
			<AtmosphereControl
				label="Atmosphäre wählen"
				atmosphere="nacht"
				image={{ src: '/haus.jpg' }}
				onClick={vi.fn()}
			/>
		);
		expect(document.querySelector('oriso-pond')).toBeNull();
		expect(screen.getByTestId('atmosphere-control-image')).toBeDefined();
	});

	it('is icon-only, with the tooltip and the name both present', () => {
		render(
			<AtmosphereControl
				label="Atmosphäre wählen"
				atmosphere="fluss"
				onClick={vi.fn()}
			/>
		);
		const button = screen.getByRole('button', {
			name: 'Atmosphäre wählen'
		});
		expect(button.textContent?.trim()).toBe('');
		expect(button.getAttribute('title')).toBe('Atmosphäre wählen');
	});

	it('says that it opens something', () => {
		render(
			<AtmosphereControl
				label="Atmosphäre wählen"
				atmosphere="fluss"
				onClick={vi.fn()}
				expanded
			/>
		);
		expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
			'true'
		);
	});

	it('reports a press', async () => {
		const onClick = vi.fn();
		render(
			<AtmosphereControl
				label="Atmosphäre wählen"
				atmosphere="fluss"
				onClick={onClick}
			/>
		);
		await userEvent.setup().click(screen.getByRole('button'));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
