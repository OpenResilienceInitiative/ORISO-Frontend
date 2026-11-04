// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../../globalState';
import { useAppointmentActions } from './useAppointmentActions';
import type { FutureEntry } from './timelineModel';

const { cancel, send, navigate } = vi.hoisted(() => ({
	cancel: vi.fn(),
	send: vi.fn(),
	navigate: vi.fn()
}));
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiCancelSessionAppointment: cancel
}));
vi.mock('../../../api/apiSendMessage', () => ({ apiSendMessage: send }));
vi.mock('react-router-dom', async (original) => ({
	...(await original<typeof import('react-router-dom')>()),
	useNavigate: () => navigate
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const entry: FutureEntry = {
	key: 'booking-a',
	kind: 'one-to-one',
	sessionId: 4,
	matrixRoomId: '!room:x',
	title: 'Yak',
	start: new Date('2026-11-03T10:00:00Z'),
	end: new Date('2026-11-03T11:00:00Z'),
	modality: 'chat',
	canDuplicate: false,
	booking: { id: 'a', appointmentId: 'a' }
};

const setup = (options: Parameters<typeof useAppointmentActions>[0]) => {
	const addNotification = vi.fn();
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<MemoryRouter>
			<NotificationsContext.Provider value={{ addNotification } as never}>
				<UserDataContext.Provider value={{ userData: {} } as never}>
					<SessionTypeContext.Provider
						value={{ path: '/sessions' } as never}
					>
						{children}
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
	const { result } = renderHook(() => useAppointmentActions(options), {
		wrapper
	});
	return { run: result.current, addNotification };
};
const settle = () => act(() => new Promise((r) => setTimeout(r)));

describe('useAppointmentActions for a 1:1 appointment', () => {
	beforeEach(() => {
		cancel.mockReset().mockResolvedValue({});
		send.mockReset().mockResolvedValue({});
		navigate.mockReset();
	});
	afterEach(cleanup);

	it('cancels through the API, reports it and leaves a notice in the room', async () => {
		const onCancelled = vi.fn();
		const { run } = setup({ onCancelled });
		run('cancel', entry);
		await settle();
		expect(cancel).toHaveBeenCalledWith(4, 'a');
		expect(onCancelled).toHaveBeenCalledWith(entry);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toBe(
			'sessionList.timeline.appointment.notice.cancelled'
		);
		expect(send.mock.calls[0][5]).toBe('!room:x');
		expect(navigate).not.toHaveBeenCalled();
	});

	it('a failed notice keeps the cancellation and tells the person', async () => {
		send.mockRejectedValue(new Error('offline'));
		const onCancelled = vi.fn();
		const { run, addNotification } = setup({ onCancelled });
		run('cancel', entry);
		await settle();
		expect(onCancelled).toHaveBeenCalled();
		expect(addNotification.mock.calls[0][0].title).toBe(
			'sessionList.timeline.appointment.noticeFailed.title'
		);
	});

	it('a failed cancel sends no notice and tells the person', async () => {
		cancel.mockRejectedValue(new Error('CATCH_ALL'));
		const onCancelled = vi.fn();
		const { run, addNotification } = setup({ onCancelled });
		run('cancel', entry);
		await settle();
		expect(onCancelled).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
		expect(addNotification.mock.calls[0][0].title).toBe(
			'sessionList.timeline.appointment.cancelFailed.title'
		);
	});

	it('moving opens the date dialog, never the /booking page', () => {
		const onMove = vi.fn();
		const { run } = setup({ onMove });
		run('reschedule', entry);
		expect(onMove).toHaveBeenCalledWith(entry);
		expect(navigate).not.toHaveBeenCalled();
	});
});
