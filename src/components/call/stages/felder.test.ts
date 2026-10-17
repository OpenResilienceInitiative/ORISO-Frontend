import { describe, expect, it } from 'vitest';

import { FELDER_MAX_SPLIT, orderForFelder, splitsInto } from './felder';

/*
 * SPECIFICATION — the Felder view, ticket 03
 *
 * The rectilinear counterpart to the Hain: the stage subdivides until
 * everyone has a field, and the speaker's field is the largest.
 *
 * Beyond eight it stops subdividing — "switch to a fixed tile size, let the
 * container scroll, and re-sort so anyone currently speaking moves to the
 * top. The sort must be stable for everyone else — no shuffling on every
 * speaker change."
 *
 * That last sentence is the whole of this file. A sort that reshuffles the
 * quiet participants every time somebody starts talking makes a room of
 * twenty unreadable: you lose the person you were looking at. So the order is
 * tested for stability, not just for speakers-first.
 */

const people = (n: number): string[] =>
	Array.from({ length: n }, (_, i) => `p${i}`);

describe('splitsInto', () => {
	it('subdivides up to eight', () => {
		for (const n of [1, 2, 3, 4, 6, 8]) expect(splitsInto(n)).toBe(true);
	});

	it('stops subdividing beyond eight', () => {
		// Nine fields on one screen is not a conversation, it is a contact
		// sheet. The ticket draws the line here.
		for (const n of [9, 12, 20]) expect(splitsInto(n)).toBe(false);
	});

	it('draws the line where the ticket draws it', () => {
		expect(FELDER_MAX_SPLIT).toBe(8);
	});
});

describe('orderForFelder', () => {
	it('leaves the order alone while nobody is speaking', () => {
		expect(orderForFelder(people(5), [])).toEqual(people(5));
	});

	it('moves whoever is speaking to the top', () => {
		expect(orderForFelder(people(5), ['p3'])).toEqual([
			'p3',
			'p0',
			'p1',
			'p2',
			'p4'
		]);
	});

	it('keeps several speakers in their original relative order', () => {
		expect(orderForFelder(people(6), ['p4', 'p1'])).toEqual([
			'p1',
			'p4',
			'p0',
			'p2',
			'p3',
			'p5'
		]);
	});

	it('never reshuffles the quiet ones when the turn passes', () => {
		// The rule that makes a room of twenty readable: you must not lose the
		// person you were looking at because somebody else started talking.
		const room = people(20);
		const quietOf = (speaking: string[]) =>
			orderForFelder(room, speaking).filter((p) => !speaking.includes(p));

		expect(quietOf(['p7'])).toEqual(quietOf(['p7']));
		// The quiet ones keep their relative order across any turn change.
		const a = quietOf(['p2']).filter((p) => p !== 'p11');
		const b = quietOf(['p11']).filter((p) => p !== 'p2');
		expect(a).toEqual(b);
	});

	it('is a pure rearrangement — nobody added, nobody lost', () => {
		const room = people(20);
		const out = orderForFelder(room, ['p9', 'p0']);
		expect([...out].sort()).toEqual([...room].sort());
	});

	it('ignores a speaker who is not in the room', () => {
		expect(orderForFelder(people(3), ['ghost'])).toEqual(people(3));
	});
});
