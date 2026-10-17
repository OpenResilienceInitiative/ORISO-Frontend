// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HALO_LIFT_PX, QUIET_SHADOW, tint } from './halo';
import { HainStage, type CallParticipant } from './HainStage';

/*
 * SPECIFICATION — what speaking looks like in the Hain
 *
 * The handoff gives the Hain two states outright: a quiet shape with a flat
 * `0 2px 6px`, and a speaking one wearing a halo in its OWN colour, risen
 * 4px out of the field and in front of its neighbours.
 *
 * The second half of this file is about the trap that came with it. The name
 * capsules already carry a z-index for a measured reason — "one name per
 * nine-person room" was being painted over by a later sibling — and lifting
 * the speaking shape onto its own layer is exactly the kind of change that
 * silently undoes that. So the capsules are asserted to still outrank the
 * risen shape.
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

const speakingRoom = (index: number) =>
	ROOM.map((p, i) => ({ ...p, speaking: i === index }));

afterEach(cleanup);

/** The element that actually carries the blob's shadow. */
const shapeOf = (slot: HTMLElement) =>
	slot.querySelector<HTMLElement>('[style*="box-shadow"]');

describe('speaking in the Hain', () => {
	it('leaves every quiet shape flat', () => {
		render(<HainStage participants={ROOM} box={600} />);
		for (const slot of screen.getAllByTestId('participant'))
			expect(shapeOf(slot)?.style.boxShadow).toBe(QUIET_SHADOW);
	});

	it("lights the speaker up in their own colour", () => {
		render(<HainStage participants={speakingRoom(1)} box={600} />);
		const [, speaker] = screen.getAllByTestId('participant');
		const shadow = shapeOf(speaker)?.style.boxShadow ?? '';
		// später Kauz 512's own background, not a system accent.
		expect(shadow).toContain(tint('#BBBCDE', 0.18));
		expect(shadow).toContain(tint('#BBBCDE', 0.5));
		expect(shadow).not.toBe(QUIET_SHADOW);
	});

	it('raises the speaking shape out of the field', () => {
		render(<HainStage participants={speakingRoom(0)} box={600} />);
		const [speaker, quiet] = screen.getAllByTestId('participant');
		expect(speaker.style.transform).toBe(
			`translateY(-${HALO_LIFT_PX}px)`
		);
		expect(quiet.style.transform).toBe('');
	});

	it('puts the speaking shape in front of the others', () => {
		render(<HainStage participants={speakingRoom(0)} box={600} />);
		const [speaker, quiet] = screen.getAllByTestId('participant');
		expect(Number(speaker.style.zIndex)).toBeGreaterThan(0);
		// And nobody else is lifted onto a layer, or the capsules below
		// would be trapped inside it.
		expect(quiet.style.zIndex).toBe('');
	});

	it('keeps every name capsule above the risen shape', () => {
		// The regression this guards: a shape on z-index 3 paints over a
		// neighbour's capsule, and the probe finds a covered name.
		render(<HainStage participants={speakingRoom(0)} box={600} />);
		const [speaker] = screen.getAllByTestId('participant');
		const risen = Number(speaker.style.zIndex);
		for (const pill of screen.getAllByTestId('name-pill')) {
			const layer = Number(
				(pill.parentElement as HTMLElement).style.zIndex
			);
			expect(layer).toBeGreaterThan(risen);
		}
	});
});
