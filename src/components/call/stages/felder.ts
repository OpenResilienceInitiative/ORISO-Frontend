/**
 * The rules behind the Felder view, ticket 03.
 *
 * Pure functions, no DOM: the stage component is the markup around these.
 */

/**
 * The largest room the stage still subdivides for.
 *
 * Beyond this the ticket says to stop: "switch to a fixed tile size, let the
 * container scroll, and re-sort so anyone currently speaking moves to the
 * top". Nine fields on one screen stops being a conversation and becomes a
 * contact sheet.
 */
export const FELDER_MAX_SPLIT = 8;

export const splitsInto = (count: number): boolean => count <= FELDER_MAX_SPLIT;

/**
 * Speakers first, everybody else untouched.
 *
 * The second half of that sentence is the hard part and the reason this is a
 * function with tests rather than a `sort` call at a call site. A comparator
 * that reorders the quiet participants every time somebody starts talking
 * makes a room of twenty unreadable — you lose the person you were watching
 * because a third party cleared their throat.
 *
 * So: a stable partition. Speakers keep their relative order among
 * themselves, the quiet keep theirs, and nothing else moves.
 */
export function orderForFelder<T>(
	participants: readonly T[],
	speaking: readonly T[]
): T[] {
	const isSpeaking = new Set(speaking);
	const loud: T[] = [];
	const quiet: T[] = [];
	for (const p of participants) (isSpeaking.has(p) ? loud : quiet).push(p);
	return [...loud, ...quiet];
}
