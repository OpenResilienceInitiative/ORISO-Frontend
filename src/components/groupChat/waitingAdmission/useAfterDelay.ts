import { useEffect, useState } from 'react';

/**
 * True once `enabled` has stayed on for `ms`; switching it off starts over.
 * ORISO-Frontend#2237: after a minute in a running group's waiting room the
 * person reads that they will be let in shortly.
 */
export const useAfterDelay = (enabled: boolean, ms: number): boolean => {
	const [passed, setPassed] = useState(false);
	useEffect(() => {
		setPassed(false);
		if (!enabled) return undefined;
		const timer = setTimeout(() => setPassed(true), ms);
		return () => clearTimeout(timer);
	}, [enabled, ms]);
	return enabled && passed;
};
