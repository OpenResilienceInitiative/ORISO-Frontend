// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiGetCaseHandoverRequestStatus } from '../../api/apiCaseHandover';
import { SessionTypeContext, UserDataContext } from '../../globalState';
import { useSession } from '../../hooks/useSession';
import { mobileDetailView, mobileListView } from '../app/navigationHandler';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import { SessionView } from './SessionView';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../api/apiCaseHandover', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../api/apiCaseHandover')>();
	return { ...actual, apiGetCaseHandoverRequestStatus: vi.fn() };
});

vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../app/Loading', () => ({
	Loading: () => <div data-testid="loading" />
}));
vi.mock('./SessionStream', () => ({
	SessionStream: () => <div data-testid="session-stream" />
}));
vi.mock('../groupChat/JoinGroupChatView', () => ({
	JoinGroupChatView: () => <div data-testid="join-group" />
}));
const responsive = vi.hoisted(() => ({ fromL: true }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => responsive
}));
vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileDetailView: vi.fn(),
	mobileListView: vi.fn()
}));

const userData = { userId: 'recipient-1', userName: 'recipient' } as any;

const renderAt = (path: string, asker = false) =>
	render(
		<JotaiProvider>
			<UserDataContext.Provider
				value={
					{
						userData: asker
							? {
									...userData,
									grantedAuthorities: [
										'AUTHORIZATION_USER_DEFAULT'
									]
								}
							: userData
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: asker
							? '/sessions/user/view'
							: '/sessions/consultant/sessionView'
					}}
				>
					<MemoryRouter initialEntries={[path]}>
						{asker && (
							<Link to="/sessions/user/view/session/41?rejectedEnquiry=1">
								Open rejected enquiry
							</Link>
						)}
						<Routes>
							<Route
								path="/sessions/consultant/sessionView/session/:sessionId"
								element={<SessionView />}
							/>
							<Route
								path="/sessions/user/view/session/:sessionId"
								element={<SessionView />}
							/>
							<Route
								path="/sessions/consultant/sessionView/chat/:chatId"
								element={<SessionView />}
							/>
							<Route
								path="/sessions/consultant/sessionView"
								element={<div data-testid="session-list" />}
							/>
						</Routes>
					</MemoryRouter>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</JotaiProvider>
	);

describe('SessionView case handover route boundary', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		responsive.fromL = true;
		vi.mocked(useSession).mockReturnValue({
			session: undefined,
			ready: false,
			reload: vi.fn(),
			read: vi.fn()
		} as any);
	});

	it('does not mount useSession or metadata/history for a matching pending offer', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: false,
			ownershipRevision: 7,
			clientConsentRequired: false
		});

		renderAt(
			'/sessions/consultant/sessionView/session/41?caseHandoverRequestId=501'
		);

		await waitFor(() =>
			expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledWith(
				41,
				501
			)
		);
		expect(useSession).not.toHaveBeenCalled();
	});

	it('mounts the normal body only after the scoped response grants caller content', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'GRANTED',
			canViewContent: true,
			ownershipRevision: 8,
			clientConsentRequired: false
		});

		await act(async () => {
			renderAt(
				'/sessions/consultant/sessionView/session/41?caseHandoverRequestId=501'
			);
		});

		await waitFor(() =>
			expect(useSession).toHaveBeenCalledWith(
				undefined,
				41,
				undefined,
				false,
				false
			)
		);
	});

	it('keeps an ordinary consultant session route unchanged', async () => {
		renderAt('/sessions/consultant/sessionView/session/41');

		await waitFor(() =>
			expect(useSession).toHaveBeenCalledWith(
				undefined,
				41,
				undefined,
				false,
				false
			)
		);
		expect(apiGetCaseHandoverRequestStatus).not.toHaveBeenCalled();
	});

	it('requires the exact rejected session only on the marked asker detail route', () => {
		renderAt('/sessions/user/view/session/41?rejectedEnquiry=1', true);

		expect(useSession).toHaveBeenCalledWith(
			undefined,
			41,
			undefined,
			true,
			true
		);
		expect(apiGetCaseHandoverRequestStatus).not.toHaveBeenCalled();
	});

	it('unmounts the prior conversation while the marked rejection loads at the same case route', async () => {
		const priorSession = {
			item: { id: 41, status: 2 },
			isGroup: false
		} as never;
		const useSessionMount: typeof useSession = (
			_room,
			_id,
			_chat,
			_reconcile,
			requireRejected
		) => {
			const [session] = React.useState(() =>
				requireRejected ? null : priorSession
			);
			return {
				session,
				ready: session !== null,
				reload: vi.fn(),
				read: vi.fn()
			};
		};
		vi.mocked(useSession).mockImplementation(useSessionMount);
		renderAt('/sessions/user/view/session/41', true);
		await screen.findByTestId('session-stream');

		fireEvent.click(
			screen.getByRole('link', { name: 'Open rejected enquiry' })
		);

		expect(screen.queryByTestId('session-stream')).toBeNull();
		expect(screen.getByTestId('loading')).toBeTruthy();
	});

	it('loads a group by chat id without looking up a case with the same number', () => {
		renderAt('/sessions/consultant/sessionView/chat/41');

		expect(useSession).toHaveBeenCalledWith(
			undefined,
			undefined,
			41,
			false,
			false
		);
		expect(apiGetCaseHandoverRequestStatus).not.toHaveBeenCalled();
	});

	it('closes a pending offer back to the list and restores the mobile list view', async () => {
		responsive.fromL = false;
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: false,
			ownershipRevision: 7,
			clientConsentRequired: false
		});
		const { unmount } = renderAt(
			'/sessions/consultant/sessionView/session/41?caseHandoverRequestId=501'
		);

		fireEvent.click(await screen.findByTestId('m3-dialog-close'));
		expect(await screen.findByTestId('session-list')).toBeTruthy();
		expect(mobileDetailView).toHaveBeenCalled();
		unmount();
		expect(mobileListView).toHaveBeenCalled();
	});
});

