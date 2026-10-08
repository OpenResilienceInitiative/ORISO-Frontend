import { useCallback, useLayoutEffect, useRef } from 'react';

/** Post-send hydration belongs to the mounted conversation that sent it. */
export const useDelayedSessionRefresh = (
	sessionIdentity: string,
	refreshMessages?: () => void
) => {
	const timers = useRef(new Set<number>());
	const mounted = useRef(false);
	const currentIdentity = useRef(sessionIdentity);
	const currentRefresh = useRef(refreshMessages);
	currentIdentity.current = sessionIdentity;
	currentRefresh.current = refreshMessages;

	useLayoutEffect(() => {
		mounted.current = true;
		const pending = timers.current;
		return () => {
			mounted.current = false;
			pending.forEach((timer) => window.clearTimeout(timer));
			pending.clear();
		};
	}, [sessionIdentity]);

	return useCallback((sentInSession: string) => {
		if (
			!mounted.current ||
			sentInSession !== currentIdentity.current ||
			!currentRefresh.current
		)
			return;
		const timer = window.setTimeout(() => {
			timers.current.delete(timer);
			if (mounted.current && sentInSession === currentIdentity.current) {
				currentRefresh.current?.();
			}
		}, 500);
		timers.current.add(timer);
	}, []);
};
