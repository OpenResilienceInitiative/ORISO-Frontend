/**
 * The rule for "nobody is live", shared by every screen that may say so.
 *
 * The details endpoint (and the public availability endpoint) report their own
 * failed lookup as zero, so one zero proves nothing: a second consecutive
 * answered zero confirms that nobody is live (#1270). A rejected request is
 * not an answer and changes nothing.
 */
export const CLOSED_CONFIRMATION_POLLS = 2;

/** The run of answered zeros after one more sample (`null` = no usable answer). */
export const nextUnavailablePollCount = (
	previous: number,
	available: number | null
): number => (available === 0 ? previous + 1 : 0);

export const isNobodyLiveConfirmed = (
	available: number | null,
	consecutiveUnavailablePolls: number
): boolean =>
	available === 0 && consecutiveUnavailablePolls >= CLOSED_CONFIRMATION_POLLS;

/** How long one poll request may stay open before it is given up on. */
export const POLL_REQUEST_TIMEOUT_MS = 15_000;

/**
 * One poll at a time. A request may take far longer than the interval, and
 * answers of overlapping requests can land out of order, which would feed the
 * confirmed-zero rule non-consecutive samples. So a tick that finds the
 * previous request still open is skipped: the returned function runs `request`
 * only when none is in flight.
 *
 * A hung request must not hold the slot for `fetchData`'s 30 s, so after
 * `timeoutMs` its `AbortSignal` is aborted and the slot is free for the next
 * tick. The abandoned request is stale from then on: `request` must pass the
 * signal to the call and drop the answer when `signal.aborted` (keep the last
 * known state, show no error). Counting a stale answer would wrongly turn
 * somebody away.
 */
export const createSingleFlightPoll = (
	timeoutMs: number = POLL_REQUEST_TIMEOUT_MS
) => {
	let inFlight = false;
	return (request: (signal: AbortSignal) => Promise<unknown>): void => {
		if (inFlight) return;
		inFlight = true;
		const controller = new AbortController();
		let released = false;
		let deadline: ReturnType<typeof setTimeout> | undefined;
		/* Settling or timing out frees the slot once; a late settle of an
		   abandoned request must not free the slot of a newer one. */
		const release = () => {
			if (released) return;
			released = true;
			clearTimeout(deadline);
			inFlight = false;
		};
		deadline = setTimeout(() => {
			controller.abort();
			release();
		}, timeoutMs);
		try {
			request(controller.signal).then(release, release);
		} catch {
			release();
		}
	};
};
