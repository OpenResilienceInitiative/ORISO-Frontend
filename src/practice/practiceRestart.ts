/**
 * Slot for S0's sandbox: "Restart" in the banner resets the practice fixtures
 * through it. The sandbox registers while it is mounted and resets its
 * in-memory fixtures (and any fake service state) in the handler.
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
