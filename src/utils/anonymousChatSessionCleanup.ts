import { apiFinishAnonymousConversation } from '../api/apiFinishAnonymousConversation';
import { FETCH_ERRORS } from '../api/fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import {
	getValueFromCookie,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import { generateCsrfToken } from './generateCsrfToken';
import { addEventListener, removeEventListener } from './eventHandler';
import { EVENT_PRE_LOGOUT } from '../components/logout/logout';
import {
	STATUS_ACTIVE,
	STATUS_EMPTY,
	STATUS_ENQUIRY,
	STATUS_FINISHED
} from '../globalState/interfaces/SessionsDataInterface';

let pendingSessionId: number | null = null;
let preLogoutListenerRegistered = false;

const isOpenAnonymousSessionStatus = (status: unknown): boolean => {
	const statusNum = Number(status);
	if (Number.isNaN(statusNum)) {
		return false;
	}
	return (
		statusNum === STATUS_EMPTY ||
		statusNum === STATUS_ENQUIRY ||
		statusNum === STATUS_ACTIVE
	);
};

export const registerAnonymousChatSessionForCleanup = (
	sessionId: number | null | undefined,
	sessionStatus?: unknown
): void => {
	if (
		sessionId == null ||
		(sessionStatus != null && !isOpenAnonymousSessionStatus(sessionStatus))
	) {
		pendingSessionId = null;
		return;
	}
	pendingSessionId = sessionId;
};

export const finishAnonymousChatSessionKeepalive = (
	sessionId: number
): void => {
	const accessToken = getValueFromCookie('keycloak');
	if (!accessToken) {
		return;
	}

	const csrfToken = getValueFromCookie('CSRF-TOKEN') || generateCsrfToken();
	if (!getValueFromCookie('CSRF-TOKEN')) {
		setValueInCookie('CSRF-TOKEN', csrfToken);
	}

	void fetch(endpoints.finishAnonymousConversation(sessionId), {
		method: 'PUT',
		keepalive: true,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${accessToken}`,
			'X-CSRF-TOKEN': csrfToken
		}
	}).catch(() => {
		/* best-effort on tab close */
	});
};

export const finishPendingAnonymousChatSession = async (): Promise<void> => {
	if (pendingSessionId == null) {
		return;
	}

	const sessionId = pendingSessionId;
	pendingSessionId = null;

	try {
		await apiFinishAnonymousConversation(sessionId);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : String(error ?? '');
		if (message !== FETCH_ERRORS.CONFLICT) {
			/* ignore — logout should still proceed */
		}
	}
};

const onPreLogout = async <T>(args?: T): Promise<T | undefined> => {
	await finishPendingAnonymousChatSession();
	return args;
};

export const ensureAnonymousChatPreLogoutCleanup = (): void => {
	if (preLogoutListenerRegistered) {
		return;
	}
	addEventListener(EVENT_PRE_LOGOUT, onPreLogout);
	preLogoutListenerRegistered = true;
};

export const teardownAnonymousChatPreLogoutCleanup = (): void => {
	if (!preLogoutListenerRegistered) {
		return;
	}
	removeEventListener(EVENT_PRE_LOGOUT, onPreLogout);
	preLogoutListenerRegistered = false;
};

export const bindAnonymousChatUnloadCleanup = (
	sessionId: number | null | undefined
): (() => void) => {
	const onPageHide = () => {
		if (sessionId != null) {
			finishAnonymousChatSessionKeepalive(sessionId);
		}
	};

	window.addEventListener('pagehide', onPageHide);
	return () => window.removeEventListener('pagehide', onPageHide);
};

export { STATUS_FINISHED, isOpenAnonymousSessionStatus };
