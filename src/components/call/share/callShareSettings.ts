/**
 * #1794: sharing a running call by link. Storybook design only — the link,
 * its settings and their lifetime come from the backend later
 * (UserService AgencyInviteLink, see the issue's developer block).
 */

export interface CallShareSettings {
	/** Guests knock and wait until the counsellor lets them in. */
	knock: boolean;
	/** Guests get a temporary account, deleted after the call. */
	temporaryAccount: boolean;
}

/**
 * Frank, 17 + 27 Oct: knocking is on by default, and so is the temporary
 * account for audio and video calls (only the chat direct link of #1795
 * starts with it off).
 */
export const defaultCallShareSettings = (): CallShareSettings => ({
	knock: true,
	temporaryAccount: true
});

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