describe('SessionView topic duplicate route boundary', () => {
	const roomId = '!old:matrix.example';
	const path = `/sessions/consultant/sessionView/${encodeURIComponent(roomId)}/41`;
	const markedPath = `${path}?topicDuplicate=1`;
	const renderMarked = (initialPath: string) =>
		render(
			<JotaiProvider>
				<UserDataContext.Provider
					value={
						{
							userData: {
								...userData,
								grantedAuthorities: [
									'AUTHORIZATION_CONSULTANT_DEFAULT'
								]
							}
						} as never
					}
				>
					<SessionTypeContext.Provider
						value={{
							type: SESSION_LIST_TYPES.MY_SESSION,
							path: '/sessions/consultant/sessionView'
						}}
					>
						<MemoryRouter initialEntries={[initialPath]}>
							<Link to={markedPath}>Open strict room</Link>
							<Routes>
								<Route
									path="/sessions/consultant/sessionView/session/:sessionId"
									element={<SessionView />}
								/>
								<Route
									path="/sessions/consultant/sessionView/:groupId/:sessionId"
									element={<SessionView />}
								/>
								<Route
									path="/notifications"
									element={<div data-testid="timeline" />}
								/>
							</Routes>
						</MemoryRouter>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</JotaiProvider>
		);

	beforeEach(() => {
		vi.clearAllMocks();
		responsive.fromL = true;
	});
	afterEach(cleanup);

	it('recovers the exact room binding on a cold route and returns to Timeline if unavailable', async () => {
		vi.mocked(useSession).mockReturnValue({
			session: null,
			ready: true,
			reload: vi.fn(),
			read: vi.fn()
		});
		renderMarked(markedPath);
		expect(vi.mocked(useSession).mock.calls[0][0]).toEqual({
			roomId,
			caseId: 41
		});
		expect(await screen.findByTestId('timeline')).toBeTruthy();
	});

	it.each([
		'/sessions/consultant/sessionView/session/41?topicDuplicate=1&caseHandoverRequestId=501',
		`${path}?topicDuplicate=1&topicDuplicate=1`
	])(
		'does not mount an invalid or overloaded strict route',
		async (initialPath) => {
			renderMarked(initialPath);
			expect(await screen.findByTestId('timeline')).toBeTruthy();
			expect(useSession).not.toHaveBeenCalled();
			expect(apiGetCaseHandoverRequestStatus).not.toHaveBeenCalled();
		}
	);

	it('clears the prior conversation before loading the same case in strict mode', async () => {
		const useSessionMount: typeof useSession = (room) => {
			const [session] = React.useState(() =>
				typeof room === 'string'
					? ({ item: { id: 41, status: 2 }, isGroup: false } as never)
					: null
			);
			return {
				session,
				ready: session !== null,
				reload: vi.fn(),
				read: vi.fn()
			};
		};
		vi.mocked(useSession).mockImplementation(useSessionMount);
		renderMarked(path);
		await screen.findByTestId('session-stream');
		fireEvent.click(screen.getByRole('link', { name: 'Open strict room' }));
		expect(screen.queryByTestId('session-stream')).toBeNull();
		expect(screen.getByTestId('loading')).toBeTruthy();
	});
});
