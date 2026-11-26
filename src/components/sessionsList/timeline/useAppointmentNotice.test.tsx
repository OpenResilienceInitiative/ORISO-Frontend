// @vitest-environment oriso-jsdom
/**
 * The conversation notice of an appointment change: the kinds the chat's
 * appointment card draws travel as its payload; a request and its answer
 * (FE#2287) have no card yet and stay a plain sentence.
 */
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { UserDataContext } from '../../../globalState';
import { SYSTEM_NOTIFICATION_PREFIX } from '../../message/messageConstants';
import { useAppointmentNotice } from './useAppointmentNotice';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../../api/apiSendMessage', () => ({ apiSendMessage: send }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

afterEach(() => send.mockReset());

const notice = (
	kind: 'created' | 'declined' | 'expired',
	extra: { feedbackMailIntent?: boolean } = {}
) => {
	send.mockResolvedValue(undefined);
	const { result } = renderHook(() => useAppointmentNotice(), {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<UserDataContext.Provider
				value={{ userData: { userName: 'c1' } } as never}
			>
				{children}
			</UserDataContext.Provider>
		)
	});
	return result.current({
		kind,
		start: new Date('2026-11-18T10:00:00Z'),
		end: new Date('2026-11-18T11:00:00Z'),
		sessionId: 4401,
		matrixRoomId: '!r:x',
		...extra
	});
};

// apiSendMessage(message, room, sendMail, encrypted, sessionId, matrixRoomId,
// threadRoot, supervisorMessage, sender, client, replyTo, mentions,
// teamDiscussion, feedbackMailIntent)
const FEEDBACK_MAIL_ARG = 13;
const TEAM_DISCUSSION_ARG = 12;

describe('useAppointmentNotice', () => {
	it('sends a created appointment as the card payload', async () => {
		await notice('created');
		expect(
			String(send.mock.calls[0][0]).startsWith(SYSTEM_NOTIFICATION_PREFIX)
		).toBe(true);
	});

	it.each(['declined', 'expired'] as const)(
		'sends %s as the plain sentence',
		async (kind) => {
			await notice(kind);
			expect(send.mock.calls[0][0]).toBe(
				`sessionList.timeline.appointment.notice.${kind}`
			);
		}
	);

	it('keeps an ordinary conversation on the generic notification', async () => {
		await notice('created');
		expect(send.mock.calls[0][FEEDBACK_MAIL_ARG]).toBe(false);
	});

	it('sends a Supervision-room notice on the protected mail path', async () => {
		await notice('created', { feedbackMailIntent: true });
		expect(send.mock.calls[0][FEEDBACK_MAIL_ARG]).toBe(true);
		// The protected path is skipped for team discussions.
		expect(send.mock.calls[0][TEAM_DISCUSSION_ARG]).toBe(false);
	});
});
