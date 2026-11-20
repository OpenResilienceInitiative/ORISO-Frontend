import { CallKnock, CallKnockScope, scopeQuery } from './callKnockModel';
import type { CallKnockTransport } from './callKnockTransport';

export interface FakeCallKnockTransport extends CallKnockTransport {
	/** Somebody new knocks (or the list is replaced), as a poll would report it. */
	setPending: (knocks: CallKnock[]) => void;
	/** What the counsellor decided, in order — for assertions. */
	decisions: string[];
	/** Who is still waiting, in every conversation — for assertions. */
	pending: () => CallKnock[];
}

/**
 * In-memory transport for stories and tests: no server, no timers. Like the
 * server, it limits the list and "admit all" to the call's scope; a decision
 * removes the knock at once, as the next poll would.
 *
 * `rooms` maps a conversation's Matrix room to its session id, so a scope by
 * `matrixRoomId` works as it does on the server.
 */
export const createFakeCallKnockTransport = (
	initial: CallKnock[] = [],
	rooms: Record<string, number> = {}
): FakeCallKnockTransport => {
	let pending = [...initial];
	const listeners = new Map<(knocks: CallKnock[]) => void, CallKnockScope>();
	const decisions: string[] = [];
	const inScope = (scope: CallKnockScope) => (knock: CallKnock) =>
		knock.sessionId ===
		(scope.sessionId !== undefined
			? scope.sessionId
			: rooms[scope.matrixRoomId]);
	const publish = () =>
		listeners.forEach((scope, listener) =>
			listener(pending.filter(inScope(scope)))
		);
	const remove = (knockId: number) => {
		pending = pending.filter((k) => k.id !== knockId);
		publish();
	};

	return {
		decisions,
		pending: () => [...pending],
		setPending: (knocks) => {
			pending = [...knocks];
			publish();
		},
		watchPending: (scope, onChange) => {
			listeners.set(onChange, scope);
			onChange(pending.filter(inScope(scope)));
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
		admitAll: async (scope) => {
			decisions.push(`admit-all:${scopeQuery(scope)}`);
			const admitted = inScope(scope);
			pending = pending.filter((knock) => !admitted(knock));
			publish();
		}
	};
};
