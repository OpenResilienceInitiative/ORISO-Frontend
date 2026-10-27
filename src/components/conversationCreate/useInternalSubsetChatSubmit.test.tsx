// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	apiCreateInternalSubsetChat,
	InternalSubsetChatError,
	INTERNAL_SUBSET_REASON
} from '../../api/apiCreateInternalSubsetChat';
import { apiCreateGroupChat } from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { NotificationsContext, SessionsDataContext } from '../../globalState';
import { useInternalSubsetChatSubmit } from './useInternalSubsetChatSubmit';

// The globalState barrel transitively pulls lottie-web (crashes in jsdom), so
// mock it down to just what the hook consumes.
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		NotificationsContext: react.createContext(null),
		SessionsDataContext: react.createContext({ dispatch: () => {} }),
		UPDATE_SESSIONS: 'UPDATE_SESSIONS'
	};
});
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api/apiCreateInternalSubsetChat', async () => {
	const actual = await vi.importActual<
		typeof import('../../api/apiCreateInternalSubsetChat')
	>('../../api/apiCreateInternalSubsetChat');
	return { ...actual, apiCreateInternalSubsetChat: vi.fn() };
});
vi.mock('../../api/apiGroupChatSettings', () => ({
	apiCreateGroupChat: vi.fn(),
	apiUpdateGroupChat: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: vi.fn()
}));
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<any>('react-router-dom');
	return { ...actual, useNavigate: () => navigate };
});

const dispatch = vi.fn();
const addNotification = vi.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => (
	<MemoryRouter>
		<NotificationsContext.Provider value={{ addNotification } as any}>
			<SessionsDataContext.Provider
				value={{ sessions: [], dispatch } as any}
			>
				{children}
			</SessionsDataContext.Provider>
		</NotificationsContext.Provider>
	</MemoryRouter>
);

const request = {
	selectedIds: ['colleague-1'],
	agencyId: 410,
	name: '  Fallbesprechung  '
};
const room = { matrixRoomId: '!abc:matrix.test', chatId: 123, reused: false };

describe('useInternalSubsetChatSubmit', () => {
	afterEach(() => vi.clearAllMocks());

	it('asks for a room with exactly the selected colleagues and nobody else', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue(room);
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(apiCreateInternalSubsetChat).toHaveBeenCalledWith({
			consultantIds: ['colleague-1'],
			agencyId: 410,
			topic: 'Fallbesprechung'
		});
	});

	it('never creates the ordinary room that every colleague of the centre can open', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue(room);
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(apiCreateGroupChat).not.toHaveBeenCalled();
	});

	it('refreshes the session list and opens the dedicated room', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue(room);
		const sessions = [
			{ chat: { id: 123, matrixRoomId: '!abc:matrix.test' } }
		];
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions
		} as any);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(apiGetSessionRoomsByRoomIds).toHaveBeenCalledWith([
			'!abc:matrix.test'
		]);
		expect(dispatch).toHaveBeenCalledWith({
			type: 'UPDATE_SESSIONS',
			sessions
		});
		expect(navigate).toHaveBeenCalledWith(
			'/sessions/consultant/sessionView/!abc%3Amatrix.test/123'
		);
	});

	it('still opens the room when only the list refresh fails', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue(room);
		vi.mocked(apiGetSessionRoomsByRoomIds).mockRejectedValue(
			new Error('x')
		);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(result.current.errorReason).toBeNull();
	});

	it('says so when an existing room with exactly these people was opened', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue({
			...room,
			reused: true
		});
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				notificationType: 'info',
				title: 'groupChat.internal.reusedNotice.title',
				text: 'groupChat.internal.reusedNotice.text'
			})
		);
	});

	it('does not announce anything for a newly created room', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue(room);
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => result.current.submit(request));

		await waitFor(() => expect(navigate).toHaveBeenCalled());
		expect(addNotification).not.toHaveBeenCalled();
	});

	it.each(Object.values(INTERNAL_SUBSET_REASON))(
		'keeps the counsellor on the picker and names the refusal %s',
		async (reason) => {
			vi.mocked(apiCreateInternalSubsetChat).mockRejectedValue(
				new InternalSubsetChatError(reason, 403)
			);
			const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
				wrapper
			});

			await act(async () => result.current.submit(request));

			await waitFor(() =>
				expect(result.current.errorReason).toBe(reason)
			);
			expect(navigate).not.toHaveBeenCalled();
			expect(apiGetSessionRoomsByRoomIds).not.toHaveBeenCalled();
			expect(apiCreateGroupChat).not.toHaveBeenCalled();
		}
	);

	it('reports an unexpected failure as the generic refusal', async () => {
		vi.mocked(apiCreateInternalSubsetChat).mockRejectedValue(
			new Error('x')
		);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		await act(async () => result.current.submit(request));

		await waitFor(() =>
			expect(result.current.errorReason).toBe(
				INTERNAL_SUBSET_REASON.UNKNOWN
			)
		);
	});

	it('locks out a synchronous duplicate submit', () => {
		vi.mocked(apiCreateInternalSubsetChat).mockReturnValue(
			new Promise(() => {})
		);
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		act(() => {
			result.current.submit(request);
			result.current.submit(request);
		});

		expect(apiCreateInternalSubsetChat).toHaveBeenCalledTimes(1);
	});

	it('frees the lock after a refusal so the counsellor can retry, and clears the message', async () => {
		vi.mocked(apiCreateInternalSubsetChat)
			.mockRejectedValueOnce(
				new InternalSubsetChatError(
					INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED,
					502
				)
			)
			.mockReturnValueOnce(new Promise(() => {}));
		const { result } = renderHook(() => useInternalSubsetChatSubmit(), {
			wrapper
		});

		await act(async () => result.current.submit(request));
		await waitFor(() => expect(result.current.errorReason).not.toBeNull());

		act(() => result.current.submit(request));

		expect(apiCreateInternalSubsetChat).toHaveBeenCalledTimes(2);
		expect(result.current.errorReason).toBeNull();
	});
});
