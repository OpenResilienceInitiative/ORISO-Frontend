/**
 * The geometry of the two-person circle, ticket 04.
 *
 * Pure functions. The component is the markup around them, and the motion is
 * a CSS transition over the values they return — not an animation loop.
 */

/** Who currently holds the floor. */
export type Speaking = 'none' | 'both' | 'first' | 'second';

/**
 * Silence is an even split.
 *
 * Not 50.1% to the counsellor, not a nudge toward the local participant. In a
 * counselling call an unearned advantage to either side is a statement, and
 * silence is not a statement. This is the value the acceptance list means by
 * "neither half favoured".
 */
export const EVEN_SHARE = 0.5;

/**
 * The most one side may take.
 *
 * The quiet person has not left the room. Letting the speaker swell to the
 * whole circle would say they had.
 */
export const MAX_SHARE = 0.62;

/** How far the seam bows at the widest split, as a share of the radius. */
const MAX_BOW = 0.18;

/** The ticket's transition, named so the component and the test agree. */
export const SEAM_EASING = '0.45s cubic-bezier(0.2, 0, 0, 1)';

/**
 * The first participant's share of the circle.
 *
 * Symmetric by construction: mirroring the input mirrors the output. Both
 * speaking is the same as neither — two people talking at once is not a
 * reason to award the circle to whoever the code happens to check first.
 */
export function shareFor(speaking: Speaking): number {
	if (speaking === 'first') return MAX_SHARE;
	if (speaking === 'second') return 1 - MAX_SHARE;
	return EVEN_SHARE;
}

/**
 * How far the seam bows, from -1 (into the first) to 1 (into the second).
 *
 * The seam bulges into whoever is NOT speaking. That is what makes the growth
 * read as one body pressing against another rather than as a bar filling up,
 * and it is continuous through the midpoint so turn-taking never flicks.
 */
export function seamFor(share: number): number {
	return ((share - EVEN_SHARE) / (MAX_SHARE - EVEN_SHARE)) * MAX_BOW;
}
