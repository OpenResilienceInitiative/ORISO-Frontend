import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../../globalState/provider/TenantProvider';
import {
	resolveTenantSeeds,
	THEME_APPLIED_EVENT
} from '../../utils/theme/applyTenantTheme';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';
import { readDeviceDarkBrand } from '../../features/personal-display/preferences';

const routeMarker = 'data-oriso-system-login';
const darkMarker = 'data-oriso-login-dark';

export function SystemLoginAppearance() {
	const { pathname } = useLocation();
	const onLogin = pathname.replace(/\/+$/, '').toLowerCase() === '/login';
	const theming = useTenant()?.theming;

	useLayoutEffect(() => {
		const root = document.documentElement;
		root.toggleAttribute(routeMarker, onLogin);
		if (!onLogin) return;

		const body = document.body;
		const preference = window.matchMedia?.('(prefers-color-scheme: dark)');
		let restore: (() => void) | undefined;
		const notify = () =>
			window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));

		const apply = () => {
			if (preference?.matches) {
				if (restore) return;
				const seeds = resolveTenantSeeds(theming) ?? {
					primary: '#a5000a'
				};
				// The sign-in page follows the device's last dark-brand choice
				// (FE#1134): calm counterpart or the original brand colour.
				const { tokens } = computeOrisoPalette(
					seeds,
					'dark',
					'standard',
					{
						darkBrand: readDeviceDarkBrand()
					}
				);
				const properties = {
					...tokens,
					'--oriso-input-error': 'var(--m3-error)',
					'--oriso-input-autofill': 'var(--m3-surface-container-high)'
				};
				const previous = Object.keys(properties).map((name) => [
					name,
					body.style.getPropertyValue(name),
					body.style.getPropertyPriority(name)
				]);
				for (const [name, value] of Object.entries(properties)) {
					body.style.setProperty(name, value);
				}
				body.setAttribute(darkMarker, '');
				restore = () => {
					for (const [name, value, priority] of previous) {
						if (value)
							body.style.setProperty(name, value, priority);
						else body.style.removeProperty(name);
					}
					body.removeAttribute(darkMarker);
					notify();
				};
				notify();
			} else {
				restore?.();
				restore = undefined;
			}
		};
		apply();
		preference?.addEventListener('change', apply);
		return () => {
			preference?.removeEventListener('change', apply);
			root.removeAttribute(routeMarker);
			restore?.();
		};
	}, [onLogin, theming]);

	return null;
}
