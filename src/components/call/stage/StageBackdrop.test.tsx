// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StageBackdrop } from './StageBackdrop';

/*
 * SPECIFICATION — the stage surface, ticket 05
 *
 * "Precedence: centre image > atmosphere preset. The image is uploaded
 * centrally by the carrier / counselling centre as part of its configuration
 * — not by an individual counsellor and never by an advice seeker."
 *
 * Precedence is the whole of the logic here, and it is a real either/or in
 * the prototype rather than a z-order: with a preset the pond renders over
 * the surface in `mix-blend-mode: multiply`; with the centre's own image
 * there is no pond at all and the photo carries the stage by itself.
 *
 * Whether the scrim actually keeps header text legible is a contrast
 * measurement, so it is made in the browser by `scripts/shootCallStages.mjs`
 * against real composited pixels. jsdom has no colour.
 */

afterEach(cleanup);

const pond = () => document.querySelector('oriso-pond');

describe('StageBackdrop', () => {
	it('renders the atmosphere when the centre has configured no image', () => {
		render(<StageBackdrop atmosphere="fluss" />);
		expect(pond()).not.toBeNull();
		expect(pond()?.getAttribute('palette')).toBe('fluss');
	});

	it('lets a centre image override the preset entirely', () => {
		// Not layered over it — instead of it. A photo under a multiplying
		// pond is the preset case, and it is not what a centre that uploaded
		// its own backdrop asked for.
		render(
			<StageBackdrop atmosphere="fluss" image={{ src: '/haus.jpg' }} />
		);
		expect(pond()).toBeNull();
		expect(screen.getByTestId('stage-image')).toBeDefined();
	});

	it('falls back to the handoff default when nothing is configured', () => {
		render(<StageBackdrop />);
		expect(pond()?.getAttribute('palette')).toBe('fluss');
	});

	it('always lays the scrim on top', () => {
		// The scrim is what keeps the header and the control rail readable
		// over a backdrop nobody here chose, so it is not optional and does
		// not depend on which of the two is underneath.
		render(<StageBackdrop atmosphere="nacht" />);
		expect(screen.getByTestId('stage-scrim')).toBeDefined();
		cleanup();
		render(<StageBackdrop image={{ src: '/haus.jpg' }} />);
		expect(screen.getByTestId('stage-scrim')).toBeDefined();
	});

	it('is invisible to assistive technology, all of it', () => {
		// A decorative surface. The centre's photograph carries nothing a
		// participant needs, and announcing it would be noise between a
		// counsellor and the person they are talking to.
		render(<StageBackdrop image={{ src: '/haus.jpg' }} />);
		const backdrop = screen.getByTestId('stage-backdrop');
		expect(backdrop.getAttribute('aria-hidden')).toBe('true');
		expect(screen.getByTestId('stage-image').getAttribute('alt')).toBe('');
	});

	it('never lets the backdrop swallow a click meant for the stage', () => {
		render(<StageBackdrop atmosphere="fluss" />);
		expect(screen.getByTestId('stage-backdrop').style.pointerEvents).toBe(
			'none'
		);
	});
});
