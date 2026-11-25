import { apiGetOwnCallKnock } from '../../api/apiDirectLinks';
import type { AdmissionOutcome } from './directLinkEntryFlow';

/** The counsellor's answer usually comes within seconds. */
export const ENTRY_KNOCK_POLL_MS = 3_000;

export interface WaitForKnockAdmissionOptions {
	getKnock?: typeof apiGetOwnCallKnock;
	pollMs?: number;
	/** The person stopped waiting: resolves `cancelled` at once. */
	signal?: AbortSignal;
}

/**
 * FE#2542: the wait on the link page. Asks `GET /users/call-knocks/mine/{id}`
 * until the counsellor answered or the knock is gone. A missed poll is not an
 * answer; the next one asks again.
 */
export const waitForKnockAdmission = (
	knockId: number,
	{
		getKnock = apiGetOwnCallKnock,
		pollMs = ENTRY_KNOCK_POLL_MS,
		signal
	}: WaitForKnockAdmissionOptions = {}
): Promise<AdmissionOutcome> =>
	new Promise((resolve) => {
		let done = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (outcome: AdmissionOutcome) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			resolve(outcome);
		};
		const onAbort = () => finish('cancelled');
		if (signal?.aborted) {
			finish('cancelled');
			return;
		}
		signal?.addEventListener('abort', onAbort, { once: true });
		const poll = async () => {
			try {
				const { status } = await getKnock(knockId);
				if (status === 'ADMITTED') finish('admitted');
				else if (status === 'DECLINED') finish('declined');
				else if (status === 'CANCELLED') finish('cancelled');
			} catch {
				/* see above */
			}
			if (!done) timer = setTimeout(poll, pollMs);
		};
		void poll();
	});
