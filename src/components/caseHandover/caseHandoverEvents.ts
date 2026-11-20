/**
 * The notification events that end a handover offer one way or the other.
 *
 * Its own module with no imports, because three different watchers need it —
 * the sender's screen, the recipient's gate and the session-scoped status
 * refresh — and each of them used to carry its own copy. The watchers differ
 * in what they do with an event; which events count is the one thing they
 * must agree on, so it lives here rather than three times over.
 */
export const CASE_HANDOVER_RESOLUTION_EVENTS = new Set([
	'case.handover.granted',
	'case.handover.consent.declined',
	// A colleague offer ends without a grant: the recipient said no, or the
	// offering counsellor took it back. Both screens refresh instead of waiting
	// for a focus event.
	'case.handover.offer.declined',
	'case.handover.offer.withdrawn'
]);
