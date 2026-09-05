/**
 * `window.innerWidth`, kept current on resize — the width `resolveStageLayout`
 * decides the list snap with. Shared by the stage story and the app's list
 * column (B2). SSR / tests without a window fall back to the 1280 toolbar.
 */
import { useEffect, useState } from 'react';

export const useViewportWidth = (): number => {
	const [width, setWidth] = useState(() =>
		typeof window === 'undefined' ? 1280 : window.innerWidth
	);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return width;
};
