// @vitest-environment oriso-jsdom
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { apiKeycloakLogout } from '../../api/apiLogoutKeycloak';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import type { MatrixClientService } from '../../services/matrixClientService';
import type { TEventHandler } from '../../utils/eventHandler';
import {
	getValueFromCookie,
	removeAllCookies,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import { APP_SESSION_ENDED_KEY } from '../sessionCookie/observeAppSession';

const practice = vi.hoisted(() => ({ active: false, end: vi.fn() }));
vi.mock('../../practice/practiceMode', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../practice/practiceMode')>()),
	isPracticeMode: () => practice.active,
	endPractice: practice.end
}));

vi.mock('../../api/apiLogoutKeycloak', () => ({
	apiKeycloakLogout: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiSetLiveChatAvailability: vi.fn().mockResolvedValue(undefined)
}));

const setSession = (sid: string) => {
	const claims = btoa(
		JSON.stringify({ sid, iss: 'https://identity.example.test' })
	);
	const token = `header.${claims}.signature`;
	setValueInCookie('keycloak', token);
	setValueInCookie('refreshToken', token);
	return token;
};

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	practice.active = false;
	practice.end.mockReset();
	localStorage.clear();
	sessionStorage.clear();
	removeAllCookies();
});

it.each([false, true])(
	'protects a later session while a draft is pending, peer event delivered=%s',
	async (deliverPeerEvent) => {
		const {
			EVENT_PRE_LOGOUT,
			logout,
			teardownLocalSession,
			teardownPeerLocalSession
		} = await import('./logout');
		const { addEventListener, removeEventListener } = await import(
			'../../utils/eventHandler'
		);
		const { getMatrixClientService, setMatrixClientServiceRef } =
			await import('../../services/matrixClientRegistry');
		const matrix = { stopAndCleanup: vi.fn(), logout: vi.fn() };
		setMatrixClientServiceRef(matrix as unknown as MatrixClientService);
		setSession('old-app-session');

		let finishDraft!: (cancel: boolean) => void;
		const draftFlush = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finishDraft = resolve;
				})
		);
		addEventListener(EVENT_PRE_LOGOUT, draftFlush as TEventHandler);
		const onLocalSessionEnded = vi.fn();
		const pendingLogout = logout(false, undefined, onLocalSessionEnded);
		expect(draftFlush).toHaveBeenCalledTimes(1);

		const newToken = setSession('newer-app-session');
		localStorage.setItem('matrix_access_token', 'newer-device');
		localStorage.setItem(
			'oriso-admin.auth.refresh_token_valid_until',
			'12345'
		);
		sessionStorage.setItem('oriso-admin:chunk-reloaded', '1');
		if (deliverPeerEvent) {
			teardownPeerLocalSession();
			teardownPeerLocalSession();
			teardownLocalSession();
		}
		finishDraft(false);
		await pendingLogout;
		removeEventListener(EVENT_PRE_LOGOUT, draftFlush as TEventHandler);
		expect(onLocalSessionEnded).not.toHaveBeenCalled();

		expect(matrix.stopAndCleanup).toHaveBeenCalledTimes(
			deliverPeerEvent ? 1 : 0
		);
		expect(matrix.logout).not.toHaveBeenCalled();
		expect(getMatrixClientService()).toBe(deliverPeerEvent ? null : matrix);
		expect(apiKeycloakLogout).not.toHaveBeenCalled();
		expect(apiSetLiveChatAvailability).not.toHaveBeenCalled();
		expect(getValueFromCookie('keycloak')).toBe(newToken);
		expect(getValueFromCookie('refreshToken')).toBe(newToken);
		expect(localStorage.getItem('matrix_access_token')).toBe(
			'newer-device'
		);
		expect(
			localStorage.getItem('oriso-admin.auth.refresh_token_valid_until')
		).toBe('12345');
		expect(localStorage.getItem(APP_SESSION_ENDED_KEY)).toBeNull();
		expect(sessionStorage.getItem('oriso-admin:chunk-reloaded')).toBe('1');
	}
);

it('skips old-session draft and logout after a later sign-in during practice exit', async () => {
	const { EVENT_PRE_LOGOUT, logout } = await import('./logout');
	const { addEventListener, removeEventListener } = await import(
		'../../utils/eventHandler'
	);
	const draftFlush = vi.fn().mockResolvedValue(false);
	addEventListener(EVENT_PRE_LOGOUT, draftFlush as TEventHandler);
	setSession('first-session');
	practice.active = true;
	let finishPractice!: () => void;
	practice.end.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishPractice = resolve;
			})
	);

	const pendingLogout = logout(false);
	expect(practice.end).toHaveBeenCalledTimes(1);
	const newToken = setSession('newer-session');
	finishPractice();
	await pendingLogout;
	removeEventListener(EVENT_PRE_LOGOUT, draftFlush as TEventHandler);

	expect(draftFlush).not.toHaveBeenCalled();
	expect(apiKeycloakLogout).not.toHaveBeenCalled();
	expect(getValueFromCookie('keycloak')).toBe(newToken);
	expect(localStorage.getItem(APP_SESSION_ENDED_KEY)).toBeNull();
});

it('publishes the old session only when initiating logout has passed draft cancellation and cleared auth', async () => {
	const { EVENT_PRE_LOGOUT, logout } = await import('./logout');
	const { addEventListener, removeEventListener } = await import(
		'../../utils/eventHandler'
	);
	const token = setSession('ordinary-app-session');
	const cancel = (() => Promise.resolve(true)) as TEventHandler;
	addEventListener(EVENT_PRE_LOGOUT, cancel);
	const onLocalSessionEnded = vi.fn(() => {
		expect(getValueFromCookie('keycloak')).toBeFalsy();
		expect(localStorage.getItem(APP_SESSION_ENDED_KEY)).toContain(
			'ordinary-app-session'
		);
	});

	await logout(false, undefined, onLocalSessionEnded);
	expect(onLocalSessionEnded).not.toHaveBeenCalled();
	expect(localStorage.getItem(APP_SESSION_ENDED_KEY)).toBeNull();
	expect(getValueFromCookie('keycloak')).toBe(token);
	expect(apiKeycloakLogout).not.toHaveBeenCalled();

	removeEventListener(EVENT_PRE_LOGOUT, cancel);
	await logout(false, undefined, onLocalSessionEnded);
	expect(onLocalSessionEnded).toHaveBeenCalledOnce();

	expect(localStorage.getItem(APP_SESSION_ENDED_KEY)).toContain(
		'ordinary-app-session'
	);
	expect(getValueFromCookie('keycloak')).toBe('');
	expect(apiKeycloakLogout).toHaveBeenCalledTimes(1);
});
