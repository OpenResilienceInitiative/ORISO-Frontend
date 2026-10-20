/**
 * How far a shape lifts off the surface behind it.
 *
 * One shadow cannot serve a 24px avatar in a chat row and a 440px tile on a
 * call stage. `0 2px 8px` was judged by eye on a 104px avatar and it is
 * right there; on a tile four times that size it is a smudge under one edge
 * and the stage reads as flat paper.
 *
 * The design does not use one shadow either. The handoff's vocabulary runs
 * from `0 1px 3px` on small chrome through `0 3px 10px` and `0 4px 12px` up
 * to `0 6px 18px` on its largest floating element. So this interpolates
 * between two anchors, and both of them come from somewhere rather than from
 * taste:
 *
 *   104px   `0 2px 8px  rgba(0,0,0,.10)`   ORISO's own avatar, judged by eye
 *   320px   `0 6px 18px rgba(0,0,0,.16)`   the prototype's largest geometry,
 *                                          at the alpha it uses on light
 *                                          surfaces
 *
 * Neither end extrapolates. Below 104 the small value holds, because that is
 * the range every existing screen in the app draws avatars in and none of
 * them should shift. Above 320 the large one holds, because an 800px shape
 * does not want a 15px offset — past a point a shadow stops reading as
 * height and starts reading as fog.
 */

/** Where the judged value applies exactly. */
export const LIFT_MIN_AT = 104;
/** Where the prototype's large geometry is reached, and stops growing. */
export const LIFT_MAX_AT = 320;

interface Lift {
	offset: number;
	blur: number;
	alpha: number;
}

const SMALL: Lift = { offset: 2, blur: 8, alpha: 0.1 };
const LARGE: Lift = { offset: 6, blur: 18, alpha: 0.16 };

/*
 * One spelling, built in one place.
 *
 * The constant below was written out by hand as `rgba(0, 0, 0, 0.10)` while
 * the interpolated path produced `0.1` for the identical colour. CSS cannot
 * tell them apart; a test comparing computed style to the constant can, and
 * did. Both now come out of this function.
 */
const spell = ({ offset, blur, alpha }: Lift): string =>
	`0 ${offset}px ${blur}px 0 rgba(0, 0, 0, ${alpha})`;

/** The judged value, and what every avatar at or below 104px still gets. */
export const AVATAR_LIFT = spell(SMALL);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * The lift for a shape of this size, in CSS.
 *
 * A size that is missing, zero or negative gets the small value: a stage
 * that has not measured itself yet should render a sane avatar, not `NaN`.
 */
export function liftFor(size: number): string {
	if (!Number.isFinite(size) || size <= LIFT_MIN_AT) return AVATAR_LIFT;

	const t = Math.min(1, (size - LIFT_MIN_AT) / (LIFT_MAX_AT - LIFT_MIN_AT));
	return spell({
		offset: Math.round(lerp(SMALL.offset, LARGE.offset, t)),
		blur: Math.round(lerp(SMALL.blur, LARGE.blur, t)),
		// Two decimals, then trimmed: `0.13`, not `0.13000000000000003`.
		alpha: Number(lerp(SMALL.alpha, LARGE.alpha, t).toFixed(2))
	});
}
