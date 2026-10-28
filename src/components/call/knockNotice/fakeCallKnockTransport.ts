import type { CallKnock } from './callKnockModel';
import type { CallKnockTransport } from './callKnockTransport';

export interface FakeCallKnockTransport extends CallKnockTransport {
	/** Somebody new knocks (or the list is replaced), as a poll would report it. */
	setPending: (knocks: CallKnock[]) => void;
	/** What the counsellor decided, in order — for assertions. */
	decisions: string[];
}

/**
 * In-memory transport for stories and tests: no server, no timers. A decision
 * removes the knock at once, as the next poll would.
 */
export const createFakeCallKnockTransport = (
	initial: CallKnock[] = []
): FakeCallKnockTransport => {
	let pending = [...initial];
	const listeners = new Set<(knocks: CallKnock[]) => void>();
	const decisions: string[] = [];
	const publish = () =>
		listeners.forEach((listener) => listener([...pending]));
	const remove = (knockId: number) => {
		pending = pending.filter((k) => k.id !== knockId);
		publish();
	};

	return {
		decisions,
		setPending: (knocks) => {
			pending = [...knocks];
			publish();
		},
		watchPending: (onChange) => {
			listeners.add(onChange);
			onChange([...pending]);
			return () => listeners.delete(onChange);
		},
		admit: async (knockId) => {
			decisions.push(`admit:${knockId}`);
			remove(knockId);
		},
		decline: async (knockId) => {
			decisions.push(`decline:${knockId}`);
			remove(knockId);
		},
		admitAll: async () => {
			decisions.push('admit-all');
			pending = [];
			publish();
		}
	};
};
