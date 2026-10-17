// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
	EinzelgespraechStage,
	QUIET_DIM
} from './EinzelgespraechStage';
import { type CallParticipant } from './HainStage';

/*
 * SPECIFICATION — the Sprachkreis, its body and its voice
 *
 * The handoff builds the circle out of four stacked layers, and the two it
 * adds on top of the halves are the whole reason it does not read as a flat
 * pie chart:
 *
 *   a sphere shading — a white highlight from the upper left and a dark
 *   wash from the lower right, plus two inset shadows — which turns a disc
 *   into a body;
 *
 *   a rim light in ORISO red, clipped to whoever is speaking, with the
 *   quiet side dimmed to 70%.
 *
 * In the prototype those two alternate on a nine-second demo timer. Here
 * they follow `speaking`, which the stage already knows — this is the
 * circle answering the microphone, and it needed no new API to do it.
 */

const person = (
	name: string,
	bg: string,
	speaking = false
): CallParticipant => ({
	name,
	avatar: { file: 'fox.svg', bg, iconColor: '#111' },
	speaking
});

const pair = (speakingIndex = -1) =>
	[
		person('wacher Igel 118', '#FCE7E6', speakingIndex === 0),
		person('Susanne P.', '#BBBCDE', speakingIndex === 1)
	] as [CallParticipant, CallParticipant];

afterEach(cleanup);

describe('the sphere', () => {
	it('is always there, speaking or not', () => {
		// It is the circle's body, not a state. A disc that only becomes a
		// sphere when somebody talks would pulse.
		render(<EinzelgespraechStage participants={pair()} size={400} />);
		expect(screen.getByTestId('sphere')).toBeDefined();
		cleanup();
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		expect(screen.getByTestId('sphere')).toBeDefined();
	});

	it('lies over the animals, not under them', () => {
		// The shading is of the whole body including what is painted on it.
		// Underneath the artwork it would only tint the background and the
		// circle would stay flat.
		render(<EinzelgespraechStage participants={pair()} size={400} />);
		const sphere = screen.getByTestId('sphere');
		const animals = screen.getAllByTestId('animal');
		for (const animal of animals)
			expect(
				sphere.compareDocumentPosition(animal) &
					Node.DOCUMENT_POSITION_PRECEDING
			).toBeTruthy();
	});

	it('never eats a click meant for the circle', () => {
		render(<EinzelgespraechStage participants={pair()} size={400} />);
		expect(screen.getByTestId('sphere').style.pointerEvents).toBe('none');
	});
});

describe('the animals on the sphere', () => {
	it('paint no plate of their own', () => {
		/*
		 * The avatar normally paints a coloured disc behind its artwork —
		 * that disc IS the avatar everywhere else in ORISO. Here the half
		 * already carries that colour, so the disc is an invisible
		 * duplicate, and it stays invisible only while both are fully
		 * opaque.
		 *
		 * Dim the quiet side and it stops being invisible: the disc at 70%
		 * over a half that is already at 70% composites darker than its
		 * surroundings, and a grey ring appears behind the animal. Found in
		 * a screenshot, not here — so this is the test that keeps it found.
		 */
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		for (const animal of screen.getAllByTestId('animal')) {
			const plate = animal.querySelector<HTMLElement>('div');
			expect(plate?.style.background).toBe('transparent');
		}
	});
});

describe('the rim light', () => {
	it('stays off while nobody is speaking', () => {
		render(<EinzelgespraechStage participants={pair()} size={400} />);
		expect(screen.queryByTestId('rim')).toBeNull();
	});

	it('lights the side that is speaking, and only that side', () => {
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		expect(screen.getByTestId('rim').getAttribute('data-side')).toBe(
			'first'
		);
		cleanup();
		render(<EinzelgespraechStage participants={pair(1)} size={400} />);
		expect(screen.getByTestId('rim').getAttribute('data-side')).toBe(
			'second'
		);
	});

	it('is clipped by the seam, so it bows where the seam bows', () => {
		// A straight clip down the middle would leave the light crossing
		// into the quiet half exactly where the seam has pushed away from
		// it.
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		const first = screen.getByTestId('rim').style.clipPath;
		expect(first).toMatch(/^url\(#/);
		cleanup();

		render(<EinzelgespraechStage participants={pair(1)} size={400} />);
		const second = screen.getByTestId('rim').style.clipPath;
		expect(second).toMatch(/^url\(#/);
		// Each side has its OWN clip. Pointing both at the same path lights
		// the first half while the second one talks, and the test that only
		// checked for "a url" waved that through.
		expect(second).not.toBe(first);
		expect(
			document.querySelector(
				`#${/url\(#(.+)\)/.exec(second)?.[1]}`
			)
		).not.toBeNull();
	});

	it('dims the quiet side and leaves the speaking one whole', () => {
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		const halves = screen.getAllByTestId('half');
		const first = halves.find((h) => h.dataset.side === 'first');
		const second = halves.find((h) => h.dataset.side === 'second');
		expect(first?.style.opacity).toBe('');
		expect(second?.style.opacity).toBe(String(QUIET_DIM));
	});

	it('dims the quiet animal with its side, not just the colour', () => {
		// In the handoff the animal is a child of the half and dims with
		// it. Here they are siblings, so the dimming has to be applied
		// twice or the quiet person's colour steps back while their animal
		// stays at full strength — which reads as a rendering fault.
		render(<EinzelgespraechStage participants={pair(0)} size={400} />);
		const [first, second] = screen.getAllByTestId('animal');
		expect(first.style.opacity).toBe('');
		expect(second.style.opacity).toBe(String(QUIET_DIM));
	});

	it('dims nobody when the room is silent', () => {
		render(<EinzelgespraechStage participants={pair()} size={400} />);
		for (const half of screen.getAllByTestId('half'))
			expect(half.style.opacity).toBe('');
	});

	it('dims nobody when both are talking at once', () => {
		const both = [
			person('wacher Igel 118', '#FCE7E6', true),
			person('Susanne P.', '#BBBCDE', true)
		] as [CallParticipant, CallParticipant];
		render(<EinzelgespraechStage participants={both} size={400} />);
		for (const half of screen.getAllByTestId('half'))
			expect(half.style.opacity).toBe('');
	});
});
