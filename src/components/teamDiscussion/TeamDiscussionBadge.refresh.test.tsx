// @vitest-environment oriso-jsdom
/** FE#2491: the list badge follows a switch on/off made in the open case. */
import * as React from 'react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { apiGetTeamDiscussion } from '../../api/apiTeamDiscussion';
import {
	invalidateTeamDiscussionCache,
	primeTeamDiscussionCache
} from '../../services/teamDiscussionCache';
import { TeamDiscussionBadge } from './TeamDiscussionBadge';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api/apiTeamDiscussion', () => ({
	apiGetTeamDiscussion: vi.fn()
}));

const SESSION_ID = 4711;
const discussion = (status: 'OPEN' | 'CLOSED' | 'ARCHIVED') => ({
	matrixRoomId: '!team:example.org',
	status,
	archiveDate: null,
	closedDate: status === 'CLOSED' ? '2026-11-23T10:00:00Z' : null
});

beforeEach(() => {
	invalidateTeamDiscussionCache(SESSION_ID);
	vi.mocked(apiGetTeamDiscussion).mockReset();
});
afterEach(cleanup);

describe('TeamDiscussionBadge refresh (FE#2491)', () => {
	it('appears when the team chat is switched on elsewhere', async () => {
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue(null);
		render(
			<TeamDiscussionBadge sessionId={SESSION_ID} onOpen={() => {}} />
		);
		await waitFor(() =>
			expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(1)
		);
		expect(screen.queryByRole('button')).toBeNull();

		act(() => {
			primeTeamDiscussionCache(SESSION_ID, discussion('OPEN') as any);
		});
		await waitFor(() => expect(screen.getByRole('button')).toBeTruthy());
		// Primed state is used as is: no second lookup.
		expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(1);
	});

	it('disappears when the team chat is switched off elsewhere', async () => {
		vi.mocked(apiGetTeamDiscussion)
			.mockResolvedValueOnce(discussion('OPEN') as any)
			.mockResolvedValueOnce(discussion('CLOSED') as any);
		const { container } = render(
			<TeamDiscussionBadge sessionId={SESSION_ID} />
		);
		await waitFor(() => expect(container.firstChild).not.toBeNull());

		act(() => {
			invalidateTeamDiscussionCache(SESSION_ID);
		});
		await waitFor(() => expect(container.firstChild).toBeNull());
		expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(2);
	});

	it('ignores changes to other sessions', async () => {
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue(
			discussion('OPEN') as any
		);
		const { container } = render(
			<TeamDiscussionBadge sessionId={SESSION_ID} />
		);
		await waitFor(() => expect(container.firstChild).not.toBeNull());
		act(() => {
			invalidateTeamDiscussionCache(SESSION_ID + 1);
		});
		expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(1);
	});

	it('is not shown for an archived team chat (FE#2494: OPEN only)', async () => {
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue(
			discussion('ARCHIVED') as any
		);
		render(
			<TeamDiscussionBadge sessionId={SESSION_ID} onOpen={() => {}} />
		);
		await waitFor(() =>
			expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(1)
		);
		await act(async () => {});
		expect(screen.queryByRole('button')).toBeNull();
	});
});
