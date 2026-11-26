import { apiGetOwnCallKnock } from '../../api/apiDirectLinks';
import type { AdmissionOutcome } from './directLinkEntryFlow';

/** The counsellor's answer usually comes within seconds. */
export const ENTRY_KNOCK_POLL_MS = 3_000;

/**
 * Nobody keeps a person glowing on the link page for ever: after this long
 * without an answer the wait ends and the person can knock again.
 */
export const ENTRY_KNOCK_MAX_WAIT_MS = 15 * 60_000;

export interface WaitForKnockAdmissionOptions {
	getKnock?: typeof apiGetOwnCallKnock;
	pollMs?: number;
	maxWaitMs?: number;
	/** The person stopped waiting: resolves `cancelled` at once. */
	signal?: AbortSignal;
}

/**
 * FE#2542: the wait on the link page. Asks `GET /users/call-knocks/mine/{id}`
 * until the counsellor answered or the knock is gone. A missed poll (offline,
 * 5xx) is not an answer; the next one asks again. A 404 means the knock no
 * longer exists (`cancelled`); a 401 means the session is over and asking
 * again cannot help (`ended`). After `maxWaitMs` the wait ends as well.
 */
export const waitForKnockAdmission = (
	knockId: number,
	{
		getKnock = apiGetOwnCallKnock,
		pollMs = ENTRY_KNOCK_POLL_MS,
		maxWaitMs = ENTRY_KNOCK_MAX_WAIT_MS,
		signal
	}: WaitForKnockAdmissionOptions = {}
): Promise<AdmissionOutcome> =>
	new Promise((resolve) => {
		let done = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let deadline: ReturnType<typeof setTimeout> | undefined;
		const finish = (outcome: AdmissionOutcome) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			clearTimeout(deadline);
			signal?.removeEventListener('abort', onAbort);
			resolve(outcome);
		};
		const onAbort = () => finish('cancelled');
		if (signal?.aborted) {
			finish('cancelled');
			return;
		}
		signal?.addEventListener('abort', onAbort, { once: true });
		deadline = setTimeout(() => finish('ended'), maxWaitMs);
		const poll = async () => {
			try {
				const { status } = await getKnock(knockId);
				if (status === 'ADMITTED') finish('admitted');
				else if (status === 'DECLINED') finish('declined');
				else if (status === 'CANCELLED') finish('cancelled');
			} catch (error) {
				const status = (error as Response | undefined)?.status;
				if (status === 404) finish('cancelled');
				else if (status === 401) finish('ended');
				/* anything else: see above */
			}
			if (!done) timer = setTimeout(poll, pollMs);
		};
		void poll();
	});
