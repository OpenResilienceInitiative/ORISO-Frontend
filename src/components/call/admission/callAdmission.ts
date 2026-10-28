/**
 * Whether guests of a call knock first or join directly (#1892 scope
 * extension, FE#1794 §3 "a switch in the call turns knocking on or off").
 *
 * The values are UserService's own (`DirectLinkDTO.admission`,
 * ORISO-UserService#1479). The per-link "Anklopfen" toggle of the share
 * popover (FE#1794, `CallShareSettings.knock`) is the same setting:
 * `knock === true` is `KNOCK`, `false` is `DIRECT`.
 *
 * TODO(#1892, #1794): there is no API to read or change this yet. In
 * ORISO-UserService#1479 the admission is derived from the medium (audio and
 * video always KNOCK, `InviteLinkChatType.admission()`), and
 * `UpdateDirectLinkDTO` has no `admission` field; the per-call share link is
 * not built either. Until it exists the switch runs on the in-memory store
 * below (Storybook only) and is not mounted in the call. Replace the store
 * with an HTTP one and mount `CallAdmissionToggle` in `GroupCallWidget`.
 */
export type CallAdmission = 'KNOCK' | 'DIRECT';

/** Knocking is on by default (Frank, 17 + 27 Oct, FE#1794). */
export const DEFAULT_CALL_ADMISSION: CallAdmission = 'KNOCK';

export const knockToAdmission = (knock: boolean): CallAdmission =>
	knock ? 'KNOCK' : 'DIRECT';

export const admissionToKnock = (admission: CallAdmission): boolean =>
	admission === 'KNOCK';

/**
 * Where the setting lives. The share popover and the in-call switch must use
 * the same store instance, so both always show the same value.
 */
export interface CallAdmissionStore {
	/** Calls back with the current value at once and on every change. Returns the unsubscribe. */
	watch: (onChange: (admission: CallAdmission) => void) => () => void;
	/** Resolves once the new value is stored; rejects and keeps the old one on failure. */
	set: (admission: CallAdmission) => Promise<void>;
}

/** In memory, for Storybook and tests, until the API exists (see TODO above). */
export const createMemoryCallAdmissionStore = (
	initial: CallAdmission = DEFAULT_CALL_ADMISSION
): CallAdmissionStore => {
	let value = initial;
	const listeners = new Set<(admission: CallAdmission) => void>();
	return {
		watch: (onChange) => {
			listeners.add(onChange);
			onChange(value);
			return () => listeners.delete(onChange);
		},
		set: async (admission) => {
			value = admission;
			listeners.forEach((listener) => listener(value));
		}
	};
};
