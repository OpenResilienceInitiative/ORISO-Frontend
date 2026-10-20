/**
 * Named-event bus for `advanceOn: { type: 'event', name }` steps. Feature code
 * (e.g. the practice area) emits when something the tour waits for happened;
 * the adapter listens only while that step is shown. Events are not buffered,
 * so one emitted before the step is shown does nothing.
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

/** Returns the function that removes this listener again. */
export const subscribeToTourEvent = (
	name: string,
	listener: Listener
): (() => void) => {
	const forName = listeners.get(name) ?? new Set<Listener>();
	forName.add(listener);
	listeners.set(name, forName);
	return () => {
		forName.delete(listener);
		if (!forName.size && listeners.get(name) === forName) {
			listeners.delete(name);
		}
	};
};

export const emitTourEvent = (name: string): void => {
	// A copy, so listeners may unsubscribe while the event is delivered.
	[...(listeners.get(name) ?? [])].forEach((listener) => {
		try {
			listener();
		} catch {
			// A failing listener must not break the emitter or the others.
		}
	});
};
