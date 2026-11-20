import { useEffect, useState } from 'react';
import { apiGetUserDataBySessionId } from '../api/apiGetUserDataBySessionId';

interface ResolvedAsker {
	sessionId: number;
	askerId?: string;
}

/**
 * The client of a case, resolved for exactly this session: a result of the previous session is
 * never returned. `settled` is false while the lookup runs; a failed lookup settles without id.
 */
export const useCaseAskerId = (
	sessionId: number | undefined,
	enabled = true
) => {
	const [resolved, setResolved] = useState<ResolvedAsker>();

	useEffect(() => {
		if (!sessionId || !enabled) {
			return undefined;
		}
		let cancelled = false;
		apiGetUserDataBySessionId(sessionId)
			.then(
				(data) => data?.askerId,
				() => undefined
			)
			.then((askerId) => {
				if (!cancelled) {
					setResolved({ sessionId, askerId });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [sessionId, enabled]);

	const current =
		resolved && resolved.sessionId === sessionId ? resolved : undefined;
	return { settled: current !== undefined, askerId: current?.askerId };
};
