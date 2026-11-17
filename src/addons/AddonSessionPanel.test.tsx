// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddonModuleLoaderContext } from './AddonMount';
import { AddonSessionPanel } from './AddonSessionPanel';
import { AvailableAddon } from './addonTypes';

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
});
