import { useCallback, useEffect, useState } from 'react';
import {
	apiGetCaseHandoverReasons,
	CaseHandoverReason
} from '../../api/apiCaseHandover';

export interface CaseHandoverReasonsState {
	reasons: CaseHandoverReason[];
	/** The last request succeeded. */
	loaded: boolean;
	/** Loaded and none came back: nothing is configured (FE#1725 US26). */
	unavailable: boolean;
	/** The request failed; distinct from "none configured". */
	failed: boolean;
	retry: () => void;
}

/** Handover reasons for the wizard; loads while `enabled`. */
export const useCaseHandoverReasons = (
	enabled = true
): CaseHandoverReasonsState => {
	const [reasons, setReasons] = useState<CaseHandoverReason[]>([]);
	const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
		'loading'
	);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		let cancelled = false;
		setState('loading');
		apiGetCaseHandoverReasons()
			.then((items) => {
				if (cancelled) return;
				setReasons(items || []);
				setState('loaded');
			})
			.catch(() => {
				if (cancelled) return;
				setReasons([]);
				setState('failed');
			});
		return () => {
			cancelled = true;
		};
	}, [attempt, enabled]);

	const retry = useCallback(() => setAttempt((count) => count + 1), []);

	return {
		reasons,
		loaded: state === 'loaded',
		unavailable: state === 'loaded' && reasons.length === 0,
		failed: state === 'failed',
		retry
	};
};
