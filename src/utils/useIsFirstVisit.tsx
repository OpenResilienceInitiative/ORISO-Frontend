import { useEffect, useState } from 'react';

export const STORAGE_KEY_VISITED = 'visited';

const hasVisited = (storage: () => Storage) => {
	try {
		return storage().getItem(STORAGE_KEY_VISITED) === 'true';
	} catch {
		return false;
	}
};

/**
 * Whether this browser shows ORISO for the first time; the login page plays
 * its brand intro only then (#2272 follow-up). Read on the first render, so a
 * returning visit never paints a frame of the intro's closed stage.
 */
export default function useIsFirstVisit() {
	const [isFirstVisit] = useState(
		() =>
			!hasVisited(() => window.localStorage) &&
			!hasVisited(() => window.sessionStorage)
	);

	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_KEY_VISITED, 'true');
		} catch {
			// Without storage every visit is a first one.
		}
	}, []);

	return isFirstVisit;
}
