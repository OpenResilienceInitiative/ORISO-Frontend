import {
	apiAdmitAllCallKnocks,
	apiAdmitCallKnock,
	apiDeclineCallKnock,
	apiGetPendingCallKnocks
} from '../../../api/apiCallKnocks';
import { FETCH_ERRORS } from '../../../api/fetchData';
import type { CallKnock, CallKnockScope } from './callKnockModel';

/**
 * How call knocks reach the counsellor. One interface, so the notice never
 * knows whether the list came by polling or from a story's fake — the same
 * seam as the self-help knock (`JoinRequestTransport`, #1499).
 */
export interface CallKnockTransport {
	/** Calls back with this call's pending knocks, oldest first, whenever they change. Returns the unsubscribe. */
	watchPending: (
		scope: CallKnockScope,
		onChange: (knocks: CallKnock[]) => void
	) => () => void;
	admit: (knockId: number) => Promise<void>;
	decline: (knockId: number) => Promise<void>;
	/** Admits everybody waiting for this call only. */
	admitAll: (scope: CallKnockScope) => Promise<void>;
}

export interface CallKnockApi {
	listPending: (scope: CallKnockScope) => Promise<CallKnock[]>;
	admit: (knockId: number) => Promise<unknown>;
	decline: (knockId: number) => Promise<unknown>;
	admitAll: (scope: CallKnockScope) => Promise<unknown>;
}

const userServiceApi: CallKnockApi = {
	listPending: apiGetPendingCallKnocks,
	admit: apiAdmitCallKnock,
	decline: apiDeclineCallKnock,
	admitAll: apiAdmitAllCallKnocks
};

/**
 * 404: a UserService without the endpoints, or a room it does not know as a
 * conversation. 403: the caller is no counsellor. Either way, stop asking.
 */
const isFinal = (error: unknown) =>
	error instanceof Error &&
	(error.message === FETCH_ERRORS.NO_MATCH ||
		error.message === FETCH_ERRORS.FORBIDDEN);

/**
 * Somebody else decided first (409), or the knock is gone (404): the person
 * is no longer waiting, which is what the counsellor wanted to know.
 */
const alreadySettled = (error: unknown) =>
	error instanceof Error &&
	(error.message === FETCH_ERRORS.CONFLICT ||
		error.message === FETCH_ERRORS.NO_MATCH);

const settle = (request: Promise<unknown>): Promise<void> =>
	request.then(
		() => undefined,
		(error) => {
			if (alreadySettled(error)) return;
			throw error;
		}
	);

const fingerprint = (knocks: CallKnock[]) =>
	knocks.map((k) => `${k.id}:${k.status}`).join(',');

/**
 * The transport the app uses: UserService is the only authority, changes
 * arrive by polling — every `intervalMs` and whenever the tab comes back into
 * view, reporting only when the list differs from the last one.
 */
export const createHttpCallKnockTransport = ({
	api = userServiceApi,
	intervalMs = 5_000
}: {
	api?: CallKnockApi;
	intervalMs?: number;
} = {}): CallKnockTransport => ({
	watchPending: (scope, onChange) => {
		let stopped = false;
		let loading = false;
		let last: string | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const stop = () => {
			stopped = true;
			if (timer) clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
		const tick = () => {
			// Single flight: a tab coming back mid-request would start a second loop.
			if (stopped || loading) return;
			if (timer) clearTimeout(timer);
			loading = true;
			api.listPending(scope)
				.then((knocks) => {
					if (stopped) return;
					const pending = knocks.filter(
						(k) => k.status === 'PENDING'
					);
					const next = fingerprint(pending);
					if (next !== last) {
						last = next;
						onChange(pending);
					}
				})
				.catch((error) => {
					if (isFinal(error)) stop();
				})
				.finally(() => {
					loading = false;
					if (!stopped) timer = setTimeout(tick, intervalMs);
				});
		};
		function onVisible() {
			if (!stopped && document.visibilityState !== 'hidden') tick();
		}

		document.addEventListener('visibilitychange', onVisible);
		tick();
		return stop;
	},
	admit: (knockId) => settle(api.admit(knockId)),
	decline: (knockId) => settle(api.decline(knockId)),
	admitAll: (scope) => settle(api.admitAll(scope))
});

/** The one the app mounts. */
export const httpCallKnockTransport = createHttpCallKnockTransport();
