// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { STATUS_EMPTY } from '../../globalState/interfaces';
import { WriteEnquiry } from './WriteEnquiry';

const { fetchSessions, useSessionMock } = vi.hoisted(() => ({
	fetchSessions: vi.fn(),
	useSessionMock: vi.fn()
}));

vi.mock('../../api', () => ({ apiGetAskerSessionList: fetchSessions }));
vi.mock('../../globalState', () => ({
	ActiveSessionProvider: ({
		children,
		activeSession
	}: React.PropsWithChildren<{
		activeSession: { item: { id: number } };
	}>) => (
		<>
			<span data-testid="enquiry-destination">
				{activeSession.item.id}
			</span>
			{children}
		</>
	),
	buildExtendedSession: ({ session }: { session: { id: number } }) => ({
		item: session,
		consultant: {}
	})
}));
vi.mock('../../hooks/useSession', () => ({
	useSession: useSessionMock
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

const writeRoute = '/sessions/user/view/write';

const EnquiryNavigation = () => {
	const navigate = useNavigate();

	return (
		<>
			<button type="button" onClick={() => navigate(writeRoute + '/19')}>
				Open enquiry 19
			</button>
			<button type="button" onClick={() => navigate(-1)}>
				Back
			</button>
		</>
	);
};

const enquiryRoute = (id?: number | string) => (
	<MemoryRouter
		initialEntries={[`${writeRoute}${id === undefined ? '' : '/' + id}`]}
	>
		<EnquiryNavigation />
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

const openEnquiry = (id?: number | string) => render(enquiryRoute(id));

beforeEach(() => {
	useSessionMock.mockReturnValue({ session: null, ready: true });
});

afterEach(() => {
	cleanup();
	fetchSessions.mockReset();
	useSessionMock.mockReset();
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

it.each(['0', 'not-an-id', '9007199254740992'])(
	'rejects invalid enquiry ID %s before loading a destination',
	async (id) => {
		openEnquiry(id);

		expect(await screen.findByText('Enquiry list')).toBeTruthy();
		expect(fetchSessions).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox', { name: 'Composer' })).toBeNull();
	}
);

it('waits for the exact enquiry from the session hook', async () => {
	useSessionMock.mockReturnValue({
		session: { item: { id: 19 }, consultant: {} },
		ready: false
	});
	const { rerender } = openEnquiry(42);
	expect(screen.getByRole('status').textContent).toBe('Loading');
	expect(fetchSessions).not.toHaveBeenCalled();
	expect(screen.queryByRole('textbox', { name: 'Composer' })).toBeNull();

	useSessionMock.mockReturnValue({
		session: { item: { id: 42 }, consultant: {} },
		ready: true
	});
	rerender(enquiryRoute(42));

	expect((await screen.findByTestId('enquiry-destination')).textContent).toBe(
		'42'
	);
	expect(fetchSessions).not.toHaveBeenCalled();
});

it('starts the list lookup when the hook is ready without a session', async () => {
	useSessionMock.mockReturnValue({ session: null, ready: false });
	fetchSessions.mockResolvedValue({ sessions: [rawEnquiry(42)] });
	const { rerender } = openEnquiry(42);
	expect(screen.getByRole('status').textContent).toBe('Loading');
	expect(fetchSessions).not.toHaveBeenCalled();

	useSessionMock.mockReturnValue({ session: null, ready: true });
	rerender(enquiryRoute(42));

	expect((await screen.findByTestId('enquiry-destination')).textContent).toBe(
		'42'
	);
	expect(fetchSessions).toHaveBeenCalledOnce();
});

it('uses the enquiry list when the hook returns a group with the same ID', async () => {
	useSessionMock.mockReturnValue({
		session: { isGroup: true, item: { id: 42 }, consultant: {} },
		ready: true
	});
	fetchSessions.mockResolvedValue({ sessions: [rawEnquiry(42)] });
	openEnquiry(42);

	expect((await screen.findByTestId('enquiry-destination')).textContent).toBe(
		'42'
	);
	expect(fetchSessions).toHaveBeenCalledOnce();
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

it('waits for the new destination on back navigation and ignores the obsolete lookup', async () => {
	type SessionList = { sessions: ReturnType<typeof rawEnquiry>[] };
	const obsolete = Promise.withResolvers<SessionList>();
	const current = Promise.withResolvers<SessionList>();
	fetchSessions
		.mockResolvedValueOnce({ sessions: [rawEnquiry(42)] })
		.mockReturnValueOnce(obsolete.promise)
		.mockReturnValueOnce(current.promise);

	openEnquiry();
	expect(
		await screen.findByRole('textbox', { name: 'Composer' })
	).toBeTruthy();
	expect(screen.getByTestId('enquiry-destination').textContent).toBe('42');

	fireEvent.click(screen.getByRole('button', { name: 'Open enquiry 19' }));
	expect(screen.getByRole('status').textContent).toBe('Loading');

	fireEvent.click(screen.getByRole('button', { name: 'Back' }));
	expect(fetchSessions).toHaveBeenCalledTimes(3);
	expect(screen.getByRole('status').textContent).toBe('Loading');
	expect(screen.queryByRole('textbox', { name: 'Composer' })).toBeNull();

	await act(async () => {
		obsolete.resolve({ sessions: [rawEnquiry(19)] });
	});
	expect(screen.getByRole('status').textContent).toBe('Loading');
	expect(screen.queryByTestId('enquiry-destination')).toBeNull();

	await act(async () => {
		current.resolve({ sessions: [rawEnquiry(48)] });
	});
	expect(
		await screen.findByRole('textbox', { name: 'Composer' })
	).toBeTruthy();
	expect(screen.getByTestId('enquiry-destination').textContent).toBe('48');
});
