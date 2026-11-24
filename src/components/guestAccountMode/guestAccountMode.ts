/**
 * UserService#1662: which account a person without one gets through an
 * invitation link — a direct link, a call share link or a Gesprächskreis
 * invite. Set by the counsellor per link; the platform and the Träger may
 * allow fewer modes.
 *
 * - `TEMPORARY`: only a temporary account, deleted after the conversation.
 * - `GUEST_CHOOSES`: the guest picks at entry ("Ohne Konto beitreten" or
 *   "Konto anlegen") and may keep a temporary account later.
 * - `PERMANENT`: only a permanent account.
 */
export type GuestAccountMode = 'TEMPORARY' | 'GUEST_CHOOSES' | 'PERMANENT';

/** The order of the select's options. */
export const GUEST_ACCOUNT_MODES: GuestAccountMode[] = [
	'TEMPORARY',
	'GUEST_CHOOSES',
	'PERMANENT'
];

export const isGuestAccountMode = (value: unknown): value is GuestAccountMode =>
	GUEST_ACCOUNT_MODES.includes(value as GuestAccountMode);

/**
 * The backend's default without a choice: PERMANENT for chat, GUEST_CHOOSES
 * for calls (the old default had the temporary switch on for calls only).
 */
export const defaultGuestAccountMode = (
	medium: 'CHAT' | 'AUDIO' | 'VIDEO'
): GuestAccountMode => (medium === 'CHAT' ? 'PERMANENT' : 'GUEST_CHOOSES');

/**
 * The mode a server answer carries. An older server only has the boolean;
 * like the backend's migration, "temporary on" reads as GUEST_CHOOSES.
 */
export const readGuestAccountMode = (
	value: unknown,
	legacyTemporary: boolean | null | undefined
): GuestAccountMode =>
	isGuestAccountMode(value)
		? value
		: legacyTemporary
			? 'GUEST_CHOOSES'
			: 'PERMANENT';

/** The old `temporary` mirror: every mode but PERMANENT can create one. */
export const offersTemporaryAccount = (mode: GuestAccountMode) =>
	mode !== 'PERMANENT';

/**
 * The select's options: the modes the server allows now, in select order.
 * Without a list (the direct-link API has none) all three are offered and
 * the server refuses a mode it does not allow with 403.
 */
export const offeredGuestAccountModes = (
	allowed: readonly GuestAccountMode[] | null | undefined
): GuestAccountMode[] =>
	allowed
		? GUEST_ACCOUNT_MODES.filter((mode) => allowed.includes(mode))
		: GUEST_ACCOUNT_MODES;

/** i18n key of a mode's short label ("Nach der Sitzung löschen" …). */
export const guestAccountModeLabelKey = (mode: GuestAccountMode) =>
	`guestAccountMode.option.${mode}`;

/** i18n key of the sentence under the select. */
export const guestAccountModeHintKey = (mode: GuestAccountMode) =>
	`guestAccountMode.hint.${mode}`;

/** The part of the public invite context the entry reads. */
export interface GuestAccountEntryContext {
	guestAccountMode?: GuestAccountMode | string | null;
	/** #2252 mirror of the mode: GUESTS_ONLY / BOTH / ACCOUNTS_ONLY. */
	accessMode?: string | null;
	temporaryAccount?: boolean | null;
}

const ACCESS_MODES: Record<string, GuestAccountMode> = {
	GUESTS_ONLY: 'TEMPORARY',
	BOTH: 'GUEST_CHOOSES',
	ACCOUNTS_ONLY: 'PERMANENT'
};

/**
 * What the entry page offers a person without an account. A server from
 * before #1662 sends no mode: its accessMode, else its temporary flag,
 * decides — which keeps that entry as it was.
 */
export const entryGuestAccountMode = (
	context: GuestAccountEntryContext
): GuestAccountMode => {
	if (isGuestAccountMode(context.guestAccountMode)) {
		return context.guestAccountMode;
	}
	const fromAccess = context.accessMode && ACCESS_MODES[context.accessMode];
	if (fromAccess) return fromAccess;
	return context.temporaryAccount ? 'TEMPORARY' : 'PERMANENT';
};

/**
 * The context as the registration sees it once the guest has chosen: the
 * account kind is fixed by TEMPORARY and PERMANENT, and follows the guest's
 * choice under GUEST_CHOOSES. Postcode, password field and the registration's
 * `temporary` flag all read `temporaryAccount` from it.
 */
export const withChosenAccount = <T extends GuestAccountEntryContext>(
	context: T,
	temporaryChosen: boolean
): T => {
	const mode = entryGuestAccountMode(context);
	return {
		...context,
		temporaryAccount:
			mode === 'GUEST_CHOOSES' ? temporaryChosen : mode === 'TEMPORARY'
	};
};
