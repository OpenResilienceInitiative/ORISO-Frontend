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

	const [data, setData] = useState<DepartmentLegalData | null>(null);
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!enabled || agencyId == null || topicId == null) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		getCachedDepartmentLegal(agencyId, topicId)
			.then((result) => {
				if (cancelled) {
					return;
				}
				setData(result);
				setLoading(false);
			})
			.catch((err: unknown) => {
				if (cancelled) {
					return;
				}
				setData(null);
				setError(err instanceof Error ? err : new Error(String(err)));
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [agencyId, topicId, enabled]);

	return { data, loading, error };
};
