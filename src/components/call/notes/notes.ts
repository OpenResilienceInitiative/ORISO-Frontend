/**
 * The model behind the Gesprächsnotizen, ticket 06.
 *
 * Pure functions over a plain array, and that is the privacy guarantee rather
 * than a matter of taste. "Private is the feature": these notes are a
 * counsellor writing about somebody who did not consent to a record. A pure
 * function cannot post, cannot store and cannot subscribe — which is much
 * harder to erode a year from now than a comment asking people not to.
 *
 * There is no persistence here and none is planned. The notes live for the
 * duration of the call and then they are gone.
 */

/**
 * The whole taxonomy. Three, and no fourth.
 *
 * The ticket is explicit: "No fourth type, no free tagging." A taxonomy that
 * grows is one nobody reads, and free tags in a counselling context invite
 * exactly the kind of detail these notes should not accumulate.
 */
export const NOTE_TYPES = ['frage', 'anmerkung', 'aufgabe'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export interface Note {
	readonly id: string;
	readonly type: NoteType;
	readonly text: string;
}

export interface NoteDraft {
	readonly type: NoteType;
	readonly text: string;
}

/** The three words. Rendered as words, never as a colour dot. */
export type NoteLabels = Readonly<Record<NoteType, string>>;

/**
 * Add a note, unless there is nothing to add.
 *
 * An empty draft returns the SAME array, not an equal one. A new array would
 * re-render the list and make a mis-click look like something happened.
 */
export function addNote(
	notes: readonly Note[],
	draft: NoteDraft,
	id: string
): readonly Note[] {
	const text = draft.text.trim();
	if (text === '') return notes;
	return [...notes, { id, type: draft.type, text }];
}

/** Remove by id; the same array back when there was nothing to remove. */
export function removeNote(
	notes: readonly Note[],
	id: string
): readonly Note[] {
	const rest = notes.filter((n) => n.id !== id);
	return rest.length === notes.length ? notes : rest;
}

/**
 * The whole pad as plain text, grouped by type.
 *
 * This is the only way anything leaves. Grouped because that is how a case
 * file reads, and in the taxonomy's order rather than the order of typing,
 * so two counsellors' notes paste the same way.
 *
 * An empty pad copies NOTHING — not a lone heading. Pasting a bare "Frage"
 * into a case file is worse than pasting nothing at all.
 */
export function asPlainText(
	notes: readonly Note[],
	labels: NoteLabels
): string {
	const blocks: string[] = [];
	for (const type of NOTE_TYPES) {
		const of = notes.filter((n) => n.type === type);
		if (of.length === 0) continue;
		blocks.push([labels[type], ...of.map((n) => `- ${n.text}`)].join('\n'));
	}
	return blocks.join('\n\n');
}
