/**
 * The one set of motion values for views that arrive and leave. Rooms and
 * registration steps pick a direction; they never pick a duration or an easing
 * (ORISO-Frontend#1736, Frank 2026-10-15: "smooth experience", one global layer).
 */
export const transitionMotion = {
	/** M3 emphasized decelerate: arrives fast and settles. */
	easeIn: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
	/** M3 emphasized accelerate: leaves slowly, then gets out of the way. */
	easeOut: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
	/** A whole view moving in next to the stage. */
	viewMs: 420,
	/** A step moving inside the column it already sits in. */
	stepMs: 320,
	/** A small control leaving (the login button). */
	exitMs: 240
} as const;
