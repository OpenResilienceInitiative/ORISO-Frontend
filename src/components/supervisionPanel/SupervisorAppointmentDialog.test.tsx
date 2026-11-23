// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { SupervisorAppointmentDialogWired } from './SupervisorAppointmentDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../form/OrisoCalendar', () => ({ OrisoCalendar: () => null }));
vi.mock('../form/OrisoTimePicker', () => ({ OrisoTimePicker: () => null }));

const api = vi.hoisted(() => ({
	apiGetCalendarColleagues: vi.fn(),
	apiGetCalendarEntries: vi.fn(),
	apiCreateColleagueAppointment: vi.fn()
}));
vi.mock('../../api/apiCalendar', () => api);

const sendNotice = vi.hoisted(() => vi.fn());
vi.mock('../sessionsList/timeline/useAppointmentNotice', () => ({
	useAppointmentNotice: () => sendNotice
}));
const notifyAppointmentsChanged = vi.hoisted(() => vi.fn());
vi.mock('../sessionsList/timeline/conversationAppointments', () => ({
	notifyAppointmentsChanged
}));

const SUPERVISOR = { id: 'sup-1', displayName: 'B. Supervisor' };
const colleagueDto = (id: string) => ({
	id,
	displayName: 'B. Supervisor',
	agencyName: 'Nord',
	relation: 'SAME_AGENCY'
});

const renderDialog = (onClose = vi.fn()) =>
	render(
		<SupervisorAppointmentDialogWired
			supervisor={SUPERVISOR}
			ownerId="me"
			onClose={onClose}
		/>
	);

beforeEach(() => {
	api.apiGetCalendarEntries.mockResolvedValue([]);
	api.apiCreateColleagueAppointment.mockResolvedValue({
		matrixRoomId: '!internal:oriso',
		chatId: 77
	});
});
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('SupervisorAppointmentDialog (FE#2494)', () => {
	it('books the supervisor as colleague, announces it and closes', async () => {
		api.apiGetCalendarColleagues.mockResolvedValue({
			colleagues: [colleagueDto('sup-1')]
		});
		const onClose = vi.fn();
		renderDialog(onClose);

		expect(screen.getByText('B. Supervisor')).toBeTruthy();
		const save = await screen.findByTestId('calendar-appointment-save');
		await waitFor(() =>
			expect((save as HTMLButtonElement).disabled).toBe(false)
		);
		fireEvent.click(save);

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(api.apiCreateColleagueAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ colleagueId: 'sup-1', kind: 'VIDEO' })
		);
		expect(notifyAppointmentsChanged).toHaveBeenCalled();
		expect(sendNotice).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'created',
				sessionId: 77,
				matrixRoomId: '!internal:oriso'
			})
		);
	});

	it('offers no save when the supervisor is outside the calendar reach', async () => {
		api.apiGetCalendarColleagues.mockResolvedValue({
			colleagues: [colleagueDto('someone-else')]
		});
		renderDialog();

		expect(
			await screen.findByText('supervision.appointment.unreachable')
		).toBeTruthy();
		expect(screen.queryByTestId('calendar-appointment-save')).toBeNull();
	});

	it('keeps the dialog open with a message when saving fails', async () => {
		api.apiGetCalendarColleagues.mockResolvedValue({
			colleagues: [colleagueDto('sup-1')]
		});
		api.apiCreateColleagueAppointment.mockRejectedValue(new Error('500'));
		const onClose = vi.fn();
		renderDialog(onClose);

		const save = await screen.findByTestId('calendar-appointment-save');
		await waitFor(() =>
			expect((save as HTMLButtonElement).disabled).toBe(false)
		);
		fireEvent.click(save);

		expect(
			await screen.findByText('supervision.appointment.failed')
		).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();
	});
});
