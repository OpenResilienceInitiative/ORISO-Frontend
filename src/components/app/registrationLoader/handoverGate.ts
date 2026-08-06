/**
 * The state of the gate that stands between "registered" and "writing".
 *
 * Frank, 2026-08-06: the button is only clickable once everything behind it has
 * loaded, because the click lands the user in the message field ready to type.
 * Bot detection (Altcha) and a queue for server overload will hang off the same
 * button, so they are modelled here rather than bolted on later.
 */
export type HandoverGateState =
	/** App bootstrap in flight: user data, consulting types, Matrix session. */
	| 'preparing'
	/** Reserved: Altcha or an equivalent human check is running. */
	| 'verifying'
	/** Reserved: the backend is at capacity and holding the user in a queue. */
	| 'queued'
	/** Everything behind the button is loaded. The only clickable state. */
	| 'ready'
	/** Taking longer than expected — the button opens as an escape hatch. */
	| 'slow'
	/** The user clicked; the handover is running. */
	| 'entering';

export const GATE_IS_OPEN: Record<HandoverGateState, boolean> = {
	preparing: false,
	verifying: false,
	queued: false,
	ready: true,
	slow: true,
	entering: false
};

/** i18n key for the status line inside the button, per state. */
export const GATE_STATUS_KEY: Record<HandoverGateState, string> = {
	preparing: 'registration.handover.status.preparing',
	verifying: 'registration.handover.status.verifying',
	queued: 'registration.handover.status.queued',
	ready: 'registration.handover.status.ready',
	slow: 'registration.handover.status.slow',
	entering: 'registration.handover.status.entering'
};

export const GATE_STATUS_FALLBACK: Record<HandoverGateState, string> = {
	preparing: 'Beratungsraum wird verschlüsselt …',
	verifying: 'Prüfung: Mensch oder Bot …',
	queued: 'Gleich sind Sie an der Reihe …',
	ready: 'Alles bereit — Sie können schreiben',
	slow: 'Das dauert länger als gewohnt',
	entering: 'Ihr Beratungsraum wird geöffnet …'
};

/**
 * How far the fill inside the button has advanced, 0–100.
 * `preparing` deliberately parks below the end: a bar that reaches 100 % and
 * then waits is worse than one that visibly still has something left to do.
 */
export const GATE_PROGRESS: Record<HandoverGateState, number> = {
	preparing: 70,
	verifying: 85,
	queued: 85,
	ready: 100,
	slow: 100,
	entering: 100
};
