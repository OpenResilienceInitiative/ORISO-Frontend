// @vitest-environment oriso-jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

import { NotificationsContext } from '../../globalState';
import { useSessionPassageBlur } from './useSessionPassageBlur';

const transport = vi.hoisted(() => ({
	sendPassageBlur: vi.fn(),
	redactMessage: vi.fn(),
	getMatrixRoom: vi.fn()
}));
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: transport
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const addNotification = vi.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => (
	<NotificationsContext.Provider value={{ addNotification } as any}>
		{children}
	</NotificationsContext.Provider>
);

const moderator = {
	matrixRoomId: '!room:hs',
	activeSession: { consultant: { id: 'u-me' } },
	userData: { userId: 'u-me' },
	isConsultant: true,
	isSupervisorView: false
};

beforeEach(() => {
	vi.clearAllMocks();
	transport.sendPassageBlur.mockResolvedValue({ event_id: '$blur' });
	transport.redactMessage.mockResolvedValue({});
});

describe('useSessionPassageBlur', () => {
	it('sends the position of a marked passage as a blur', async () => {
		const { result } = renderHook(() => useSessionPassageBlur(moderator), {
			wrapper
		});
		expect(result.current.canBlur).toBe(true);

		await act(async () => {
			result.current.onBlurPassage!(
				{ eventId: '$msg' },
				{ start: 4, length: 9 }
			);
		});

		expect(transport.sendPassageBlur).toHaveBeenCalledWith({
			matrixRoomId: '!room:hs',
			targetEventId: '$msg',
			start: 4,
			length: 9
		});
	});

	it('lifts a blur by redacting its event and names who blurred it', async () => {
		transport.getMatrixRoom.mockReturnValue({
			getMember: (id: string) =>
				id === '@mod:hs' ? { name: 'Krusty' } : null
		});
		const { result } = renderHook(
			() =>
				useSessionPassageBlur({
					...moderator,
					blurSenders: new Map([['$blur', '@mod:hs']])
				}),
			{ wrapper }
		);

		expect(result.current.blurredByFor('$msg', '$blur')).toBe('Krusty');
		await act(async () => {
			result.current.onRemoveBlur!('$msg', '$blur');
		});
		expect(transport.redactMessage).toHaveBeenCalledWith({
			matrixRoomId: '!room:hs',
			targetEventId: '$blur',
			// #2494 *9: the chat shows "Schwärzung aufgehoben", not "gelöscht".
			reason: 'org.oriso.passage_blur.removed $msg'
		});
	});

	it('says so when the blur could not be saved', async () => {
		transport.sendPassageBlur.mockRejectedValue(new Error('403'));
		const { result } = renderHook(() => useSessionPassageBlur(moderator), {
			wrapper
		});

		await act(async () => {
			result.current.onBlurPassage!(
				{ eventId: '$msg' },
				{ start: 0, length: 3 }
			);
		});

		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				notificationType: 'error',
				title: 'message.selectionReply.blurFailed.title'
			})
		);
	});

	it('offers nothing to an advice seeker', () => {
		const { result } = renderHook(
			() => useSessionPassageBlur({ ...moderator, isConsultant: false }),
			{ wrapper }
		);
		expect(result.current.canBlur).toBe(false);
		expect(result.current.onBlurPassage).toBeUndefined();
		expect(result.current.onRemoveBlur).toBeUndefined();
	});
});
