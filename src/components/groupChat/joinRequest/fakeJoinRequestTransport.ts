import {
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest,
	GroupChatJoinRequestOwnStatus
} from './joinRequestModel';
import {
	JoinRequestsUnavailableError,
	JoinRequestTransport
} from './joinRequestTransport';

type Operation = 'knock' | 'cancel' | 'admit' | 'decline';

/**
 * An in-memory `JoinRequestTransport` for stories and tests: the test (or a
 * story button) plays the server and pushes changes; the UI sees them the
 * same way it sees the real poller's.
 */
export const createFakeJoinRequestTransport = (
	options: { latencyMs?: number } = {}
) => {
	const latency = () =>
		new Promise<void>((resolve) =>
			setTimeout(resolve, options.latencyMs ?? 0)
		);
	const mine = new Map<number, GroupChatJoinRequestOwnStatus | null>();
	const mineListeners = new Map<
		number,
		Set<(status: GroupChatJoinRequestOwnStatus | null) => void>
	>();
	let pending: GroupChatJoinRequest[] = [];
	const pendingListeners = new Set<
		(requests: GroupChatJoinRequest[]) => void
	>();
	const failing = new Set<Operation>();
	let unavailable = false;
	let nextId = 1000;

	const fail = (operation: Operation) => {
		if (failing.has(operation)) {
			failing.delete(operation);
			throw new Error('FAKE_FAILURE');
		}
	};
	const emitMine = (seriesId: number) =>
		mineListeners
			.get(seriesId)
			?.forEach((listener) => listener(mine.get(seriesId) ?? null));
	const emitPending = () =>
		pendingListeners.forEach((listener) => listener(pending));

	const fake = {
		knocks: [] as Array<{ seriesId: number; inviteToken: string }>,
		cancellations: [] as number[],
		admissions: [] as Array<{
			requestId: number;
			role: GroupChatJoinAdmitRole;
		}>,
		declines: [] as number[],
		getMineCalls: 0,

		/** Plays the server: her request changed. */
		setMine: (
			seriesId: number,
			status: GroupChatJoinRequestOwnStatus | null
		) => {
			mine.set(seriesId, status);
			emitMine(seriesId);
		},
		/** Plays the server: the moderator's open requests changed. */
		setPending: (requests: GroupChatJoinRequest[]) => {
			pending = requests;
			emitPending();
		},
		failNext: (operation: Operation) => failing.add(operation),
		setUnavailable: (value: boolean) => {
			unavailable = value;
		}
	};

	const transport: JoinRequestTransport = {
		knock: async (seriesId, inviteToken) => {
			await latency();
			fail('knock');
			fake.knocks.push({ seriesId, inviteToken });
			const status: GroupChatJoinRequestOwnStatus = {
				id: ++nextId,
				status: 'PENDING',
				requestedAt: new Date().toISOString()
			};
			mine.set(seriesId, status);
			return status;
		},
		getMine: async (seriesId) => {
			result.getMineCalls += 1;
			await latency();
			if (unavailable) throw new JoinRequestsUnavailableError();
			return mine.get(seriesId) ?? null;
		},
		cancelMine: async (seriesId) => {
			await latency();
			fail('cancel');
			fake.cancellations.push(seriesId);
			const current = mine.get(seriesId);
			if (current)
				mine.set(seriesId, { ...current, status: 'CANCELLED' });
		},
		watchMine: (seriesId, onChange) => {
			const listeners = mineListeners.get(seriesId) ?? new Set();
			listeners.add(onChange);
			mineListeners.set(seriesId, listeners);
			return () => {
				listeners.delete(onChange);
			};
		},
		watchPending: (onChange) => {
			pendingListeners.add(onChange);
			if (pending.length) onChange(pending);
			return () => {
				pendingListeners.delete(onChange);
			};
		},
		admit: async (request, role) => {
			await latency();
			fail('admit');
			fake.admissions.push({ requestId: request.id, role });
			pending = pending.filter((item) => item.id !== request.id);
			emitPending();
		},
		decline: async (request) => {
			await latency();
			fail('decline');
			fake.declines.push(request.id);
			pending = pending.filter((item) => item.id !== request.id);
			emitPending();
		}
	};

	const result = Object.assign(transport, fake);
	return result;
};

export type FakeJoinRequestTransport = ReturnType<
	typeof createFakeJoinRequestTransport
>;
