// @vitest-environment jsdom
import * as React from 'react';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { AgencySpecificContext, LocaleContext } from '../../globalState';
import { StageLayout } from './StageLayout';
import { AuthenticatedBuildIdentityBoundary } from '../app/BuildIdentity';
import { GroupEntryRoom } from '../groupChat/entryRoom/GroupEntryRoom';
import { GroupWaitingRoom } from '../groupChat/entryRoom/GroupWaitingRoom';
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		urls: { toLogin: '/login', toRegistration: '/registration' }
	})
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));
vi.mock('../registration/infoDrawer/InfoDrawer', () => ({
	InfoDrawer: () => null
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('../stage/stage', () => ({ Stage: () => <div /> }));
afterEach(() => {
	cleanup();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});
const wrap = (child: React.ReactNode, initialPath = '/') => (
	<MemoryRouter initialEntries={[initialPath]}>
		<LocaleContext.Provider value={{ selectableLocales: [] } as any}>
			<AgencySpecificContext.Provider
				value={{ specificAgency: null } as any}
			>
				{child}
			</AgencySpecificContext.Provider>
		</LocaleContext.Provider>
	</MemoryRouter>
);
it('public build-only label owns exactly one identity without requiring legal links or release', () => {
	vi.stubEnv('REACT_APP_PLATFORM_VERSION', '');
	vi.stubEnv(
		'REACT_APP_BUILD_COMMIT',
		'abcdef0123456789abcdef0123456789abcdef01'
	);
	const { container } = render(
		wrap(
			<StageLayout stage={<div />}>
				<p>Public content</p>
			</StageLayout>
		)
	);
	expect(container.querySelectorAll('[data-build-commit]').length).toBe(1);
	expect(screen.getByTestId('build-identity').textContent).toBe('abcdef0');
});
it('authenticated waiting-room composition has one identity', () => {
	vi.stubEnv('REACT_APP_PLATFORM_VERSION', 'v2.0.6');
	vi.stubEnv(
		'REACT_APP_BUILD_COMMIT',
		'abcdef0123456789abcdef0123456789abcdef01'
	);
	// Exact ownership composition: AuthenticatedApp ready branch renders Routing
	// under its authenticated identity boundary. /groups/:chatId/entry resolves GroupEntryRoom,
	// which on successful loading renders this real GroupWaitingRoom subtree.
	// Authentication, fetching, router dispatch, CSS and browser layout are not executed here.
	const { container } = render(
		wrap(
			<AuthenticatedBuildIdentityBoundary>
				<GroupWaitingRoom
					plannedStart={null}
					eventId={42}
					rules={[]}
					active={false}
					onJoin={() => {}}
					nowMs={0}
				/>
			</AuthenticatedBuildIdentityBoundary>
		)
	);
	const identities = [...container.querySelectorAll('[data-build-commit]')];
	console.log(
		'WAITING_ROOM_IDENTITIES',
		identities.map((e) => ({
			html: e.outerHTML,
			owner: e.closest('.stageLayout__footer, .app__platformVersion')
				?.className
		}))
	);
	expect(identities.length).toBe(1);
});

const apiState = vi.hoisted(() => ({
	list: vi.fn(),
	room: vi.fn()
}));
vi.mock('../../api', () => ({
	apiGetAskerSessionList: apiState.list,
	apiGetGroupChatInfo: vi.fn(() => Promise.resolve({ active: false })),
	apiPutGroupChat: vi.fn(),
	GROUP_CHAT_API: { JOIN: '/join' }
}));
vi.mock('../../api/apiGetChatRoomById', () => ({
	apiGetChatRoomById: apiState.room
}));
vi.mock('../groupChat/useGroupChatAuthorContent', () => ({
	useGroupChatAuthorContent: () => ({ hintMessage: '', rules: [] })
}));
beforeEach(() => {
	vi.stubEnv('REACT_APP_PLATFORM_VERSION', 'v2.0.6');
	vi.stubEnv(
		'REACT_APP_BUILD_COMMIT',
		'abcdef0123456789abcdef0123456789abcdef01'
	);
	apiState.list.mockReset();
	apiState.room.mockReset().mockResolvedValue({ sessions: [] });
});
const assertSingleIdentity = (owner: 'stage' | 'authenticated') => {
	const identities = screen.getAllByTestId('build-identity');
	expect(identities).toHaveLength(1);
	expect(identities[0].getAttribute('data-build-commit')).toBe(
		'abcdef0123456789abcdef0123456789abcdef01'
	);
	expect(
		identities[0].closest(
			owner === 'stage'
				? '.stageLayout__footer--withIdentity'
				: '.app__platformVersion'
		)
	).not.toBeNull();
};
it('keeps a standalone waiting room identity without an authenticated owner', () => {
	render(
		wrap(
			<GroupWaitingRoom
				plannedStart={null}
				eventId={42}
				rules={[]}
				active={false}
				onJoin={() => {}}
				nowMs={0}
			/>
		)
	);
	assertSingleIdentity('stage');
});
it('keeps an ordinary authenticated route identity', () => {
	render(
		wrap(
			<AuthenticatedBuildIdentityBoundary>
				<p>Ordinary route</p>
			</AuthenticatedBuildIdentityBoundary>
		)
	);
	assertSingleIdentity('authenticated');
});
it('leaves public ownership intact when an authenticated tree is unmounted', () => {
	const { unmount } = render(
		wrap(
			<AuthenticatedBuildIdentityBoundary>
				<StageLayout stage={<div />}>
					<p>Inside shell</p>
				</StageLayout>
			</AuthenticatedBuildIdentityBoundary>
		)
	);
	assertSingleIdentity('stage');
	expect(document.querySelector('.app__platformVersion')).toBeNull();
	unmount();
	render(
		wrap(
			<StageLayout stage={<div />}>
				<p>Public again</p>
			</StageLayout>
		)
	);
	assertSingleIdentity('stage');
});
// Real router dispatch, GroupEntryRoom state, GroupWaitingRoom and StageLayout;
// only network/author content and unrelated artwork/config are substituted.
it.each(['ready', 'missing', 'failed'] as const)(
	'keeps one identity across the actual entry route loading -> %s transition',
	async (state) => {
		let resolveList: (value: {
			sessions: Array<{ chat: { id: number; active: boolean } }>;
		}) => void;
		let rejectList: (reason: Error) => void;
		apiState.list.mockImplementation(
			() =>
				new Promise((resolve, reject) => {
					resolveList = resolve;
					rejectList = reject;
				})
		);
		const { container } = render(
			wrap(
				<AuthenticatedBuildIdentityBoundary>
					<Routes>
						<Route
							path="/groups/:chatId/entry"
							element={<GroupEntryRoom />}
						/>
					</Routes>
				</AuthenticatedBuildIdentityBoundary>,
				'/groups/42/entry'
			)
		);
		await waitFor(() =>
			expect(
				container.querySelector('[data-cy="group-entry-loading"]')
			).not.toBeNull()
		);
		assertSingleIdentity('authenticated');
		if (state === 'failed') rejectList(new Error('offline'));
		else
			resolveList({
				sessions:
					state === 'ready'
						? [{ chat: { id: 42, active: false } }]
						: []
			});
		await waitFor(() =>
			expect(
				container.querySelector(
					state === 'ready'
						? '[data-cy="group-entry-room"]'
						: '[data-cy="group-entry-missing"]'
				)
			).not.toBeNull()
		);
		assertSingleIdentity(state === 'ready' ? 'stage' : 'authenticated');
		expect(
			container.querySelectorAll('.stageLayout__footer--withIdentity')
		).toHaveLength(state === 'ready' ? 1 : 0);
	}
);

// F5: uniqueness alone missed the fixed shell footer behind the real Join bar.
it('places the single nested waiting identity in the stage footer outside its action bar', () => {
	render(
		wrap(
			<AuthenticatedBuildIdentityBoundary>
				<GroupWaitingRoom
					plannedStart={new Date('2026-09-17T12:00:00Z')}
					eventId={42}
					rules={[]}
					active
					onJoin={() => {}}
					nowMs={0}
				/>
			</AuthenticatedBuildIdentityBoundary>
		)
	);
	assertSingleIdentity('stage');
	expect(document.querySelector('.app__platformVersion')).toBeNull();
	const identity = screen.getByTestId('build-identity');
	const bar = document.querySelector('[data-cy="registration-footer"]');
	expect(bar).not.toBeNull();
	expect(bar.contains(identity)).toBe(false);
	expect(bar.contains(screen.getByTestId('group-entry-join'))).toBe(true);
	expect(bar.contains(screen.getByTestId('group-entry-calendar'))).toBe(true);
});
it('restores the shell placement after a stage leaves the same boundary, including StrictMode remounts', () => {
	const tree = (stage: boolean) =>
		wrap(
			<React.StrictMode>
				<AuthenticatedBuildIdentityBoundary>
					{stage ? (
						<StageLayout stage={<div />}>
							<p>Stage route</p>
						</StageLayout>
					) : (
						<p>Ordinary route</p>
					)}
				</AuthenticatedBuildIdentityBoundary>
			</React.StrictMode>
		);
	const { rerender } = render(tree(false));
	assertSingleIdentity('authenticated');
	rerender(tree(true));
	assertSingleIdentity('stage');
	expect(document.querySelector('.app__platformVersion')).toBeNull();
	rerender(tree(false));
	assertSingleIdentity('authenticated');
	expect(
		document.querySelector('.stageLayout__footer--withIdentity')
	).toBeNull();
	rerender(tree(true));
	assertSingleIdentity('stage');
});
