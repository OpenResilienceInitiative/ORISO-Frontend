/**
 * Shared-PC storage hygiene (#1071, KDG/DSFA client-storage findings).
 *
 * ORISO counselling agencies run several counsellors — and in walk-in
 * settings, advice seekers — through the same browser profile. Whatever the
 * app leaves in Web Storage after sign-out is readable by the next person at
 * that machine, so app-scoped keys have to be swept on logout, and residues
 * from older builds have to be removed once on startup.
 */

/** Namespace every key this app owns is written under. */
export const APP_STORAGE_PREFIX = 'oriso.';

/**
 * Legacy plaintext draft store. The writer (`saveDraftEntry`) is gone — drafts
 * live server-side and are room-key encrypted (`useDraftMessage`) — but
 * devices that ran an older build still carry the key, with counselling text
 * in the clear.
 */
export const LEGACY_DRAFT_STORAGE_KEY = 'oriso.chatDrafts.v1';

/**
 * App keys that must survive sign-out.
 *
 * The silently bootstrapped Tresor key (ADR-019, #839) is parked here until
 * the Sicherheit panel has shown it. Dropping it on logout is unrecoverable:
 * the next login finds an existing Tresor, so `canBootstrapSilently` never
 * regenerates a key, and the user ends up with a key backup they can never
 * restore from. Shortening its life needs a real fix (show-before-logout, or
 * move it out of Web Storage) — tracked as an open decision on #1071 — not a
 * blind wipe here.
 */
export const RETAINED_STORAGE_PREFIXES = [
	'oriso.pendingRecoveryKey.',
	'oriso.recoverySetupInFlight.'
] as const;

/**
 * Handoff cookies the UI-version toggle used to write for the Element UI.
 * Nothing reads them any more (the consuming `element-sso-bridge.html` is
 * gone, and since #201 dropped the `domain=` attribute they are host-scoped,
 * so the Element origin could never see them). The writes are removed; these
 * names stay so leftovers on long-lived profiles get expired on logout.
 */
export const MATRIX_SSO_HANDOFF_COOKIES = [
	'matrix_sso_user_id',
	'matrix_sso_access_token',
	'matrix_sso_device_id',
	'matrix_sso_hs_url'
] as const;

const withStorage = (
	read: () => Storage,
	run: (storage: Storage) => void
): void => {
	try {
		const storage = read();
		if (!storage) {
			return;
		}
		run(storage);
	} catch {
		// Private mode, disabled storage, or a sandboxed iframe: there is
		// nothing to clean up and sign-out must never fail over it.
	}
};

const isRetained = (key: string): boolean =>
	RETAINED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * One-time startup cleanup for the legacy plaintext draft store (#1071 task 1).
 * Idempotent, so it can run on every load without a "did I already?" flag.
 */
export const purgeLegacyDraftStorage = (): void =>
	withStorage(
		() => window.localStorage,
		(storage) => storage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
	);

/**
 * Sweeps app-scoped Web Storage on sign-out (#1071 task 3).
 *
 * `localStorage` is filtered by prefix so keys other tooling owns (i18next's
 * language, the UI-version preference) keep working for the next session.
 * `sessionStorage` is cleared outright: its only app content is the
 * registration wizard's answers, which are per-visit by definition.
 */
export const purgeAppWebStorage = (): void => {
	withStorage(
		() => window.localStorage,
		(storage) => {
			const doomed: string[] = [];
			for (let index = 0; index < storage.length; index++) {
				const key = storage.key(index);
				if (key?.startsWith(APP_STORAGE_PREFIX) && !isRetained(key)) {
					doomed.push(key);
				}
			}
			doomed.forEach((key) => storage.removeItem(key));
		}
	);

	withStorage(
		() => window.sessionStorage,
		(storage) => storage.clear()
	);
};

/** Expires any leftover Matrix SSO handoff cookies (#1071 task 6, #196). */
export const clearMatrixSsoHandoffCookies = (): void => {
	MATRIX_SSO_HANDOFF_COOKIES.forEach((name) => {
		document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
	});
};
