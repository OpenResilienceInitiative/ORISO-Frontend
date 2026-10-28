/**
 * Resets the layers mounted on top of the guard for a new run. `practiceMode`
 * runs the handlers whenever a new run starts on a running guard (a restart,
 * which the tour host does as end + enter); the sandbox slot registers the
 * sandbox's own restart (fresh fixtures, fresh fake services).
 */
type RestartHandler = () => void;

const handlers = new Set<RestartHandler>();

/** Returns the function that removes this handler again. */
export const registerPracticeRestartHandler = (
	handler: RestartHandler
): (() => void) => {
	handlers.add(handler);
	return () => {
		handlers.delete(handler);
	};
};

export const runPracticeRestartHandlers = (): void => {
	[...handlers].forEach((handler) => {
		try {
			handler();
		} catch {
			// A broken handler must not keep the others or the restart from running.
		}
	});
};
