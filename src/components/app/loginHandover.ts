import { useSyncExternalStore } from 'react';

/**
 * The login handover (#2272): one calm loading screen from the moment Keycloak accepts
 * the credentials until the authenticated app is ready.
 *
 * Without it a sign-in flickered: the tenant switch put a white modal over the
 * red login page, the login page came back while the Matrix token and the user
 * data loaded, the document load to /app showed a blank page, and the app then
 * booted behind yet another spinner.
 *
 * The screen lives on both sides of that document load (#1402 keeps it a real
 * load). The login page marks the handover in sessionStorage right before it
 * leaves; `app.html` reads the mark before any script loads and paints the
 * same background, and this store starts out active on the new document, so
 * `LoginHandoverGate` shows the screen again on the first React frame. The app
 * ends it once it is ready, or when it gives up and goes back to the login.
 */

export const LOGIN_HANDOVER_STORAGE_KEY = 'oriso.loginHandover';
/** The class `app.html` sets on <html> while a handover is pending. */
export const LOGIN_HANDOVER_HTML_CLASS = 'oriso-login-handover';
/** A mark older than this is stale (closed tab, failed load) and is ignored. */
export const LOGIN_HANDOVER_MAX_AGE_MS = 30_000;

/** The still `app.html` paints during the document load. */
export const LOGIN_HANDOVER_SPLASH_ID = 'loginHandoverSplash';

interface StoredHandover {
	at: number;
	background?: string;
	animation?: { src: string; rect: SnapshotRect };
	label?: { text: string; rect: SnapshotRect; font: string; color: string };
}

const getStorage = (): Storage | null => {
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
};

export const readPendingLoginHandover = (
	storage: Pick<Storage, 'getItem'> | null = getStorage(),
	now: number = Date.now()
): StoredHandover | null => {
	try {
		const raw = storage?.getItem(LOGIN_HANDOVER_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredHandover;
		if (typeof parsed?.at !== 'number') return null;
		const age = now - parsed.at;
		return age >= 0 && age < LOGIN_HANDOVER_MAX_AGE_MS ? parsed : null;
	} catch {
		return null;
	}
};

let active = typeof window !== 'undefined' && !!readPendingLoginHandover();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const isLoginHandoverActive = () => active;

export const useLoginHandoverActive = () =>
	useSyncExternalStore(subscribe, isLoginHandoverActive, () => false);

// The signed-in tenant's theme is still loading: the app may be ready before
// it, and ending the screen then would reveal the white theme modal.
let waitingForTheme = false;
let finishRequested = false;

/** The credentials were accepted: cover the login page from now on. */
export const beginLoginHandover = () => {
	finishRequested = false;
	if (active) return;
	active = true;
	emit();
};

/** Set by `TenantThemingLoader` while the tenant theme loads. */
export const setLoginHandoverWaitingForTheme = (waiting: boolean) => {
	waitingForTheme = waiting;
	if (!waiting && finishRequested) endLoginHandover();
};

/**
 * The app is ready: end the screen, once the tenant theme is loaded too.
 * Failure exits call `endLoginHandover` directly and never wait.
 */
export const finishLoginHandover = () => {
	if (waitingForTheme && active) {
		finishRequested = true;
		return;
	}
	endLoginHandover();
};

interface SnapshotRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

const rectOf = (element: Element): SnapshotRect => {
	const r = element.getBoundingClientRect();
	return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const isPainted = (colour: string | undefined) =>
	!!colour && colour !== 'transparent' && colour !== 'rgba(0, 0, 0, 0)';

/**
 * What the screen looks like right now: its background, a still of the
 * loading animation and the label, each with its position. `app.html` paints
 * exactly this until React's screen is back, so the document load shows no
 * gap -- not even the animation disappearing for a moment.
 */
const snapshotHandoverScreen = (): Omit<StoredHandover, 'at'> => {
	const snapshot: Omit<StoredHandover, 'at'> = {};
	try {
		const screen = document.querySelector('.loginHandoverScreen');
		const colour = getComputedStyle(
			screen ?? document.body
		).backgroundColor;
		if (isPainted(colour)) snapshot.background = colour;
		const canvas = screen?.querySelector('canvas');
		if (canvas instanceof HTMLCanvasElement && canvas.width > 0) {
			snapshot.animation = {
				src: canvas.toDataURL('image/png'),
				rect: rectOf(canvas)
			};
		}
		const label = screen?.querySelector('.loading__label');
		if (label instanceof HTMLElement && label.textContent) {
			const style = getComputedStyle(label);
			snapshot.label = {
				text: label.textContent,
				rect: rectOf(label),
				font: style.font,
				color: style.color
			};
		}
	} catch {
		// A partial snapshot still paints the background.
	}
	return snapshot;
};

/**
 * Right before the document load to the app: lets the next document continue
 * the screen (see `app.html`).
 */
export const persistLoginHandover = () => {
	const storage = getStorage();
	const at = Date.now();
	const snapshot = snapshotHandoverScreen();
	try {
		storage?.setItem(
			LOGIN_HANDOVER_STORAGE_KEY,
			JSON.stringify({ at, ...snapshot })
		);
	} catch {
		try {
			// Over quota: the background alone still avoids the white page.
			storage?.setItem(
				LOGIN_HANDOVER_STORAGE_KEY,
				JSON.stringify({ at, background: snapshot.background })
			);
		} catch {
			// Without storage the next document simply boots without it.
		}
	}
};

/** Removes the still that `app.html` painted, once React's screen is up. */
export const removeLoginHandoverSplash = () => {
	if (typeof document === 'undefined') return;
	document.getElementById(LOGIN_HANDOVER_SPLASH_ID)?.remove();
};

/** The sign-in failed or gave up: show what is underneath now. */
export const endLoginHandover = () => {
	finishRequested = false;
	try {
		getStorage()?.removeItem(LOGIN_HANDOVER_STORAGE_KEY);
	} catch {
		// nothing to clean up
	}
	if (typeof document !== 'undefined') {
		const html = document.documentElement;
		html.classList.remove(LOGIN_HANDOVER_HTML_CLASS);
		html.style.background = '';
	}
	removeLoginHandoverSplash();
	if (!active) return;
	active = false;
	emit();
};

/** Test-only: reset the module state between cases. */
export const resetLoginHandoverForTests = (value = false) => {
	waitingForTheme = false;
	finishRequested = false;
	active = value;
	emit();
};
