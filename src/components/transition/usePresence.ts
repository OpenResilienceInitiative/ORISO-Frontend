import { useEffect, useState } from 'react';

export interface Presence {
	/** The element is still in the tree: shown, or on its way out. */
	mounted: boolean;
	/** The element has been told to go and is playing its exit. */
	leaving: boolean;
}

/**
 * Keeps an element mounted while its exit plays. React would remove it the
 * moment `present` turns false, so nothing could ever slide out.
 *
 * A zero `exitMs` (reduced motion) removes it at once.
 */
export const usePresence = (present: boolean, exitMs: number): Presence => {
	const [mounted, setMounted] = useState(present);

	useEffect(() => {
		if (present) {
			setMounted(true);
			return undefined;
		}
		if (exitMs <= 0) {
			setMounted(false);
			return undefined;
		}
		const timer = window.setTimeout(() => setMounted(false), exitMs);
		return () => window.clearTimeout(timer);
	}, [present, exitMs]);

	return { mounted: present || mounted, leaving: !present && mounted };
};
