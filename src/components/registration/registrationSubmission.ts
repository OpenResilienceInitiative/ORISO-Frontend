/**
 * Whether an account is being created right now.
 *
 * **Why this is not component state.** It was, and the answer disappeared
 * exactly when it mattered. Submitting swaps the account form for the handover
 * screen ("Fast geschafft."), and while that screen is up the browser is handed
 * the authentication cookie — which makes the app reload the tenant, and the
 * provider above the router renders nothing while it does
 * (ORISO-Frontend#1475, open in #1477). Everything below it unmounts and mounts
 * again, `isRegistering` comes back `false`, and the account step is on screen
 * a second time — password field and all, restored from the in-memory draft —
 * until the redirect finally takes the person away. What they see is their own
 * password flashing back at them, then a jump, then another load, on the last
 * screen of a registration that had in fact already succeeded.
 *
 * Module state is the right lifetime for this. It survives any remount inside
 * the document, which is what the remount above is, and it dies with the
 * document, which is when a submit can no longer be in flight — so it can never
 * strand a later visitor on a handover screen for a submit that is long over.
 * Nothing about the account is kept here, only the fact that one is being
 * created; the same reasoning and the same lifetime as `accountDataDraft`.
 */
let submitting = false;

export const isRegistrationSubmitting = (): boolean => submitting;

export const markRegistrationSubmitting = (): void => {
	submitting = true;
};

/**
 * Only the failure paths call this. A successful submit leaves the flag
 * standing until the document load in `redirectToApp` clears it with the
 * document: between the API answering and that load there is still an
 * `apiGetAskerSessionList` round trip to wait out, and the form must not come
 * back for it either.
 */
export const clearRegistrationSubmitting = (): void => {
	submitting = false;
};
