import { useCallback, useState } from 'react';

/**
 * Where a person stands after knocking on a room they cannot simply enter:
 * a running call shown in the chat, or a time-limited self-help group chat
 * whose lead lets people in (Frank, 2026-10-21).
 *
 * - `ready`: before any knock, the device check of a signed-in person
 *   joining a call (#2016). Left by joining or closing, not by an event.
 * - `consent`: only the self-help group, only while the account has not yet
 *   agreed to the Beratungsstelle's statement (ADR-022 gate 2).
 * - `waiting`: the knock is out; the host decides.
 * - `admitted`: let in; the caller joins and closes the dialog.
 * - `declined`: the host said no for now.
 *
 * "Nicht mehr warten" has no phase: it withdraws the knock and the caller
 * closes the dialog (Frank, 2026-10-21).
 */
export type KnockWaitPhase =
	| 'ready'
	| 'consent'
	| 'waiting'
	| 'admitted'
	| 'declined';

/** `call`: a running call in the chat. `group`: the time-limited group chat. */
export type KnockWaitVariant = 'call' | 'group';

export type KnockWaitEvent =
	| 'consentAccepted'
	| 'admitted'
	| 'declined'
	| 'knockAgain';

/** Consent is asked in the group variant only, and only when missing. */
export const initialKnockWaitPhase = (
	variant: KnockWaitVariant,
	consentRequired = false
): KnockWaitPhase =>
	variant === 'group' && consentRequired ? 'consent' : 'waiting';

/**
 * The only transitions there are. Anything else keeps the phase: a late
 * answer never skips the consent, and a second click on "Erneut anklopfen"
 * must not knock twice.
 */
export const nextKnockWaitPhase = (
	phase: KnockWaitPhase,
	event: KnockWaitEvent
): KnockWaitPhase => {
	switch (phase) {
		case 'ready':
			return phase;
		case 'consent':
			return event === 'consentAccepted' ? 'waiting' : phase;
		case 'waiting':
			if (event === 'admitted') return 'admitted';
			if (event === 'declined') return 'declined';
			return phase;
		case 'declined':
			return event === 'knockAgain' ? 'waiting' : phase;
		case 'admitted':
			return phase;
	}
};

/** The phase plus a dispatcher; the host's answer arrives as an event. */
export const useKnockWaitPhase = (initialPhase: KnockWaitPhase) => {
	const [phase, setPhase] = useState<KnockWaitPhase>(initialPhase);
	const dispatch = useCallback(
		(event: KnockWaitEvent) =>
			setPhase((current) => nextKnockWaitPhase(current, event)),
		[]
	);
	return { phase, dispatch };
};
