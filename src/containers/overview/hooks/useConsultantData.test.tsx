// @vitest-environment jsdom
/**
 * Unread axis (#1147) — overview "unread only" data source.
 *
 * The backend hard-codes `messagesRead: true`, so the unread filter must
 * derive read state from the Matrix client instead of the DTO field.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetConsultantSessionList } from '../../../api';
import { setMatrixClientServiceRef } from '../../../services/matrixClientRegistry';
import { useConsultantData } from './useConsultantData';

vi.mock('../../../api', () => ({
	apiGetConsultantSessionList: vi.fn()
}));

describe('useConsultantData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		setMatrixClientServiceRef(null);
	});

	it('keeps only sessions with unread Matrix rooms when unReadOnly is set, ignoring the DTO messagesRead constant', async () => {
		setMatrixClientServiceRef({
			getRoom: (roomId: string) => ({
				getUnreadNotificationCount: () =>
					roomId === '!unread:hs' ? 3 : 0
			})
		} as any);
		vi.mocked(apiGetConsultantSessionList).mockResolvedValue({
			count: 2,
			offset: 0,
			total: 2,
			sessions: [
				{
					session: {
						id: 1,
						matrixRoomId: '!unread:hs',
						messagesRead: true
					}
				},
				{
					session: {
						id: 2,
						matrixRoomId: '!read:hs',
						messagesRead: true
					}
				}
			]
		} as any);

		const { result } = renderHook(() =>
			useConsultantData({ type: 2 as any, unReadOnly: true })
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.sessions).toHaveLength(1);
		expect(result.current.sessions[0].session.id).toBe(1);
		expect(result.current.total).toBe(1);
	});
});
