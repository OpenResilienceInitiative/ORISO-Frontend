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
 * Polls overlap (a request may take far longer than the interval), so an
 * older answer can arrive after a newer one. `begin()` numbers a request;
 * `accept(n)` is true only while no newer answer has been applied, and marks
 * `n` as the latest applied. A stale answer must not be counted, or the
 * confirmed-zero rule is fed in the wrong order.
 */
export const createLatestResponseGuard = () => {
	let issued = 0;
	let applied = 0;
	return {
		begin: (): number => ++issued,
		accept: (request: number): boolean => {
			if (request < applied) return false;
			applied = request;
			return true;
		}
	};
};
