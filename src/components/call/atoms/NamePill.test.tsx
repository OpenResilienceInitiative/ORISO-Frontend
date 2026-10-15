// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NamePill } from './NamePill';

/*
 * SPECIFICATION — the name pill
 *
 * The handoff calls this "the single answer to how do we label a person.
 * There is exactly one spec, used on every screen and in every state."
 * Placement changes per arrangement; the treatment does not.
 *
 *   height 26 · radius 13 · padding 0 10 · rgba(76,85,95,.92) idle,
 *   rgb(76,85,95) speaking · blur(4px) · 500 12px/26px · letter-spacing .3px
 *   · white · max-width 132px with an ellipsis
 *
 * Status glyphs sit INSIDE the same capsule at 15px with a 6px gap — never as
 * separate floating badges. That is the rule most likely to be broken by
 * someone adding "just one more" indicator later, so it is asserted here.
 */

afterEach(cleanup);

const pill = () => screen.getByTestId('name-pill');

describe('NamePill', () => {
	it('shows the name', () => {
		render(<NamePill name="ruhiger Fuchs 432" />);
		expect(screen.getByText('ruhiger Fuchs 432')).toBeDefined();
	});

	it('is one capsule, not a name plus floating badges', () => {
		// Everything the pill carries has to be inside it. A second element
		// hovering next to the name is the thing the handoff rules out.
		render(
			<NamePill name="wacher Igel 118" micOff handRaisedForMs={95000} />
		);
		const capsule = pill();
		expect(
			capsule.querySelector('[data-testid="glyph-mic-off"]')
		).not.toBeNull();
		expect(
			capsule.querySelector('[data-testid="glyph-hand"]')
		).not.toBeNull();
	});

	it('says how long the hand has been up', () => {
		// The duration is what makes a facilitator act; a bare hand icon does not.
		render(<NamePill name="klarer Schwan 77" handRaisedForMs={95000} />);
		expect(screen.getByText('1:35')).toBeDefined();
	});

	it('leaves the glyphs out when there is nothing to say', () => {
		render(<NamePill name="später Kauz 512" />);
		expect(
			pill().querySelector('[data-testid="glyph-mic-off"]')
		).toBeNull();
		expect(pill().querySelector('[data-testid="glyph-hand"]')).toBeNull();
	});

	it('marks the speaking state on the capsule itself', () => {
		// Opacity is the only difference, so it cannot be a separate element.
		render(<NamePill name="naher Otter 303" speaking />);
		expect(pill().dataset.speaking).toBe('true');
	});

	it('names the glyphs for people who cannot see them', () => {
		render(
			<NamePill name="stilles Pferd 907" micOff handRaisedForMs={1000} />
		);
		expect(screen.getByText('Mikrofon aus')).toBeDefined();
		expect(screen.getByText(/Hand gehoben/)).toBeDefined();
	});
});
