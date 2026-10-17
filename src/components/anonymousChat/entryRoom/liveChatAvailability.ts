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

/**
 * One poll at a time. A request may take far longer than the interval, and
 * answers of overlapping requests can land out of order, which would feed the
 * confirmed-zero rule non-consecutive samples. So a tick that finds the
 * previous request still open is skipped: the returned function runs `request`
 * only when none is in flight, and the slot is free again once it settles
 * (resolved or rejected). Skipping a tick costs at most one request's
 * latency (`fetchData` gives up after 30 s); counting a stale answer would
 * wrongly turn somebody away.
 */
export const createSingleFlightPoll = () => {
	let inFlight = false;
	return (request: () => Promise<unknown>): void => {
		if (inFlight) return;
		inFlight = true;
		const release = () => {
			inFlight = false;
		};
		try {
			request().then(release, release);
		} catch {
			release();
		}
	};
};
