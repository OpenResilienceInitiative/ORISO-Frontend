import {
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore
} from 'react';
import { apiGetAgenciesByIds } from '../api/apiGetAgenciesByIds';
import { UserDataContext } from '../globalState/context/UserDataContext';
import { AgencySettingsInterface } from '../globalState/interfaces';
import type { AgencyFormatSource } from '../components/conversationCreate/formatAvailability';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../utils/authenticatedTenant';

/**
 * The effective group-chat settings of the signed-in counsellor's
 * Beratungsstellen (#1440), shared by the session list's create entry and the
 * create flow so both answer the same way.
 *
 * The settings are refetched whenever a consumer mounts, the counsellor's
 * agencies change, or the signed-in Träger changes (sign-in / sign-out) — the
 * same moments the tenant settings are refreshed. Answers fetched for a
 * previous Träger are dropped.
 */

interface AgencySettingsSnapshot {
	/** Tenant the entries below were fetched for. */
	tenantId: number | null | undefined;
	byId: Record<number, AgencySettingsInterface | null>;
	/** How many requests per `${tenantId}|${ids}` key have settled. */
	settled: Record<string, number>;
	/** Request keys that currently have a fetch in flight. */
	inflight: Record<string, true>;
}

let snapshot: AgencySettingsSnapshot = {
	tenantId: undefined,
	byId: {},
	settled: {},
	inflight: {}
};
const listeners = new Set<() => void>();
const inFlight = new Map<string, Promise<void>>();
const generationByTenant = new Map<number | null, number>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;
const publish = (next: AgencySettingsSnapshot) => {
	snapshot = next;
	listeners.forEach((listener) => listener());
};

const emptySnapshot = (
	tenantId: number | null | undefined
): AgencySettingsSnapshot => ({
	tenantId,
	byId: {},
	settled: {},
	inflight: {}
});

const requestKey = (tenantId: number | null, ids: number[]) =>
	`${tenantId}|${ids.join(',')}`;

const refreshAgencySettings = (tenantId: number | null, ids: number[]) => {
	const key = requestKey(tenantId, ids);
	if (inFlight.has(key)) {
		return;
	}
	const generation = (generationByTenant.get(tenantId) ?? 0) + 1;
	generationByTenant.set(tenantId, generation);
	const isStale = () =>
		getAuthenticatedTenantId() !== tenantId ||
		generationByTenant.get(tenantId) !== generation;
	const base = (): AgencySettingsSnapshot =>
		snapshot.tenantId === tenantId ? snapshot : emptySnapshot(tenantId);
	const settle = (
		answers: Record<number, AgencySettingsInterface | null>
	) => {
		if (isStale()) return;
		const current = base();
		const byId = { ...current.byId };
		ids.forEach((id) => {
			if (id in answers) {
				byId[id] = answers[id];
			} else {
				delete byId[id];
			}
		});
		const inflight = { ...current.inflight };
		delete inflight[key];
		publish({
			tenantId,
			byId,
			settled: {
				...current.settled,
				[key]: (current.settled[key] ?? 0) + 1
			},
			inflight
		});
	};

	publish({
		...base(),
		inflight: { ...base().inflight, [key]: true }
	});

	const request = apiGetAgenciesByIds(ids)
		.then((agencies) => {
			const answers: Record<number, AgencySettingsInterface | null> = {};
			agencies.forEach((agency) => {
				if (agency?.id != null) {
					answers[agency.id] = agency.settings ?? null;
				}
			});
			settle(answers);
		})
		// Degrade to the Träger's answer: unknown agency settings add no
		// restriction (the backend still enforces its own gate on create).
		.catch(() => settle({}))
		.finally(() => {
			inFlight.delete(key);
			if (snapshot.inflight[key]) {
				const inflight = { ...snapshot.inflight };
				delete inflight[key];
				publish({ ...snapshot, inflight });
			}
		});
	inFlight.set(key, request);
};

export interface CounsellorAgencyFormats {
	/** The counsellor's agencies with their settings, where known. */
	agencies: AgencyFormatSource[];
	/**
	 * True until an answer for the current agencies has arrived that was
	 * requested after this component started asking — an admin may have
	 * changed a Beratungsstelle since an older answer. Also true while a
	 * shared refresh for this agency set is in flight.
	 */
	isLoading: boolean;
}

/**
 * @param enabled `false` skips fetching agency settings (e.g. for askers); the hook still returns
 * the agencies, using any `settings` already present in user data or from a previous fetch.
 */
export const useCounsellorAgencyFormats = (
	enabled = true
): CounsellorAgencyFormats => {
	const userAgencies = useContext(UserDataContext)?.userData?.agencies;
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	const current = useSyncExternalStore(subscribe, getSnapshot);

	const ids = useMemo(
		() =>
			Array.from(
				new Set((userAgencies ?? []).map((agency) => agency.id))
			).sort((a, b) => a - b),
		[userAgencies]
	);
	const idsKey = ids.join(',');

	useEffect(() => {
		if (enabled && ids.length > 0) {
			refreshAgencySettings(tenantId, ids);
		}
		// `ids` is derived from idsKey; keying on the string avoids refetching
		// on every new userData object with the same agencies.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, idsKey, tenantId]);

	const agencies = useMemo<AgencyFormatSource[]>(() => {
		const known = current.tenantId === tenantId ? current.byId : {};
		return (userAgencies ?? []).map((agency) => ({
			id: agency.id,
			settings:
				agency.id in known
					? known[agency.id]
					: (agency.settings ?? null)
		}));
	}, [current, tenantId, userAgencies]);

	const key = requestKey(tenantId, ids);
	const settledCount =
		current.tenantId === tenantId ? (current.settled[key] ?? 0) : 0;
	// The settle count when this component started waiting for `key`.
	const waitingFrom = useRef<{ key: string; count: number } | null>(null);
	if (waitingFrom.current?.key !== key) {
		waitingFrom.current = { key, count: settledCount };
	}
	const isLoading =
		enabled &&
		ids.length > 0 &&
		(Boolean(current.inflight[key]) ||
			settledCount <= waitingFrom.current.count);

	return { agencies, isLoading };
};

/** Clears the shared cache between tests. */
export const resetCounsellorAgencyFormatsForTests = () => {
	snapshot = emptySnapshot(undefined);
	inFlight.clear();
	generationByTenant.clear();
	listeners.forEach((listener) => listener());
};
