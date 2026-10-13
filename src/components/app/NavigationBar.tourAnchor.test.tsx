// @vitest-environment jsdom
import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavigationBar } from './NavigationBar';
import { NavigationStoryProviders } from './navigationStoryHelpers';
import { apiGetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';

// Imported transitively; lottie-web needs a real canvas at module load.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({
		fromS: true,
		fromM: true,
		fromL: true,
		fromXL: false,
		fromXXL: false,
		untilL: false
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

const routerConfig = {
	navigation: [
		{
			to: '/sessions/consultant/sessionPreview',
			titleKeys: { large: 'navigation.consultant.enquiries.large' }
		},
		{
			to: '/sessions/consultant/sessionView',
			titleKeys: { large: 'navigation.consultant.sessions.large' }
		}
	]
};

describe('NavigationBar — product-tour anchor (FE#1622)', () => {
	it('marks only the consultant enquiries item as nav-enquiries', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
				<NavigationStoryProviders role="consultant">
					<NavigationBar
						routerConfig={routerConfig}
						onLogout={() => {}}
					/>
				</NavigationStoryProviders>
			</MemoryRouter>
		);
		await waitFor(() =>
			expect(apiGetLiveChatAvailability).toHaveBeenCalled()
		);

		const anchored = container.querySelectorAll(
			'[data-tour-target="nav-enquiries"]'
		);
		expect(anchored).toHaveLength(1);
		expect(anchored[0].getAttribute('href')).toBe(
			'/sessions/consultant/sessionPreview'
		);
	});
});
