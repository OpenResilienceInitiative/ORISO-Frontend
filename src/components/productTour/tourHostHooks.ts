/**
 * Host-side hooks per tour id. They stay out of the tour definition, which
 * is shared data with ORISO-Admin and carries no functions. A feature owner
 * (e.g. the practice area) registers its hooks while it is mounted; the
 * Walkthrough host hands them to the adapter as `onBeforeStart` / `onEnd`.
 */
export interface TourHostHooks {
	/**
	 * Runs before the first step is prepared (e.g. enter practice mode). The
	 * tour starts once it resolves and never starts if it rejects.
	 */
	setup?: () => void | Promise<void>;
	/**
	 * Runs once when the tour is over: after its terminal status was written,
	 * when it stops without one, or when it unmounts. Must be safe to call
	 * after a failed or partial setup.
	 */
	teardown?: () => void;
}

const registry = new Map<string, TourHostHooks>();

/** Returns the function that removes this registration again. */
export const registerTourHostHooks = (
	tourId: string,
	hooks: TourHostHooks
): (() => void) => {
	registry.set(tourId, hooks);
	return () => {
		// A later registration for the same tour must survive this cleanup.
		if (registry.get(tourId) === hooks) {
			registry.delete(tourId);
		}
	};
};

export const getTourHostHooks = (tourId: string): TourHostHooks | undefined =>
	registry.get(tourId);
