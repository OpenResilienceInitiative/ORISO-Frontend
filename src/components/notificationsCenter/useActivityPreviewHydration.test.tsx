// @vitest-environment oriso-jsdom — the gate reaches the api layer, which reads
// `window` while resolving the API base URL at import time.
import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionsDataContext, UserDataContext } from '../../globalState';
import { resetCaseHandoverPreviewGateCache } from './caseHandoverPreviewGate';
import { useActivityPreviewHydration } from './useActivityPreviewHydration';

const api = vi.hoisted(() => ({
	apiGetCaseHandoverStatus: vi.fn(async () => ({ canViewContent: true }))
}));
vi.mock('../../api/apiCaseHandover', () => api);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(() => {
	resetCaseHandoverPreviewGateCache();
	vi.clearAllMocks();
});

const ME = 'me';
const card = (overrides: Record<string, unknown> = {}): any => ({
	id: 'a1',
	eventType: 'message.new',
	createdAt: '2026-10-28T10:00:00Z',
	sourceSessionId: '13',
	params: { roomRef: '!r:x', matrixEventId: '$e1' },
	...overrides
});
const sessionOwnedBy = (consultantId: string): any => ({
	session: { id: 13, matrixRoomId: '!r:x', groupId: '!r:x', status: 2 },
	consultant: { id: consultantId }
});

const hydrate = (feed: any[], sessions: any[]) => {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<UserDataContext.Provider
			value={
				{ userData: { userId: ME, userRoles: ['consultant'] } } as any
			}
		>
			<SessionsDataContext.Provider value={{ sessions } as any}>
				{children}
			</SessionsDataContext.Provider>
		</UserDataContext.Provider>
	);
	return renderHook(() => useActivityPreviewHydration(feed), { wrapper });
};

describe('useActivityPreviewHydration (#924 / #1888)', () => {
	it('hydrates a card of my own case without asking for a status', () => {
		const { result } = hydrate([card()], [sessionOwnedBy(ME)]);
		expect(result.current.sources).toEqual([
			expect.objectContaining({
				activityEventId: 'a1',
				roomRef: '!r:x',
				matrixEventId: '$e1'
			})
		]);
		expect(api.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
		act(() => result.current.onPreviewChange('a1', 'Hallo', 'text'));
		expect(result.current.visiblePreview('a1')).toEqual({
			text: 'Hallo',
			kind: 'text'
		});
	});

	it('hydrates a colleague’s case only once its status allows it', async () => {
		const { result } = hydrate([card()], [sessionOwnedBy('colleague')]);
		expect(result.current.sources).toEqual([]);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
	});

	it('never hydrates a curtained case', async () => {
		api.apiGetCaseHandoverStatus.mockResolvedValueOnce({
			canViewContent: false
		});
		const { result } = hydrate([card()], [sessionOwnedBy('colleague')]);
		await waitFor(() =>
			expect(api.apiGetCaseHandoverStatus).toHaveBeenCalled()
		);
		expect(result.current.sources).toEqual([]);
		expect(result.current.visiblePreview('a1')).toBeUndefined();
	});

	it('fails closed for a card whose session is not loaded', () => {
		const { result } = hydrate([card({ sourceSessionId: undefined })], []);
		expect(result.current.sources).toEqual([]);
	});

	it('ignores events that carry no message', () => {
		const { result } = hydrate(
			[
				card({ eventType: 'request.new' }),
				card({ id: 'a2', params: {} })
			],
			[sessionOwnedBy(ME)]
		);
		expect(result.current.sources).toEqual([]);
	});
});
