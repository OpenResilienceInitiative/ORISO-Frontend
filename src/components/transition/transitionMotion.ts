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
	/** M3 standard: eases off at both ends, for a shape that travels and stops. */
	easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
	/** A whole view moving in next to the stage. */
	viewMs: 420,
	/** A step moving inside the column it already sits in. */
	stepMs: 320,
	/** A small control leaving (the login button). */
	exitMs: 240,
	/**
	 * The closing animation, when a person leaves a waiting room for the chat or
	 * the call (ORISO-Frontend#1737). One design, one timeline: cover and reveal
	 * take the same time in every room.
	 */
	closing: {
		/** The red takes the screen. */
		coverMs: 340,
		/** And gives it back, ending on the focal point. */
		revealMs: 520,
		/**
		 * Longest wait for the destination's focal element once the room is
		 * swapped. A join or an accept is a request first, so the chat can be a
		 * second away; the red holds the screen instead of showing the half-way.
		 */
		focalWaitMs: 1800,
		/**
		 * The same wait when the destination is a new document: the chat is
		 * further away, behind a page load and the app's start-up.
		 */
		handoverFocalWaitMs: 3000,
		/** Whatever happens, nothing covers the page longer than this. */
		capMs: 4000
	}
} as const;
