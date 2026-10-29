/**
 * The code a new asker needs right after registering, as plain factories so
 * one definition serves both the lazy component and an early warm-up.
 *
 * Registration calls `warmAppChunks` while the person is on the last step:
 * the browser then has these files in its cache when the document load after
 * "Registrieren" asks for them, and the waiting room on the other side of that
 * load is not held up by downloads (#1219).
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

export const loadGroupEntryRoom = () =>
	import('../groupChat/entryRoom/GroupEntryRoom').then((m) => ({
		default: m.GroupEntryRoom
	}));

const loadMatrixChunks = () =>
	Promise.all([
		import('../../services/matrixClientService'),
		import('../../services/matrixLiveEventBridge')
	]);

/**
 * The screens behind the waiting room's button: the enquiry and its session,
 * or the group's entry room for someone who came through a group link.
 */
export const loadEntryScreens = (forGroup = false) =>
	forGroup
		? loadGroupEntryRoom()
		: Promise.all([loadSessionView(), loadWriteEnquiry()]);

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
