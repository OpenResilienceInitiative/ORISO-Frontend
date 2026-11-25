// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useTheme } from '@mui/material/styles';
import { SystemLoginAppearance } from './SystemLoginAppearance';
import { AppThemeProvider } from '../../resources/scripts/AppThemeProvider';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import type {
	AppConfigInterface,
	TenantDataInterface
} from '../../globalState/interfaces';
import { AppConfigContext } from '../../globalState/provider/AppConfigProvider';
import {
	resetTenantPalette,
	resetThemePreviewPalette
} from '../../utils/theme/applyTenantTheme';
import useTenantTheming from '../../utils/useTenantTheming';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';

vi.mock('lottie-react', () => ({ default: () => null }));

function simulateSystemDark(initial: boolean) {
	const preference = Object.assign(new EventTarget(), { matches: initial });
	vi.stubGlobal('matchMedia', () => preference);
	return (matches: boolean) => {
		preference.matches = matches;
		act(() => {
			preference.dispatchEvent(new Event('change'));
		});
	};
}

function NavigationAndTheme() {
	const navigate = useNavigate();
	const theme = useTheme();
	return (
		<>
			<p>{theme.palette.mode}</p>
			<button type="button" onClick={() => navigate('/registration')}>
				Visit registration
			</button>
		</>
	);
}

const renderRoute = (path: string, tenant?: TenantDataInterface) => (
	<MemoryRouter initialEntries={[path]}>
		<TenantContext.Provider
			value={{
				tenant,
				setTenant: () => {},
				updateTenantSettings: () => {}
			}}
		>
			<AppThemeProvider>
				<SystemLoginAppearance />
				<NavigationAndTheme />
			</AppThemeProvider>
		</TenantContext.Provider>
	</MemoryRouter>
);

function AppAndPreviewTheme() {
	const location = useLocation();
	const navigate = useNavigate();
	const theme = useTheme();
	useTenantTheming({
		location,
		...(location.pathname !== '/login' && {
			scheme: 'dark',
			contrast: 'high',
			textSize: 150
		})
	});
	return (
		<>
			<p>{theme.palette.mode}</p>
			<output>{theme.palette.background.paper}</output>
			<button
				type="button"
				onClick={() => navigate('/sessions/user/view')}
			>
				Open authenticated app
			</button>
			<button
				type="button"
				onClick={() =>
					navigate('/theme-demo?themePreviewPrimary=0061ff')
				}
			>
				Open tenant preview
			</button>
		</>
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	resetTenantPalette();
	resetThemePreviewPalette();
	const root = document.documentElement;
	delete root.dataset.orisoPersonalScheme;
	delete root.dataset.orisoContrastLevel;
	delete root.dataset.orisoPersonalTextSize;
	root.style.removeProperty('--oriso-personal-text-scale');
	document.body.style.removeProperty('--m3-primary');
	document.documentElement.style.removeProperty('--m3-primary');
});

describe('system appearance on login', () => {
	it('updates the login palette and its MUI portal theme as the OS changes', () => {
		const setDark = simulateSystemDark(true);
		render(renderRoute('/login', undefined));
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(true);
		expect(screen.getByText('dark')).not.toBeNull();
		setDark(false);
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(false);
		expect(screen.getByText('light')).not.toBeNull();
		setDark(true);
		expect(screen.getByText('dark')).not.toBeNull();
	});

	it('keeps tenant updates in dark and restores both scopes on navigation', () => {
		const setDark = simulateSystemDark(true);
		document.body.style.setProperty('--m3-primary', '#cc0000');
		const view = render(renderRoute('/login', undefined));
		const theming = {
			primaryColor: '#0b66c3'
		} as TenantDataInterface['theming'];
		const tenant = { theming } as TenantDataInterface;
		view.rerender(renderRoute('/login', tenant));
		const dark = computeOrisoPalette({ primary: '#0b66c3' }, 'dark').tokens;

		// A late themed response may still write the light tenant root.
		document.documentElement.style.setProperty('--m3-primary', '#0b66c3');
		expect(document.body.style.getPropertyValue('--m3-primary')).toBe(
			dark['--m3-primary']
		);
		fireEvent.click(screen.getByText('Visit registration'));
		expect(screen.getByText('light')).not.toBeNull();
		expect(
			document.documentElement.hasAttribute('data-oriso-system-login')
		).toBe(false);
		expect(
			document.documentElement.style.getPropertyValue('--m3-primary')
		).toBe('#0b66c3');
		expect(document.body.style.getPropertyValue('--m3-primary')).toBe(
			'#cc0000'
		);
		setDark(false);
		setDark(true);
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(false);
	});

	it('hands login styling to personal display and then keeps the tenant preview isolated', () => {
		const root = document.documentElement;
		const setDark = simulateSystemDark(true);
		render(
			<MemoryRouter initialEntries={['/login']}>
				<AppConfigContext.Provider
					value={{ useTenantService: false } as AppConfigInterface}
				>
					<AppThemeProvider>
						<SystemLoginAppearance />
						<AppAndPreviewTheme />
					</AppThemeProvider>
				</AppConfigContext.Provider>
			</MemoryRouter>
		);
		const personal = computeOrisoPalette(
			{ primary: '#a5000a' },
			'dark',
			'high'
		).tokens;
		const preview = computeOrisoPalette(
			{ primary: '#0061ff' },
			'light'
		).tokens;
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(true);
		expect(screen.getByText('dark')).toBeTruthy();

		fireEvent.click(
			screen.getByRole('button', { name: 'Open authenticated app' })
		);
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(false);
		expect(document.body.style.getPropertyValue('--m3-on-surface')).toBe(
			''
		);
		expect(root.dataset.orisoContrastLevel).toBe('high');
		expect(root.dataset.orisoPersonalTextSize).toBe('150');
		expect(root.style.getPropertyValue('--m3-primary')).toBe(
			personal['--m3-primary']
		);
		expect(screen.getByText('dark')).toBeTruthy();
		expect(screen.getByRole('status').textContent).toBe(
			personal['--m3-surface-container-high']
		);
		setDark(false);
		expect(screen.getByText('dark')).toBeTruthy();

		fireEvent.click(
			screen.getByRole('button', { name: 'Open tenant preview' })
		);
		expect(root.style.getPropertyValue('--m3-primary')).toBe(
			preview['--m3-primary']
		);
		expect(root.dataset.orisoContrastLevel).toBeUndefined();
		expect(root.dataset.orisoPersonalTextSize).toBeUndefined();
		expect(screen.getByText('light')).toBeTruthy();
		expect(document.body.hasAttribute('data-oriso-login-dark')).toBe(false);
	});

	it('clears a bootstrap marker from any route other than the login', () => {
		simulateSystemDark(true);
		document.documentElement.setAttribute('data-oriso-system-login', '');
		render(renderRoute('/registration'));
		expect(
			document.documentElement.hasAttribute('data-oriso-system-login')
		).toBe(false);
		expect(screen.getByText('light')).not.toBeNull();
	});
});
