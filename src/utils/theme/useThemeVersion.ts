import { useEffect, useState } from 'react';
import { THEME_APPLIED_EVENT } from './applyTenantTheme';

/**
 * A number that changes every time a tenant palette is applied. Canvas code
 * reads colours once when it is created, so it lists this as a dependency and
 * is rebuilt in the new palette instead of drawing in the previous one.
 */
export const useThemeVersion = (): number => {
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const bump = () => setVersion((current) => current + 1);
		window.addEventListener(THEME_APPLIED_EVENT, bump);
		return () => window.removeEventListener(THEME_APPLIED_EVENT, bump);
	}, []);
	return version;
};
