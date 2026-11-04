import { useEffect, useState } from 'react';

/**
 * Reads a `'true'` flag from sessionStorage once and clears it after the
 * first committed render. Clearing it during render lost it: React can
 * throw that render away and run it again, and the repeat found nothing.
 */
export const useOneShotSessionFlag = (key: string): boolean => {
	const [flagged] = useState(() => {
		try {
			return sessionStorage.getItem(key) === 'true';
		} catch {
			return false;
		}
	});
	useEffect(() => {
		try {
			sessionStorage.removeItem(key);
		} catch {
			/* nothing stored */
		}
	}, [key]);
	return flagged;
};
