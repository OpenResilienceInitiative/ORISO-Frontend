// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddonModuleLoaderContext } from './AddonMount';
import { AddonSessionPanel } from './AddonSessionPanel';
import { AddonHostProps, AddonModule, AvailableAddon } from './addonTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../api/apiGetUserDataBySessionId', () => ({
	apiGetUserDataBySessionId: () => new Promise(() => {})
}));

const addon: AvailableAddon = {
	name: 'digisucht-tools',
	version: '1.0.0',
	entry: '/e.js',
	apiBase: '/api',
	apps: [
		{ id: 'goals', title: { de: 'Ziele' }, slots: ['consultant.session'] }
	]
};

const Case = ({ open }: { open: boolean }) => (
	<MemoryRouter>
		<AddonModuleLoaderContext.Provider value={() => new Promise(() => {})}>
			{open ? (
				<AddonSessionPanel
					addon={addon}
					app={addon.apps[0]}
					sessionId={42}
					onClose={() => {}}
				/>
			) : (
				<button type="button" data-addon-action="digisucht-tools/goals">
					Ziele
				</button>
			)}
		</AddonModuleLoaderContext.Provider>
	</MemoryRouter>
);

describe('AddonSessionPanel', () => {
	afterEach(cleanup);

	it('takes focus when it opens and hands it back to its button when it closes', () => {
		const view = render(<Case open={false} />);
		screen.getByRole('button', { name: 'Ziele' }).focus();

		view.rerender(<Case open />);
		expect(document.activeElement).toBe(
			screen.getByRole('heading', { name: 'Ziele' })
		);

		view.rerender(<Case open={false} />);
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Ziele' })
		);
	});

	it('mounts a client app at once, with the session and without an asker lookup', async () => {
		const module: AddonModule = { mount: vi.fn(), unmount: vi.fn() };
		render(
			<MemoryRouter>
				<AddonModuleLoaderContext.Provider
					value={() => Promise.resolve(module)}
				>
					<AddonSessionPanel
						addon={addon}
						app={{
							...addon.apps[0],
							slots: ['asker.session-menu']
						}}
						slot="asker.session-menu"
						agencyId={5}
						sessionId={42}
						onClose={() => {}}
					/>
				</AddonModuleLoaderContext.Provider>
			</MemoryRouter>
		);

		await waitFor(() => expect(module.mount).toHaveBeenCalled());
		const props = vi.mocked(module.mount).mock
			.calls[0][0] as AddonHostProps;
		expect(props.slot).toBe('asker.session-menu');
		expect(props.sessionId).toBe(42);
		expect(props.agencyId).toBe(5);
		expect(props.askerId).toBeUndefined();
	});

	it('hands focus to the menu button when its menu entry is gone', () => {
		const MenuCase = ({ open }: { open: boolean }) => (
			<MemoryRouter>
				<AddonModuleLoaderContext.Provider
					value={() => new Promise(() => {})}
				>
					<button type="button" aria-controls="flyout">
						Menü
					</button>
					<div style={{ display: 'none' }}>
						<button
							type="button"
							data-addon-action="digisucht-tools/goals"
							data-addon-menu-entry=""
						>
							Ziele
						</button>
					</div>
					{open && (
						<AddonSessionPanel
							addon={addon}
							app={addon.apps[0]}
							slot="consultant.session-menu"
							sessionId={42}
							onClose={() => {}}
						/>
					)}
				</AddonModuleLoaderContext.Provider>
			</MemoryRouter>
		);
		const shown = vi
			.spyOn(HTMLElement.prototype, 'getClientRects')
			.mockImplementation(function (this: HTMLElement) {
				return (this.getAttribute('aria-controls') === 'flyout'
					? [{}]
					: []) as unknown as DOMRectList;
			});
		const view = render(<MenuCase open />);
		view.rerender(<MenuCase open={false} />);

		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Menü' })
		);
		shown.mockRestore();
	});
});
