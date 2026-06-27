import * as React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
	/** Initial history stack for the MemoryRouter (e.g. ['/sessions/user/view']). */
	initialEntries?: string[];
	initialIndex?: number;
}

/**
 * Render a component inside a react-router v7 `MemoryRouter` so that router
 * hooks (useParams/useLocation/useNavigate) and `<Routes>` resolve in tests.
 * Callers wrap any additional context providers their component needs.
 */
export const renderWithRouter = (
	ui: React.ReactElement,
	{
		initialEntries = ['/'],
		initialIndex,
		...options
	}: RenderWithRouterOptions = {}
) =>
	render(ui, {
		wrapper: ({ children }) => (
			<MemoryRouter
				initialEntries={initialEntries}
				initialIndex={initialIndex}
			>
				{children}
			</MemoryRouter>
		),
		...options
	});
