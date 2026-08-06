// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyVideoAppointmentRoutes } from './LegacyVideoAppointmentRoutes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'legacyVideoAppointment.unavailable.message'
				? 'Video appointments are currently unavailable.'
				: key
	})
}));

const renderHistoricRoute = (path: string) =>
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				{legacyVideoAppointmentRoutes.map(({ path, element }) => (
					<Route key={path} path={path} element={element} />
				))}
			</Routes>
		</MemoryRouter>
	);

describe('LegacyVideoAppointmentRoutes', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it.each([
		'/videoberatung/app/appointment-123',
		'/consultant/videoberatung/app/appointment-123'
	])(
		'renders the unavailable state for %s without loading call data',
		(path) => {
			const fetchSpy = vi.fn();
			vi.stubGlobal('fetch', fetchSpy);

			renderHistoricRoute(path);

			expect(
				screen.getByText(
					'Video appointments are currently unavailable.'
				)
			).toBeDefined();
			expect(document.querySelector('iframe')).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		}
	);
});
