import { useEffect, useRef } from 'react';

/** Reconcile visible views periodically and immediately when the user returns. */
export const useForegroundRefresh = (enabled: boolean, refresh: () => void) => {
	const refreshRef = useRef(refresh);
	useEffect(() => {
		refreshRef.current = refresh;
	}, [refresh]);

	useEffect(() => {
		if (!enabled) return;
		const reconcile = () => {
			if (document.visibilityState !== 'hidden') refreshRef.current();
		};
		const interval = window.setInterval(reconcile, 15000);
		document.addEventListener('visibilitychange', reconcile);
		window.addEventListener('focus', reconcile);
		window.addEventListener('online', reconcile);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', reconcile);
			window.removeEventListener('focus', reconcile);
			window.removeEventListener('online', reconcile);
		};
	}, [enabled]);
};
