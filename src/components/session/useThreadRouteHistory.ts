import { useEffect, useState } from 'react';

const AUTOMATIC_PAGES = 3;

type HistoryResult = {
	target: string;
	status: 'missing' | 'error';
};

export const useThreadRouteHistory = ({
	scope,
	rootId,
	hasRoot,
	historyReady,
	loadEarlier
}: {
	scope: string;
	rootId: string | null;
	hasRoot: boolean;
	historyReady: boolean;
	loadEarlier?: () => Promise<boolean>;
}): 'loading' | 'missing' | 'error' | null => {
	const target = rootId ? JSON.stringify([scope, rootId]) : null;
	const [result, setResult] = useState<HistoryResult | null>(null);

	useEffect(() => {
		if (!target || hasRoot || !historyReady || !loadEarlier) return;
		let cancelled = false;

		const load = async () => {
			try {
				for (let page = 0; page < AUTOMATIC_PAGES; page += 1) {
					// Each SDK page provides the continuation for the next.
					// eslint-disable-next-line no-await-in-loop
					const hasMore = await loadEarlier();
					if (cancelled) return;
					if (!hasMore) break;
				}
				setResult({ target, status: 'missing' });
			} catch {
				if (!cancelled) setResult({ target, status: 'error' });
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [target, hasRoot, historyReady, loadEarlier]);

	if (!target || hasRoot) return null;
	if (!historyReady) return 'loading';
	if (!loadEarlier) return 'missing';
	return result?.target === target ? result.status : 'loading';
};
