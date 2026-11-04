import type { ClosingFocal } from '../transition/closing/closingFocal';

/**
 * The code a new asker needs right after registering, as plain factories so
 * one definition serves both the lazy component and an early warm-up.
 *
 * Registration calls `warmAppChunks` while the person is on the last step:
 * the browser then has these files in its cache when the document load after
 * "Registrieren" asks for them, and the waiting room on the other side of that
 * load is not held up by downloads (#1219).
 *
 * Every waiting room's button does the same for the room behind it
 * (`warmClosingDestination`), so the closing animation (#1737) ends on a
 * screen that is already loaded.
 */
export const loadAuthenticatedApp = () =>
	import('./AuthenticatedApp').then((m) => ({
		default: m.AuthenticatedApp
	}));

export const loadSessionView = () =>
	import('../session/SessionView').then((m) => ({ default: m.SessionView }));

export const loadWriteEnquiry = () =>
	import('../enquiry/WriteEnquiry').then((m) => ({
		default: m.WriteEnquiry
	}));

/** The composer is its own chunk; the chat is not usable without it. */
export const loadMessageComposer = () =>
	import('../messageSubmitInterface/messageSubmitInterfaceComponent').then(
		(m) => ({ default: m.MessageSubmitInterfaceComponent })
	);

export const loadVideoCall = () => import('../videoCall/VideoCall');

export const loadGroupEntryRoom = () =>
	import('../groupChat/entryRoom/GroupEntryRoom').then((m) => ({
		default: m.GroupEntryRoom
	}));

const loadMatrixChunks = () =>
	Promise.all([
		import('../../services/matrixClientService'),
		import('../../services/matrixLiveEventBridge')
	]);

/** A counselling chat: the enquiry, its session and the field to type in. */
const loadChatScreens = () =>
	Promise.all([loadSessionView(), loadWriteEnquiry(), loadMessageComposer()]);

/**
 * The screens behind the waiting room's button: the chat, or the group's entry
 * room for someone who came through a group link.
 */
export const loadEntryScreens = (forGroup = false) =>
	forGroup ? loadGroupEntryRoom() : loadChatScreens();

let warmed = false;

/** Best-effort and once per document; a failure only costs the head start. */
export const warmAppChunks = () => {
	if (warmed) return;
	warmed = true;
	Promise.all([
		loadAuthenticatedApp(),
		loadEntryScreens(),
		loadGroupEntryRoom(),
		loadMatrixChunks()
	]).catch(() => {
		warmed = false;
	});
};

const warmedDestinations = new Set<ClosingFocal>();

/**
 * Fetches the code of the screen a waiting room's button leads to, so the
 * click lands on a screen that is already loaded and the closing animation
 * never holds the person at red for a download. Once per destination and
 * document; best-effort, a failure only costs the head start.
 */
export const warmClosingDestination = (focal: ClosingFocal) => {
	if (warmedDestinations.has(focal)) return;
	warmedDestinations.add(focal);
	const load = focal === 'call' ? loadVideoCall() : loadChatScreens();
	load.catch(() => {
		warmedDestinations.delete(focal);
	});
};

/**
 * Runs `task` when the browser has nothing better to do (a timer where there
 * is no idle callback). Returns what stops it.
 */
export const warmWhenIdle = (task: () => void) => {
	if (typeof window.requestIdleCallback === 'function') {
		const handle = window.requestIdleCallback(task);
		return () => window.cancelIdleCallback(handle);
	}
	const timer = window.setTimeout(task, 1000);
	return () => window.clearTimeout(timer);
};
