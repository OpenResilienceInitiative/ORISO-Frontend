// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	APP_STORAGE_PREFIX,
	clearMatrixSsoHandoffCookies,
	LEGACY_DRAFT_STORAGE_KEY,
	MATRIX_SSO_HANDOFF_COOKIES,
	purgeAppWebStorage,
	purgeLegacyDraftStorage,
	RETAINED_STORAGE_PREFIXES
} from './clientStorageHygiene';

const installStorageMock = (property: 'localStorage' | 'sessionStorage') => {
	const backing = new Map<string, string>();
	const mock = {
		get length() {
			return backing.size;
		},
		key: (index: number) => Array.from(backing.keys())[index] ?? null,
		getItem: (key: string) => backing.get(key) ?? null,
		setItem: (key: string, value: string) =>
			void backing.set(key, String(value)),
		removeItem: (key: string) => void backing.delete(key),
		clear: () => backing.clear()
	};
	Object.defineProperty(window, property, {
		value: mock,
		configurable: true
	});
	Object.defineProperty(globalThis, property, {
		value: mock,
		configurable: true
	});
	return mock;
};

describe('clientStorageHygiene (#1071)', () => {
	beforeEach(() => {
		installStorageMock('localStorage');
		installStorageMock('sessionStorage');
		vi.restoreAllMocks();
	});

	describe('purgeLegacyDraftStorage', () => {
		it('removes the legacy plaintext draft store left by older builds', () => {
			localStorage.setItem(
				LEGACY_DRAFT_STORAGE_KEY,
				JSON.stringify({
					'u:1|scope:2|thread:main': { text: 'secret' }
				})
			);

			purgeLegacyDraftStorage();

			expect(localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)).toBeNull();
		});

		it('leaves unrelated keys untouched and survives unavailable storage', () => {
			localStorage.setItem('oriso.recentEmojis', '["👋"]');

			purgeLegacyDraftStorage();

			expect(localStorage.getItem('oriso.recentEmojis')).toBe('["👋"]');

			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new Error('storage disabled');
				},
				configurable: true
			});

			expect(() => purgeLegacyDraftStorage()).not.toThrow();
		});
	});

	describe('purgeAppWebStorage', () => {
		it('removes every app-scoped localStorage key on sign-out', () => {
			localStorage.setItem(LEGACY_DRAFT_STORAGE_KEY, '{}');
			localStorage.setItem('oriso.recentEmojis', '["👋"]');
			localStorage.setItem('oriso.circleDefaults.v1.9', '{}');
			localStorage.setItem('oriso.keyboardShortcuts.v1', '{}');
			localStorage.setItem('oriso.enquiry.42', '{}');

			purgeAppWebStorage();

			expect(
				Object.keys(localStorage).filter((key) =>
					key.startsWith(APP_STORAGE_PREFIX)
				)
			).toEqual([]);
			expect(localStorage.getItem('oriso.recentEmojis')).toBeNull();
			expect(localStorage.getItem('oriso.enquiry.42')).toBeNull();
		});

		// The silently bootstrapped Tresor key (ADR-019) is the one app key whose
		// loss is unrecoverable: once the Sicherheit panel has not shown it, no
		// later login regenerates it. Dropping it here would trade a shared-PC
		// exposure for permanently unreadable counselling history, so it is
		// retained until #1071 decides how to shorten its life properly.
		it('retains the pending recovery key and its setup lock', () => {
			localStorage.setItem(
				'oriso.pendingRecoveryKey.@ned:oriso',
				'EsTx key'
			);
			localStorage.setItem(
				'oriso.recoverySetupInFlight.@ned:oriso',
				'123'
			);

			purgeAppWebStorage();

			expect(
				localStorage.getItem('oriso.pendingRecoveryKey.@ned:oriso')
			).toBe('EsTx key');
			expect(
				localStorage.getItem('oriso.recoverySetupInFlight.@ned:oriso')
			).toBe('123');
		});

		it('exposes the retained prefixes so the exception stays reviewable', () => {
			expect(RETAINED_STORAGE_PREFIXES).toEqual([
				'oriso.pendingRecoveryKey.',
				'oriso.recoverySetupInFlight.'
			]);
		});

		it('keeps non-app keys that other tooling owns', () => {
			localStorage.setItem('ui-version', 'classic');
			localStorage.setItem('i18nextLng', 'de');

			purgeAppWebStorage();

			expect(localStorage.getItem('ui-version')).toBe('classic');
			expect(localStorage.getItem('i18nextLng')).toBe('de');
		});

		// The registration wizard parks answers (topic, agency, username) in
		// sessionStorage; on a shared PC the next person must not find them.
		it('clears sessionStorage entirely', () => {
			sessionStorage.setItem('registrationSession', '{"username":"ned"}');

			purgeAppWebStorage();

			expect(sessionStorage.getItem('registrationSession')).toBeNull();
		});

		it('never throws when Web Storage is unavailable', () => {
			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new Error('storage disabled');
				},
				configurable: true
			});
			Object.defineProperty(window, 'sessionStorage', {
				get() {
					throw new Error('storage disabled');
				},
				configurable: true
			});

			expect(() => purgeAppWebStorage()).not.toThrow();
		});
	});

	describe('clearMatrixSsoHandoffCookies', () => {
		it('expires all four Matrix handoff cookies', () => {
			const written: string[] = [];
			const cookieSpy = vi
				.spyOn(document, 'cookie', 'set')
				.mockImplementation((value: string) => {
					written.push(value);
				});

			clearMatrixSsoHandoffCookies();

			expect(cookieSpy).toHaveBeenCalledTimes(4);
			MATRIX_SSO_HANDOFF_COOKIES.forEach((name) => {
				expect(
					written.some(
						(entry) =>
							entry.startsWith(`${name}=;`) &&
							entry.includes('expires=Thu, 01 Jan 1970')
					)
				).toBe(true);
			});
		});

		it('covers exactly the cookies the UI-version toggle used to write', () => {
			expect(MATRIX_SSO_HANDOFF_COOKIES).toEqual([
				'matrix_sso_user_id',
				'matrix_sso_access_token',
				'matrix_sso_device_id',
				'matrix_sso_hs_url'
			]);
		});
	});
});
