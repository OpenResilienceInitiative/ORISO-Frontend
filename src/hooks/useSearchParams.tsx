import { useSearchParams } from 'react-router-dom';

/**
 * Returns a single query-param value (or null), reactive to URL changes.
 *
 * A thin, typed wrapper over react-router v7's native `useSearchParams` so the
 * ~16 call sites keep a terse single-value API while the reactivity is handled
 * by the router (replaces the previous hand-rolled useLocation + useState +
 * useEffect implementation).
 */
export const useSearchParam = <T extends any>(paramKey: string): T => {
	const [searchParams] = useSearchParams();
	return searchParams.get(paramKey) as T;
};
