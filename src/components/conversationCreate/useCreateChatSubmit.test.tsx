// @vitest-environment jsdom
import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateGroupChat,
	apiUpdateGroupChat,
	groupChatSettings
} from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByGroupIds } from '../../api/apiGetSessionRooms';
import { SessionsDataContext } from '../../globalState';
import { useCreateChatSubmit } from './useCreateChatSubmit';

// The globalState barrel transitively pulls lottie-web (crashes in jsdom), so
// mock it down to just what the hook consumes: a dispatch context + constant.
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		SessionsDataContext: react.createContext({ dispatch: () => {} }),
		UPDATE_SESSIONS: 'UPDATE_SESSIONS'
	};
});

vi.mock('../../api/apiGroupChatSettings', () => ({
	apiCreateGroupChat: vi.fn(),
	apiUpdateGroupChat: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByGroupIds: vi.fn()
}));
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<any>('react-router-dom');
	return { ...actual, useNavigate: () => navigate };
});

const payload = { topic: 'Test' } as unknown as groupChatSettings;

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<MemoryRouter>
		<SessionsDataContext.Provider
			value={{ sessions: [], dispatch: vi.fn() } as any}
		>
			{children}
		</SessionsDataContext.Provider>
	</MemoryRouter>
);

describe('useCreateChatSubmit', () => {
	afterEach(() => vi.clearAllMocks());

	it('locks out a synchronous duplicate submit (finding 3)', () => {
		// Never-resolving request keeps the call in flight.
		vi.mocked(apiCreateGroupChat).mockReturnValue(new Promise(() => {}));
		const { result } = renderHook(() => useCreateChatSubmit(), { wrapper });

		act(() => {
			result.current.submit(payload);
			// Second call in the same tick — before any re-render — must be
			// dropped by the synchronous ref lock, not the async state.
			result.current.submit(payload);
		});

		expect(apiCreateGroupChat).toHaveBeenCalledTimes(1);
	});

	it('routes to the update endpoint when a groupChatId is passed', async () => {
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({ groupId: 'g1' });
		vi.mocked(apiGetSessionRoomsByGroupIds).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useCreateChatSubmit(), { wrapper });

		act(() => {
			result.current.submit(payload, { groupChatId: 42 });
		});

		await waitFor(() =>
			expect(apiUpdateGroupChat).toHaveBeenCalledWith(42, payload)
		);
		expect(apiCreateGroupChat).not.toHaveBeenCalled();
	});

	it('frees the lock after a failed submit so a retry can proceed', async () => {
		vi.mocked(apiCreateGroupChat)
			.mockRejectedValueOnce(new Error('boom'))
			.mockReturnValueOnce(new Promise(() => {}));
		const { result } = renderHook(() => useCreateChatSubmit(), { wrapper });

		await act(async () => {
			result.current.submit(payload);
		});
		await waitFor(() => expect(result.current.hasError).toBe(true));

		act(() => {
			result.current.submit(payload);
		});
		expect(apiCreateGroupChat).toHaveBeenCalledTimes(2);
	});
});
