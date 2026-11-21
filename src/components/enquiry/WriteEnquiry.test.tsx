// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { STATUS_EMPTY } from '../../globalState/interfaces';
import { WriteEnquiry } from './WriteEnquiry';

const fetchSessions = vi.hoisted(() => vi.fn());

vi.mock('../../api', () => ({ apiGetAskerSessionList: fetchSessions }));
vi.mock('../../globalState', () => ({
	ActiveSessionProvider: ({ children }: React.PropsWithChildren) => children,
	buildExtendedSession: ({ session }: { session: { id: number } }) => ({
		item: session,
		consultant: {}
	})
}));
vi.mock('../../hooks/useSession', () => ({
	useSession: () => ({ session: null, ready: true })
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	EmailSentAnimation: () => null
}));
vi.mock('../overlay/Overlay', () => ({
	Overlay: () => null,
	OVERLAY_FUNCTIONS: { REDIRECT: 'redirect' }
}));
vi.mock('../app/Loading', () => ({
	Loading: () => <span role="status">Loading</span>
}));
vi.mock('../app/appChunks', () => ({
	loadMessageComposer: async () => ({
		default: () => <textarea aria-label="Composer" />
	})
}));
vi.mock('./EnquiryLanguageSelection', () => ({
	EnquiryLanguageSelection: () => null
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const rawEnquiry = (id: number) => ({ session: { id, status: STATUS_EMPTY } });

const openEnquiry = (id?: number) =>
	render(
		<MemoryRouter
			initialEntries={[`/sessions/user/view/write${id ? '/' + id : ''}`]}
		>
			<Routes>
				<Route
					path="/sessions/user/view/write/:sessionId?"
					element={<WriteEnquiry />}
				/>
				<Route
					path="/sessions/user/view"
					element={<div>Enquiry list</div>}
				/>
			</Routes>
		</MemoryRouter>
	);

afterEach(() => {
	cleanup();
	fetchSessions.mockReset();
});

it('returns to the list when there is no first enquiry to write', async () => {
	fetchSessions.mockResolvedValue({ sessions: [] });
	openEnquiry();

	expect(await screen.findByText('Enquiry list')).toBeTruthy();
});

it('does not open a different enquiry for a stale detail link', async () => {
	fetchSessions.mockResolvedValue({ sessions: [rawEnquiry(19)] });
	openEnquiry(42);

	expect(await screen.findByText('Enquiry list')).toBeTruthy();
	expect(screen.queryByRole('textbox', { name: 'Composer' })).toBeNull();
});

it('lets the asker retry a temporary list failure on the same route', async () => {
	fetchSessions.mockImplementationOnce(async (options) => {
		if (options?.strict) throw new Error('unavailable');
		return { sessions: [] };
	});
	fetchSessions.mockResolvedValueOnce({ sessions: [rawEnquiry(42)] });
	openEnquiry(42);

	fireEvent.click(
		await screen.findByRole('button', {
			name: 'sessionList.reloadButton.label'
		})
	);
	expect(
		await screen.findByRole('textbox', { name: 'Composer' })
	).toBeTruthy();
});
