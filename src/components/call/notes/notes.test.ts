import { describe, expect, it } from 'vite-plus/test';

import {
	NOTE_TYPES,
	type Note,
	addNote,
	asPlainText,
	removeNote
} from './notes';

/*
 * SPECIFICATION — Gesprächsnotizen, ticket 06
 *
 * "A private scratchpad for the counsellor during a call. Private is the
 * feature. It is not a shared agenda, not a transcript, not minutes."
 *
 * Which is why the model is pure functions over a plain array. Purity is not
 * tidiness here — it is the privacy guarantee made structural. A pure
 * function cannot post, cannot store and cannot subscribe, and that is far
 * harder to erode later than a comment asking people not to.
 *
 * Three types and no fourth: "Frage · Anmerkung · Aufgabe. No fourth type, no
 * free tagging." A taxonomy that grows is a taxonomy nobody reads.
 */

const note = (type: Note['type'], text: string, id: string): Note => ({
	id,
	type,
	text
});

describe('the taxonomy', () => {
	it('is exactly three, in the ticket´s order', () => {
		expect(NOTE_TYPES).toEqual(['frage', 'anmerkung', 'aufgabe']);
	});
});

describe('addNote', () => {
	it('appends a note', () => {
		const out = addNote([], { type: 'frage', text: 'Wohnsituation?' }, 'a');
		expect(out).toEqual([note('frage', 'Wohnsituation?', 'a')]);
	});

	it('trims the text', () => {
		const out = addNote([], { type: 'aufgabe', text: '  Rückruf  ' }, 'a');
		expect(out[0].text).toBe('Rückruf');
	});

	it('refuses an empty note, and returns the very same array', () => {
		// The same array, not an equal one: a new array would re-render the
		// list and make a mis-click look like something happened.
		const before: Note[] = [note('frage', 'eins', 'a')];
		expect(addNote(before, { type: 'frage', text: '   ' }, 'b')).toBe(
			before
		);
	});

	it('never mutates what it was given', () => {
		const before: Note[] = [note('frage', 'eins', 'a')];
		addNote(before, { type: 'anmerkung', text: 'zwei' }, 'b');
		expect(before).toHaveLength(1);
	});
});

describe('removeNote', () => {
	it('removes by id', () => {
		const before = [
			note('frage', 'eins', 'a'),
			note('aufgabe', 'zwei', 'b')
		];
		expect(removeNote(before, 'a')).toEqual([note('aufgabe', 'zwei', 'b')]);
	});

	it('returns the same array when there is nothing to remove', () => {
		const before = [note('frage', 'eins', 'a')];
		expect(removeNote(before, 'nope')).toBe(before);
	});
});

describe('asPlainText', () => {
	const labels = {
		frage: 'Frage',
		anmerkung: 'Anmerkung',
		aufgabe: 'Aufgabe'
	};

	it('groups by type, in the taxonomy´s order', () => {
		// "Copy produces readable plain text a counsellor can paste into a
		// case file." Grouped, because that is how a case file reads.
		const text = asPlainText(
			[
				note('aufgabe', 'Rückruf am Montag', 'c'),
				note('frage', 'Wohnsituation?', 'a'),
				note('anmerkung', 'wirkt erschöpft', 'b')
			],
			labels
		);
		expect(text).toBe(
			[
				'Frage',
				'- Wohnsituation?',
				'',
				'Anmerkung',
				'- wirkt erschöpft',
				'',
				'Aufgabe',
				'- Rückruf am Montag'
			].join('\n')
		);
	});

	it('leaves out a type nobody used', () => {
		const text = asPlainText([note('frage', 'eins', 'a')], labels);
		expect(text).not.toContain('Aufgabe');
	});

	it('copies nothing at all from an empty pad', () => {
		// Not a lone heading. Pasting a bare "Frage" into a case file is
		// worse than pasting nothing.
		expect(asPlainText([], labels)).toBe('');
	});
});
