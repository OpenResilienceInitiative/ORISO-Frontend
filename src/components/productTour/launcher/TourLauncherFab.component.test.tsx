// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	AppConfigContext,
	AUTHORITIES,
	TenantContext,
	UserDataContext
} from '../../../globalState';
import { resetFloatingSurfaces } from '../../floatingSurfaces/floatingSurfaces';
import { TourLauncherSwitch } from '../../profile/TourLauncherSwitch';
import { TourLauncherFab } from './TourLauncherFab';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import(
		'../../../practice/practiceTestTranslate'
	);
	return { useTranslation: () => ({ t: makeTranslate() }) };
});

const HIDDEN_KEY = 'oriso.tourLauncher.hidden.fab-user';

/** The "?" and the Help switch in one tree, as they live in the app. */
const renderApp = () =>
	render(
		<Provider store={createStore()}>
			<MemoryRouter initialEntries={['/profile']}>
				<AppConfigContext.Provider
					value={{ enableWalkthrough: true } as never}
				>
					<UserDataContext.Provider
						value={
							{
								userData: {
									userId: 'fab-user',
									grantedAuthorities: [
										AUTHORITIES.CONSULTANT_DEFAULT
									]
								}
							} as never
						}
					>
						<TenantContext.Provider
							value={{ tenant: { settings: {} } } as never}
						>
							<TourLauncherFab />
							<TourLauncherSwitch />
						</TenantContext.Provider>
					</UserDataContext.Provider>
				</AppConfigContext.Provider>
			</MemoryRouter>
		</Provider>
	);

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('[]', { status: 200 }))
	);
});

afterEach(() => {
	cleanup();
	resetFloatingSurfaces();
	window.localStorage.clear();
	vi.unstubAllGlobals();
});

describe('hiding the "?" from its own menu', () => {
	it('hides after the confirm and comes back with the Help switch', async () => {
		renderApp();
		const toggle = screen.getByRole('switch', {
			name: 'Rundgang-Knopf anzeigen'
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Rundgänge öffnen' })
		);
		const hide = await screen.findByRole('menuitem', {
			name: 'Hilfe-Button ausblenden'
		});
		fireEvent.click(hide);
		// First press: only the consequence; the "?" is still there.
		expect(window.localStorage.getItem(HIDDEN_KEY)).toBeNull();
		fireEvent.click(hide);
		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'Rundgänge öffnen' })
			).toBeNull()
		);
		expect(window.localStorage.getItem(HIDDEN_KEY)).toBe('true');
		expect(
			toggle.getAttribute('aria-checked') ??
				String((toggle as HTMLInputElement).checked)
		).toBe('false');

		fireEvent.click(toggle);
		expect(
			await screen.findByRole('button', { name: 'Rundgänge öffnen' })
		).toBeTruthy();
		expect(window.localStorage.getItem(HIDDEN_KEY)).toBeNull();
	});

	it('keeps a dragged position per user across a remount', () => {
		window.localStorage.setItem(
			'oriso.tourLauncher.position.fab-user',
			JSON.stringify({ h: 'left', x: 24, v: 'top', y: 96 })
		);
		window.localStorage.setItem(
			'oriso.tourLauncher.position.someone-else',
			JSON.stringify({ h: 'right', x: 300, v: 'bottom', y: 300 })
		);
		renderApp();
		const root = screen
			.getByRole('button', { name: 'Rundgänge öffnen' })
			.closest<HTMLElement>('[data-cy="tour-launcher"]')!;
		expect(root.dataset.position).toBe('top-left');
		expect(root.style.left).toBe('24px');
		expect(root.style.top).toBe('96px');
	});
});
