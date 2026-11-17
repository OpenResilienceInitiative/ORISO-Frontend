import { useLayoutEffect, useSyncExternalStore } from 'react';

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

const pendingOnLoad =
	typeof window !== 'undefined' ? readPendingLoginHandover() : null;
let active = !!pendingOnLoad;

/**
 * The label the login page showed. The app document may speak the profile's
 * language already; switching words mid-screen read as a second screen.
 */
export const getContinuedLoginHandoverLabel = () =>
	pendingOnLoad?.label?.text || undefined;
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

/**
 * What the screen still waits for once the app is ready: the signed-in
 * tenant's theme (else the white theme modal shows as it fades out) and the
 * first content, e.g. the session list (else it pops in during the fade).
 */
const holds = new Set<string>();
let finishRequested = false;
let finishFrame = 0;
let finishCap = 0;

/** Content is never worth waiting for longer than this after "ready". */
export const LOGIN_HANDOVER_FINISH_MAX_WAIT_MS = 4_000;

const clearFinish = () => {
	finishRequested = false;
	if (typeof window === 'undefined') return;
	window.cancelAnimationFrame(finishFrame);
	window.clearTimeout(finishCap);
	finishFrame = 0;
	finishCap = 0;
};

const endIfFinished = () => {
	if (finishRequested && !finishFrame && holds.size === 0) endLoginHandover();
};

/** The credentials were accepted: cover the login page from now on. */
export const beginLoginHandover = () => {
	clearFinish();
	if (active) return;
	active = true;
	emit();
};

/** Keeps the screen up after "ready" while `holding` (see `holds`). */
export const setLoginHandoverHold = (key: string, holding: boolean) => {
	if (holding) holds.add(key);
	else holds.delete(key);
	endIfFinished();
};

/** Set by `TenantThemingLoader` while the tenant theme loads. */
export const setLoginHandoverWaitingForTheme = (waiting: boolean) =>
	setLoginHandoverHold('theme', waiting);

/**
 * First content (a list) keeps the screen up while it loads. A layout effect,
 * so it is in place before the app's ready effect can finish the screen.
 */
export const useHoldLoginHandover = (key: string, holding: boolean) => {
	useLayoutEffect(() => {
		setLoginHandoverHold(key, holding);
	}, [key, holding]);
	useLayoutEffect(() => () => setLoginHandoverHold(key, false), [key]);
};

/**
 * The app is ready: end the screen once the theme and the first content are
 * there too. It looks two frames later, so content the ready render mounts
 * can still register, and gives up waiting after
 * `LOGIN_HANDOVER_FINISH_MAX_WAIT_MS`. Failure exits call `endLoginHandover`
 * directly and never wait.
 */
export const finishLoginHandover = () => {
	if (!active) {
		endLoginHandover();
		return;
	}
	if (finishRequested) return;
	finishRequested = true;
	finishCap = window.setTimeout(
		endLoginHandover,
		LOGIN_HANDOVER_FINISH_MAX_WAIT_MS
	);
	finishFrame = window.requestAnimationFrame(() => {
		finishFrame = window.requestAnimationFrame(() => {
			finishFrame = 0;
			endIfFinished();
		});
	});
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
	clearFinish();
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
	holds.clear();
	clearFinish();
	active = value;
	emit();
};
