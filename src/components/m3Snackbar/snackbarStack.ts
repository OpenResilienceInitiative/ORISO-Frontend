import { ReactNode, useSyncExternalStore } from 'react';

export interface SnackbarStackRenderApi {
	/** Removes this snackbar from the stack. */
	dismiss: () => void;
}

export interface SnackbarStackEntryInput {
	/**
	 * Stable id. Pass one when the same thing may be queued twice (a join
	 * request seen on two polls) — enqueueing an id that is already there
	 * replaces it in place instead of stacking a duplicate.
	 */
	id?: string;
	/** What a screen reader hears when it arrives. Already translated. */
	announcement: string;
	/**
	 * `null` (default) keeps it until it is dismissed. A number lets it go
	 * after that many ms — paused while the pointer or focus is on the stack.
	 */
	autoHideDuration?: number | null;
	/**
	 * Whether Escape may close it. A snackbar that waits for a decision (a
	 * join request) sets `false`: Escape must never decide for somebody.
	 */
	dismissible?: boolean;
	/** The surface: an inline `M3Snackbar`, a `JoinRequestSnackbar`, … */
	render: (api: SnackbarStackRenderApi) => ReactNode;
}

export interface SnackbarStackEntry extends SnackbarStackEntryInput {
	id: string;
	autoHideDuration: number | null;
	dismissible: boolean;
}

export interface SnackbarStack {
	/** Queues a snackbar and returns its id. */
	enqueue: (entry: SnackbarStackEntryInput) => string;
	dismiss: (id: string) => void;
	clear: () => void;
	subscribe: (listener: () => void) => () => void;
	/** Oldest first. The same array until something changes. */
	getSnapshot: () => readonly SnackbarStackEntry[];
}

/**
 * The queue behind `M3SnackbarHost`. A plain store rather than a React
 * context, so code outside the component tree (a poller, a Matrix listener)
 * can queue a snackbar the same way a button can.
 */
export const createSnackbarStack = (): SnackbarStack => {
	let entries: readonly SnackbarStackEntry[] = [];
	let nextId = 0;
	const listeners = new Set<() => void>();
	const publish = (next: readonly SnackbarStackEntry[]) => {
		entries = next;
		listeners.forEach((listener) => listener());
	};

	return {
		enqueue: (input) => {
			const id = input.id ?? `snackbar-${++nextId}`;
			const entry: SnackbarStackEntry = {
				...input,
				id,
				autoHideDuration: input.autoHideDuration ?? null,
				dismissible: input.dismissible ?? true
			};
			const existing = entries.findIndex((item) => item.id === id);
			publish(
				existing === -1
					? [...entries, entry]
					: entries.map((item, index) =>
							index === existing ? entry : item
						)
			);
			return id;
		},
		dismiss: (id) => {
			if (entries.some((item) => item.id === id)) {
				publish(entries.filter((item) => item.id !== id));
			}
		},
		clear: () => {
			if (entries.length) publish([]);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot: () => entries
	};
};

/** The one stack the app mounts (`M3SnackbarHost` in `AuthenticatedApp`). */
export const appSnackbarStack = createSnackbarStack();

export const useSnackbarStackEntries = (stack: SnackbarStack) =>
	useSyncExternalStore(stack.subscribe, stack.getSnapshot, stack.getSnapshot);
