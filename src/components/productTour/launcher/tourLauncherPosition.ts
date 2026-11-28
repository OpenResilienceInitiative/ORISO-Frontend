import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Where the user dragged the "?" tour launcher, per user in this browser
 * (FE#2545). `null` means the default corner (bottom-right, CSS). The
 * position is anchored to the nearer horizontal and vertical edge, so a
 * button moved to the bottom-left stays there when the window is resized.
 * Storage can be missing or throw (private mode, blocked site data); the
 * move then still applies for this page load.
 */
export type TourLauncherHorizontalEdge = 'left' | 'right';
export type TourLauncherVerticalEdge = 'top' | 'bottom';

export interface TourLauncherPosition {
	h: TourLauncherHorizontalEdge;
	/** Distance in px between the button and the `h` edge. */
	x: number;
	v: TourLauncherVerticalEdge;
	/** Distance in px between the button and the `v` edge. */
	y: number;
}

export interface TourLauncherBox {
	width: number;
	height: number;
}

/** Smallest gap between the button and the viewport edge. */
export const TOUR_LAUNCHER_EDGE_GAP = 8;
/** Movement before a press on the "?" becomes a drag, not a click. */
export const TOUR_LAUNCHER_DRAG_THRESHOLD = 6;
/** One Alt+arrow key press. */
export const TOUR_LAUNCHER_KEYBOARD_STEP = 16;
/** The 40 px app footer (privacy, imprint, version), see FE#2340. */
export const TOUR_LAUNCHER_FOOTER_CLEARANCE = 40;
/** The phone's bottom navigation; the stylesheet adds the safe area. */
export const TOUR_LAUNCHER_BOTTOM_NAV_CLEARANCE = 76;
/** Up to this width the bottom navigation replaces the footer. */
export const TOUR_LAUNCHER_PHONE_MAX_WIDTH = 899;

/**
 * The strip at the bottom of the viewport the button must stay out of: the
 * footer links on desktop, the bottom navigation on the phone. The same
 * numbers as the default corner in `tourLauncher.styles.scss`.
 */
export const tourLauncherBottomReserve = (viewportWidth: number): number =>
	viewportWidth <= TOUR_LAUNCHER_PHONE_MAX_WIDTH
		? TOUR_LAUNCHER_BOTTOM_NAV_CLEARANCE
		: TOUR_LAUNCHER_FOOTER_CLEARANCE;

const clampDistance = (
	distance: number,
	room: number,
	extent: number,
	reserveNear = 0,
	reserveFar = 0
) =>
	Math.round(
		Math.max(
			TOUR_LAUNCHER_EDGE_GAP + reserveNear,
			Math.min(
				distance,
				room - extent - TOUR_LAUNCHER_EDGE_GAP - reserveFar
			)
		)
	);

/**
 * Keeps the whole button inside the viewport and above the footer or the
 * bottom navigation, whichever edge it is anchored to.
 */
export const clampTourLauncherPosition = (
	position: TourLauncherPosition,
	viewport: TourLauncherBox,
	size: TourLauncherBox
): TourLauncherPosition => {
	const reserve = tourLauncherBottomReserve(viewport.width);
	return {
		h: position.h,
		x: clampDistance(position.x, viewport.width, size.width),
		v: position.v,
		y:
			position.v === 'bottom'
				? clampDistance(
						position.y,
						viewport.height,
						size.height,
						reserve
					)
				: clampDistance(
						position.y,
						viewport.height,
						size.height,
						0,
						reserve
					)
	};
};

/** The anchored position for a button whose top-left corner is at left/top. */
export const positionFromBox = (
	left: number,
	top: number,
	viewport: TourLauncherBox,
	size: TourLauncherBox
): TourLauncherPosition => {
	const h = left + size.width / 2 < viewport.width / 2 ? 'left' : 'right';
	const v = top + size.height / 2 < viewport.height / 2 ? 'top' : 'bottom';
	return clampTourLauncherPosition(
		{
			h,
			x: h === 'left' ? left : viewport.width - left - size.width,
			v,
			y: v === 'top' ? top : viewport.height - top - size.height
		},
		viewport,
		size
	);
};

/** One keyboard step from the button's current place on screen. */
export const moveTourLauncherPosition = (
	rect: { left: number; top: number },
	dx: number,
	dy: number,
	viewport: TourLauncherBox,
	size: TourLauncherBox
): TourLauncherPosition =>
	positionFromBox(rect.left + dx, rect.top + dy, viewport, size);

const KEY_PREFIX = 'oriso.tourLauncher.position.';
const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;
const listeners = new Set<() => void>();
/**
 * Fallback for this page load: holds a value only while its last write to
 * storage failed, and then wins over what storage still says.
 */
const memory = new Map<string, string | null>();

const isEdge = <T extends string>(value: unknown, edges: T[]): value is T =>
	// SAFETY: `includes` only compares; a non-member value returns false.
	edges.includes(value as T);

const parse = (raw: string | null): TourLauncherPosition | null => {
	if (!raw) return null;
	try {
		// SAFETY: every field is checked below before the value is used.
		const value = JSON.parse(raw) as Partial<TourLauncherPosition>;
		if (
			isEdge(value?.h, ['left', 'right']) &&
			isEdge(value?.v, ['top', 'bottom']) &&
			Number.isFinite(value.x) &&
			Number.isFinite(value.y)
		) {
			return { h: value.h, x: value.x!, v: value.v, y: value.y! };
		}
	} catch {
		// Junk in storage: the default corner.
	}
	return null;
};

const readRaw = (userId?: string): string | null => {
	if (!userId) return null;
	// A write that failed (quota, blocked site data) left storage stale.
	if (memory.has(userId)) return memory.get(userId) ?? null;
	try {
		return window.localStorage.getItem(keyFor(userId));
	} catch {
		return null;
	}
};

export const readTourLauncherPosition = (
	userId?: string
): TourLauncherPosition | null => parse(readRaw(userId));

/** `null` resets the button to its default corner. */
export const writeTourLauncherPosition = (
	userId: string,
	position: TourLauncherPosition | null
) => {
	const raw = position ? JSON.stringify(position) : null;
	try {
		if (raw) {
			window.localStorage.setItem(keyFor(userId), raw);
		} else {
			window.localStorage.removeItem(keyFor(userId));
		}
		memory.delete(userId);
	} catch {
		// Not persisted; `memory` keeps it for this page load.
		memory.set(userId, raw);
	}
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (!event.key || event.key.startsWith(KEY_PREFIX)) listener();
	};
	window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener('storage', onStorage);
	};
};

/** `[position, setPosition]` for the signed-in user; other tabs stay in sync. */
export const useTourLauncherPosition = (
	userId?: string
): [
	TourLauncherPosition | null,
	(position: TourLauncherPosition | null) => void
] => {
	// The raw string is the snapshot: it is stable between renders, a
	// freshly parsed object would not be.
	const getSnapshot = useCallback(() => readRaw(userId), [userId]);
	const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
	const position = useMemo(() => parse(raw), [raw]);
	const setPosition = useCallback(
		(next: TourLauncherPosition | null) => {
			if (userId) writeTourLauncherPosition(userId, next);
		},
		[userId]
	);
	return [position, setPosition];
};
