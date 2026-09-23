import {
	apiAdmitGroupChatJoinRequest,
	apiCancelOwnGroupChatJoinRequest,
	apiDeclineGroupChatJoinRequest,
	apiGetOwnGroupChatJoinRequest,
	apiGetPendingGroupChatJoinRequests,
	apiKnockOnGroupChat
} from '../../../api/apiGroupChatJoinRequests';
import { FETCH_ERRORS } from '../../../api/fetchData';
import {
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest,
	GroupChatJoinRequestOwnStatus
} from './joinRequestModel';
import {
	JoinRequestsUnavailableError,
	JoinRequestTransport
} from './joinRequestTransport';

export interface JoinRequestApi {
	knock: (seriesId: number) => Promise<GroupChatJoinRequestOwnStatus>;
	getMine: (
		seriesId: number
	) => Promise<GroupChatJoinRequestOwnStatus | null>;
	cancelMine: (seriesId: number) => Promise<void>;
	listPending: () => Promise<GroupChatJoinRequest[]>;
	admit: (
		seriesId: number,
		requestId: number,
		role: GroupChatJoinAdmitRole
	) => Promise<void>;
	decline: (seriesId: number, requestId: number) => Promise<void>;
}

const userServiceApi: JoinRequestApi = {
	knock: apiKnockOnGroupChat,
	getMine: apiGetOwnGroupChatJoinRequest,
	cancelMine: apiCancelOwnGroupChatJoinRequest,
	listPending: apiGetPendingGroupChatJoinRequests,
	admit: apiAdmitGroupChatJoinRequest,
	decline: apiDeclineGroupChatJoinRequest
};

const isUnavailable = (error: unknown) =>
	error instanceof Error && error.message === FETCH_ERRORS.NO_MATCH;

const fingerprint = (
	value: GroupChatJoinRequestOwnStatus | GroupChatJoinRequest[] | null
) =>
	value === null
		? 'none'
		: Array.isArray(value)
			? value.map((item) => `${item.id}:${item.status}`).join(',')
			: `${value.id}:${value.status}`;

/**
 * Asks `load` now, every `intervalMs`, and whenever the tab comes back into
 * view; reports a result only when it differs from the last one. A server
 * without the endpoints (404) ends the loop for good — no point asking a
 * UserService that predates #1499 every few seconds. Other errors are
 * transient: the next tick tries again.
 */
const poll = <
	T extends GroupChatJoinRequestOwnStatus | GroupChatJoinRequest[] | null
>(
	load: () => Promise<T>,
	intervalMs: number,
	onChange: (value: T) => void
) => {
	let stopped = false;
	let last: string | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const stop = () => {
		stopped = true;
		if (timer) clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisible);
	};
	const tick = () => {
		if (timer) clearTimeout(timer);
		load()
			.then((value) => {
				if (stopped) return;
				const next = fingerprint(value);
				if (next !== last) {
					last = next;
					onChange(value);
				}
			})
			.catch((error) => {
				if (isUnavailable(error)) stop();
			})
			.finally(() => {
				if (!stopped) timer = setTimeout(tick, intervalMs);
			});
	};
	function onVisible() {
		if (!stopped && document.visibilityState !== 'hidden') tick();
	}

	document.addEventListener('visibilitychange', onVisible);
	tick();
	return stop;
};

/**
 * The transport the app uses today: UserService is the source of truth and
 * the only authority (see `docs/architecture/knock-to-join.md`); changes
 * arrive by polling. A low-latency nudge (the Matrix to-device
 * `org.oriso.feed.updated` signal, ADR-020 draft) can later call the same
 * `tick` without changing any caller.
 */
export const createHttpJoinRequestTransport = ({
	api = userServiceApi,
	mineIntervalMs = 10_000,
	pendingIntervalMs = 15_000
}: {
	api?: JoinRequestApi;
	mineIntervalMs?: number;
	pendingIntervalMs?: number;
} = {}): JoinRequestTransport => ({
	knock: (seriesId) => api.knock(seriesId),
	getMine: (seriesId) =>
		api.getMine(seriesId).catch((error) => {
			throw isUnavailable(error)
				? new JoinRequestsUnavailableError()
				: error;
		}),
	cancelMine: (seriesId) => api.cancelMine(seriesId),
	watchMine: (seriesId, onChange) =>
		poll(() => api.getMine(seriesId), mineIntervalMs, onChange),
	watchPending: (onChange) =>
		poll(() => api.listPending(), pendingIntervalMs, onChange),
	admit: (request, role) => api.admit(request.seriesId, request.id, role),
	decline: (request) => api.decline(request.seriesId, request.id)
});

/** The one the app mounts. */
export const httpJoinRequestTransport = createHttpJoinRequestTransport();
