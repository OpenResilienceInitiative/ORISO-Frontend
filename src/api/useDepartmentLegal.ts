import { useEffect, useState } from 'react';
import {
	DepartmentLegalData,
	getCachedDepartmentLegal
} from './apiGetDepartmentLegal';

export type UseDepartmentLegalOptions = {
	/**
	 * When false, no request is started (lazy expand). Defaults to true when
	 * both ids are present.
	 */
	enabled?: boolean;
};

export type UseDepartmentLegalResult = {
	data: DepartmentLegalData | null;
	loading: boolean;
	error: Error | null;
};

/**
 * The last settled result together with the (agency, topic) it belongs to.
 * Keeping the key next to the payload is what lets the hook refuse to hand
 * back a snapshot that was loaded for different identifiers.
 */
type DepartmentLegalSnapshot = {
	key: string | null;
	data: DepartmentLegalData | null;
	error: Error | null;
};

const NO_SNAPSHOT: DepartmentLegalSnapshot = {
	key: null,
	data: null,
	error: null
};

const snapshotKey = (agencyId: number, topicId: number): string =>
	`${agencyId}:${topicId}`;

/**
 * Shared department-legal snapshot for a (agency, topic) pair.
 * Multiple callers with the same key resolve the same cached promise.
 */
export const useDepartmentLegal = (
	agencyId?: number | null,
	topicId?: number | null,
	options: UseDepartmentLegalOptions = {}
): UseDepartmentLegalResult => {
	const idsReady = agencyId != null && topicId != null;
	const enabled = (options.enabled ?? true) && idsReady;
	const requestedKey =
		enabled && agencyId != null && topicId != null
			? snapshotKey(agencyId, topicId)
			: null;

	const [snapshot, setSnapshot] =
		useState<DepartmentLegalSnapshot>(NO_SNAPSHOT);

	useEffect(() => {
		if (!enabled || agencyId == null || topicId == null) {
			return;
		}

		let cancelled = false;
		const key = snapshotKey(agencyId, topicId);

		getCachedDepartmentLegal(agencyId, topicId)
			.then((result) => {
				if (cancelled) {
					return;
				}
				setSnapshot({ key, data: result, error: null });
			})
			.catch((err: unknown) => {
				if (cancelled) {
					return;
				}
				setSnapshot({
					key,
					data: null,
					error: err instanceof Error ? err : new Error(String(err))
				});
			});

		return () => {
			cancelled = true;
		};
	}, [agencyId, topicId, enabled]);

	/* Identifiers can change while a consumer stays mounted — a profile or
	   session update behind an open legal dialog. The effect only reacts after
	   that render, so a snapshot held in state would be painted once under the
	   new agency before the new request is even started. Publishing the
	   snapshot only for the identifiers it was loaded for closes that window:
	   a mismatch reads as "still loading", never as the other department's
	   legal text. */
	const isCurrent = snapshot.key === requestedKey;

	return {
		data: isCurrent ? snapshot.data : null,
		loading: enabled && !isCurrent,
		error: isCurrent ? snapshot.error : null
	};
};
