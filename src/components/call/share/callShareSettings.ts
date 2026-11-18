/**
 * #1794: sharing a running call by link (UserService#1487): knocking and
 * the guest account mode (UserService#1662).
 */

import {
	defaultGuestAccountMode,
	GuestAccountMode
} from '../../guestAccountMode/guestAccountMode';

export interface CallShareSettings {
	/** Guests knock and wait until the counsellor lets them in. */
	knock: boolean;
	/** UserService#1662: which account a new guest gets. */
	guestAccountMode: GuestAccountMode;
}

/**
 * Frank, 17 + 27 Oct: knocking is on by default. The account follows the
 * server's default for calls (UserService#1662): the guest chooses, which
 * keeps the temporary account of the old default on offer.
 */
export const defaultCallShareSettings = (): CallShareSettings => ({
	knock: true,
	guestAccountMode: defaultGuestAccountMode('VIDEO')
});

/** The server's fallback order when a mode is not allowed (UserService#1662). */
const FALLBACK_ORDER: GuestAccountMode[] = [
	'PERMANENT',
	'GUEST_CHOOSES',
	'TEMPORARY'
];

export type WebShare = (data: ShareData) => Promise<void>;

/**
 * The phone's own share menu, when the browser has one. `null` hides the
 * Share button — a button that does nothing is worse than none.
 */
export const detectWebShare = (
	nav: Partial<Pick<Navigator, 'share'>> | undefined = typeof navigator ===
	'undefined'
		? undefined
		: navigator
): WebShare | null => {
	const share = nav?.share;
	return typeof share === 'function'
		? (data: ShareData) => share.call(nav, data)
		: null;
};

/**
 * Not allowed means not offered: a mode the platform or the Träger does not
 * allow falls back like the server does, also when the policy changes while
 * the share surface is open. Without a list nothing is changed.
 */
export const effectiveCallShareSettings = (
	settings: CallShareSettings,
	allowed: readonly GuestAccountMode[] | null | undefined
): CallShareSettings => {
	if (!allowed || allowed.includes(settings.guestAccountMode)) {
		return settings;
	}
	const fallback = FALLBACK_ORDER.find((mode) => allowed.includes(mode));
	return fallback ? { ...settings, guestAccountMode: fallback } : settings;
};

/**
 * Plain-text copy that rejects when nothing reached the clipboard, so the
 * panel never says "Kopiert" for a link that was not copied. The shared
 * `copyTextToClipboard` ignores a failed `execCommand`.
 */
export const copyLinkToClipboard = async (
	text: string,
	nav:
		| { clipboard?: Pick<Clipboard, 'writeText'> }
		| undefined = typeof navigator === 'undefined' ? undefined : navigator,
	exec: (command: string) => boolean = (command) =>
		document.execCommand(command)
): Promise<void> => {
	if (nav?.clipboard?.writeText) {
		await nav.clipboard.writeText(text);
		return;
	}
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'absolute';
	textarea.style.left = '-10000em';
	document.body.appendChild(textarea);
	textarea.select();
	try {
		if (!exec('copy')) {
			throw new Error('copy command failed');
		}
	} finally {
		document.body.removeChild(textarea);
	}
};
