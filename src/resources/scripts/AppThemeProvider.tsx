import * as React from 'react';
import { useLayoutEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from './theme';
import { THEME_APPLIED_EVENT } from '../../utils/theme/applyTenantTheme';

// Recreates the MUI theme when the runtime tenant palette lands at
// :root (THB-05) — theme.jsx reads computed --m3-* values at creation.
export const AppThemeProvider = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [theme, setTheme] = useState(() => createAppTheme());

	useLayoutEffect(() => {
		const refresh = () => setTheme(createAppTheme());
		window.addEventListener(THEME_APPLIED_EVENT, refresh);
		// A child may have applied its palette before this listener mounted.
		if (
			document.body.hasAttribute('data-oriso-login-dark') ||
			document.documentElement.hasAttribute('data-oriso-personal-scheme')
		)
			refresh();
		return () => window.removeEventListener(THEME_APPLIED_EVENT, refresh);
	}, []);

	return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
