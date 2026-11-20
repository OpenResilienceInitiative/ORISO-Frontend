/**
 * #1869 / ORISO-Admin#1241. The platform decides once for every temporary
 * account; only `GUEST_DECIDES` asks the guest.
 */
export type MessageRetentionMode =
	| 'ALWAYS_TEMPORARY'
	| 'GUEST_DECIDES'
	| 'ALWAYS_PERSISTENT';

/** The outcome for one conversation. */
export type MessageRetention = 'keep' | 'delete';

/** `undefined` while the guest has not answered yet. */
export const effectiveRetention = (
	mode: MessageRetentionMode,
	guestChoice?: MessageRetention
): MessageRetention | undefined => {
	if (mode === 'ALWAYS_TEMPORARY') return 'delete';
	if (mode === 'ALWAYS_PERSISTENT') return 'keep';
	return guestChoice;
};

/** The guest is asked once, before the first message, paste or upload. */
export const mustAskGuest = (
	mode: MessageRetentionMode,
	guestChoice?: MessageRetention
): boolean => mode === 'GUEST_DECIDES' && guestChoice === undefined;
