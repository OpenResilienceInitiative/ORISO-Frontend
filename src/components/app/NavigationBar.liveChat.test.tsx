// @vitest-environment jsdom
import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationBar } from './NavigationBar';
import { NavigationStoryProviders } from './navigationStoryHelpers';
import { apiGetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';

// Imported transitively; lottie-web needs a real canvas at module load.
vi.mock('lottie-react', () => ({ default: () => null }));

const responsive = vi.hoisted(() => ({ fromL: false }));

vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({
		fromS: responsive.fromL,
		fromM: responsive.fromL,
		fromL: responsive.fromL,
		fromXL: false,
		fromXXL: false,
		untilL: !responsive.fromL
	})
}));

vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiGetLiveChatAvailability: vi.fn(() => Promise.resolve(false)),
	apiHeartbeatLiveChatAvailability: vi.fn(() => Promise.resolve(true)),
	apiSetLiveChatAvailability: vi.fn(() => Promise.resolve())
}));

vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));

vi.mock('../../api/apiGetTools', () => ({
	userHasBudibaseTools: vi.fn(() => Promise.resolve(false))
}));

const consultantRoutes = {
	navigation: [
		{
			to: '/sessions/consultant/sessionView',
			titleKeys: { large: 'navigation.consultant.sessions.large' }
		}
	]
};

const renderNavigation = (liveChatViaSidebar: boolean) =>
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<NavigationStoryProviders
				role="consultant"
				liveChatViaSidebar={liveChatViaSidebar}
			>
				<NavigationBar
					routerConfig={consultantRoutes}
					onLogout={() => {}}
				/>
			</NavigationStoryProviders>
		</MemoryRouter>
	);

const liveChatEntry = (container: HTMLElement) =>
	container.querySelector('.navigation__item--liveChatToggle');

describe('NavigationBar live-chat entry follows the profile preference', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe.each([
		['mobile (below fromL)', false],
		['desktop (fromL)', true]
	])('%s', (_label, fromL) => {
		beforeEach(() => {
			responsive.fromL = fromL;
		});

		it('hides the live-chat entry when the preference is off', async () => {
			const { container } = renderNavigation(false);
			await waitFor(() =>
				expect(apiGetLiveChatAvailability).toHaveBeenCalled()
			);

			expect(liveChatEntry(container)).toBeNull();
		});

		it('shows the live-chat entry when the preference is on', async () => {
			const { container } = renderNavigation(true);
			await waitFor(() =>
				expect(apiGetLiveChatAvailability).toHaveBeenCalled()
			);

			expect(liveChatEntry(container)).not.toBeNull();
		});
	});
});
