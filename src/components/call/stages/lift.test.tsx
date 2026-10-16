// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { liftFor } from '../../pseudonym/AnimalAvatar';
import { QUIET_SHADOW } from './halo';
import { HainStage, type CallParticipant } from './HainStage';
import { FelderStage } from './FelderStage';
import { EinzelgespraechStage } from './EinzelgespraechStage';

/*
 * SPECIFICATION — the lift
 *
 * The shapes sit on a flat surface and the design has them lifting off it.
 * One soft shadow, `AVATAR_LIFT`, and one definition of it.
 *
 * Two shadow vocabularies, and the split is not arbitrary. The Hain is the
 * one arrangement the handoff states values for in BOTH states — quiet
 * `0 2px 6px`, speaking a halo in the person's own colour — so the Hain uses
 * those and derives nothing. The Felder tile and the Einzelgespräch circle
 * have no stated value, so they use `liftFor`, which scales a judged
 * 104px shadow up to the prototype's largest geometry.
 *
 * The part worth a test is WHERE it goes, because that differs per
 * arrangement and the first attempt got two of three wrong. In the Hain the
 * avatar IS the shape, so the avatar carries it. In the Felder the coloured
 * tile is the shape and the avatar inside is the same colour — invisible by
 * design — so a shadow on the avatar drew a pale disc behind every animal.
 * In the Einzelgespräch the split circle is the shape, and the lift belongs
 * to the whole of it: one per half would trace the seam, which is the single
 * line in that view that has to read as a boundary inside one body rather
 * than as an edge between two.
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

const ROOM = [
	person('ruhiger Fuchs 432', '#D6E9CA'),
	person('später Kauz 512', '#BBBCDE'),
	person('wacher Igel 118', '#FCE7E6')
];

afterEach(cleanup);

/**
 * Everything the stage drew that casts a lift.
 *
 * Matched on the shape of the value rather than one constant: the lift
 * scales with the shape, so a Felder tile and a chat avatar legitimately
 * carry different numbers.
 */
const lifted = () =>
	[...document.querySelectorAll<HTMLElement>('*')].filter((el) =>
		/^0 \d+px \d+px 0 rgba\(0, 0, 0, 0\.\d+\)$/.test(el.style.boxShadow)
	);

describe('the lift', () => {
	it('is one definition, not a value copied into three stylesheets', () => {
		expect(liftFor(104)).toMatch(/^0 2px 8px 0 rgba\(/);
	});

	it('scales with the shape, so a call tile is not lit like a chat row', () => {
		// The whole reason the stages looked flat: one shadow judged at
		// 104px, spread under a 440px tile.
		render(<FelderStage participants={ROOM} width={900} height={600} />);
		const tile = screen.getAllByTestId('field')[0];
		// Deliberately not asserting the exact size: that would pin this
		// test to how `splitCells` happens to divide three people today.
		// What matters is that the tile is lit as a tile, not as a 104px
		// avatar, and that it has not run past the ceiling either.
		const offset = Number(/^0 (\d+)px/.exec(tile.style.boxShadow)?.[1]);
		expect(offset).toBeGreaterThan(2);
		expect(offset).toBeLessThanOrEqual(6);
	});

	it('Hain: the shape is the avatar, so the avatar carries it', () => {
		// And it carries the handoff's OWN value rather than the scaled
		// lift: the Hain is the one arrangement the design states both
		// states for, quiet and speaking, so nothing here is derived. See
		// `speaking.test.tsx` for the other state.
		render(<HainStage participants={ROOM} box={600} />);
		const shapes = screen.getAllByTestId('participant');
		expect(shapes).toHaveLength(3);
		for (const shape of shapes) {
			const drawn = shape.querySelector<HTMLElement>(
				'[style*="box-shadow"]'
			);
			expect(drawn?.style.boxShadow).toBe(QUIET_SHADOW);
		}
		// Nothing in the Hain uses the scaled lift.
		expect(lifted()).toHaveLength(0);
	});

	it('Felder: the tile carries it, and the avatar inside does not', () => {
		render(<FelderStage participants={ROOM} width={900} height={600} />);
		const tiles = screen.getAllByTestId('field');
		expect(tiles).toHaveLength(3);
		// Exactly the tiles. One more would be the pale disc behind the
		// animal that the first attempt produced.
		expect(lifted()).toEqual(tiles);
	});

	it('Einzelgespräch: one lift for the whole circle, none on the halves', () => {
		render(
			<EinzelgespraechStage
				participants={[ROOM[0], ROOM[1]]}
				size={400}
			/>
		);
		const all = lifted();
		expect(all).toHaveLength(1);
		// The halves are inside it, not carrying it.
		expect(all[0].querySelectorAll('[data-testid="half"]').length).toBe(2);
	});
});
