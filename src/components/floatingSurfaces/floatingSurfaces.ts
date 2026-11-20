import { useEffect, useSyncExternalStore } from 'react';

/**
 * One registry for everything that floats in the bottom-right corner: the
 * chat channel switcher, the call surfaces and the tour launcher. Frank's
 * rule (2026-11-18): floating buttons never lie on top of each other. A
 * surface registers while it is on screen; a lower-priority surface (the
 * tour launcher) asks whether anyone else is there and steps aside.
 */
export type FloatingSurfaceId =
	| 'channel-switcher'
	| 'call-dock'
	| 'call-incoming'
	| 'call-widget'
	| 'tour-launcher';

const active = new Map<FloatingSurfaceId, number>();
const listeners = new Set<() => void>();
let snapshot: FloatingSurfaceId[] = [];

const publish = () => {
	snapshot = [...active.keys()].sort();
	listeners.forEach((listener) => listener());
};

/** Adds one holder of `id`; the returned function removes exactly that one. */
export const registerFloatingSurface = (id: FloatingSurfaceId) => {
	active.set(id, (active.get(id) ?? 0) + 1);
	publish();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const count = (active.get(id) ?? 1) - 1;
		if (count > 0) {
			active.set(id, count);
		} else {
			active.delete(id);
		}
		publish();
	};
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

const getSnapshot = () => snapshot;

/** The surfaces currently on screen, sorted. */
export const useFloatingSurfaces = (): FloatingSurfaceId[] =>
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Keeps `id` registered while `isShown` is true and the caller is mounted. */
export const useRegisterFloatingSurface = (
	id: FloatingSurfaceId,
	isShown = true
) => {
	useEffect(() => {
		if (!isShown) return undefined;
		return registerFloatingSurface(id);
	}, [id, isShown]);
};

/** Test helper: forget every registration. */
export const resetFloatingSurfaces = () => {
	active.clear();
	publish();
};
