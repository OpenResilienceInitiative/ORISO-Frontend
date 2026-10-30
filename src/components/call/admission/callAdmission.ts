/**
 * Whether guests of a call knock first or join directly (#1892 scope
 * extension, FE#1794 §3 "a switch in the call turns knocking on or off").
 *
 * It is the same setting as the per-link "Anklopfen" toggle of the share
 * popover (FE#1794, PR #1910): `CallShareSettings.knock`. The in-call switch
 * reads and writes `knock` and leaves `temporaryAccount` untouched.
 *
 * DEPENDENCY: `CallShareSettings` mirrors
 * `src/components/call/share/callShareSettings.ts` of PR #1910 (head
 * adc7612f4), same name and fields, because #1910 is not on `dev` yet. When
 * #1910 merges, delete the mirror below and import it from there.
 *
 * In the running call the switch is drawn by the call itself
 * (ORISO-ElementCall#109): `GroupCallWidget` reads and changes the share
 * link's `knock` (ORISO-UserService#1488, `useCallShareLinkKnock`) and sends
 * it to the call as `org.oriso.call.knock_state`. This host toggle stays on
 * the in-memory store below, for Storybook only, and is not mounted.
 */
export interface CallShareSettings {
	/** Guests knock and wait until the counsellor lets them in. */
	knock: boolean;
	/** Guests get a temporary account, deleted after the call. */
	temporaryAccount: boolean;
}

/** Same defaults as #1910 (Frank, 17 + 27 Oct): both on. */
export const defaultCallShareSettings = (): CallShareSettings => ({
	knock: true,
	temporaryAccount: true
});

/** UserService's word for it (`DirectLinkDTO.admission`, ORISO-UserService#1479). */
export type CallAdmission = 'KNOCK' | 'DIRECT';

export const knockToAdmission = (knock: boolean): CallAdmission =>
	knock ? 'KNOCK' : 'DIRECT';

export const admissionToKnock = (admission: CallAdmission): boolean =>
	admission === 'KNOCK';

/**
 * Where the call's share settings live. The share popover
 * (`CallShare initialSettings / onSettingsChange`) and the in-call switch must
 * use the same store, so both always show the same value.
 */
export interface CallShareSettingsStore {
	/** Calls back with the current settings at once and on every change. Returns the unsubscribe. */
	watch: (onChange: (settings: CallShareSettings) => void) => () => void;
	/** Resolves once stored; rejects and keeps the old settings on failure. */
	set: (settings: CallShareSettings) => Promise<void>;
}

/** In memory, for Storybook and tests, until the API exists (see TODO above). */
export const createMemoryCallShareSettingsStore = (
	initial: CallShareSettings = defaultCallShareSettings()
): CallShareSettingsStore => {
	let value = { ...initial };
	const listeners = new Set<(settings: CallShareSettings) => void>();
	return {
		watch: (onChange) => {
			listeners.add(onChange);
			onChange({ ...value });
			return () => listeners.delete(onChange);
		},
		set: async (settings) => {
			value = { ...settings };
			listeners.forEach((listener) => listener({ ...value }));
		}
	};
};
