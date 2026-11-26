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
import {
	SupervisorAppointmentDialog,
	SupervisorAppointmentDialogWired
} from './SupervisorAppointmentDialog';
import type { CallFeatureGates } from '../call/callFeatureGates';

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

const SUPERVISION_ROOM = { sessionId: 12, matrixRoomId: '!supervision:oriso' };

const renderDialog = (onClose = vi.fn()) =>
	render(
		<SupervisorAppointmentDialogWired
			supervisor={SUPERVISOR}
			ownerId="me"
			supervisionRoom={SUPERVISION_ROOM}
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
		// Frank 2026-11-24: the card shows in the Supervision room too.
		expect(sendNotice).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'created',
				...SUPERVISION_ROOM,
				feedbackMailIntent: true
			})
		);
		// The private chat of the two has no advice seeker: generic path.
		const internal = sendNotice.mock.calls.find(
			([n]) => n.matrixRoomId === '!internal:oriso'
		)?.[0];
		expect(internal?.feedbackMailIntent).toBeUndefined();
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

/*
 * Product owner, 2026-11-25: video and phone appointments only where video
 * and audio calls are allowed in the supervision chat.
 */
describe('SupervisorAppointmentDialog: supervision call gates', () => {
	const renderGated = (callGates: CallFeatureGates) => {
		const onSave = vi.fn();
		render(
			<SupervisorAppointmentDialog
				supervisor={SUPERVISOR}
				ownerId="me"
				colleagues={[
					{
						...SUPERVISOR,
						agencyName: 'Nord',
						relation: 'sameAgency'
					}
				]}
				entries={[]}
				now={new Date(2026, 10, 25, 12, 0)}
				callGates={callGates}
				onSave={onSave}
				onClose={vi.fn()}
			/>
		);
		return onSave;
	};
	const tile = (kind: string) =>
		screen.queryByRole('button', { name: `calendar.kinds.${kind}` });
	const savedKind = (onSave: ReturnType<typeof vi.fn>) => {
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
		expect(onSave).toHaveBeenCalledTimes(1);
		return onSave.mock.calls[0][0].kind;
	};

	it('offers video and phone when both calls are allowed', () => {
		const onSave = renderGated({ video: true, audio: true });
		expect(tile('video')).toBeTruthy();
		expect(tile('phone')).toBeTruthy();
		expect(tile('onsite')).toBeTruthy();
		expect(tile('chat')).toBeTruthy();
		expect(savedKind(onSave)).toBe('video');
	});

	it('offers no video tile when video calls are off', () => {
		const onSave = renderGated({ video: false, audio: true });
		expect(tile('video')).toBeNull();
		expect(tile('phone')).toBeTruthy();
		expect(tile('onsite')).toBeTruthy();
		expect(tile('chat')).toBeTruthy();
		expect(savedKind(onSave)).toBe('phone');
	});

	it('offers no phone tile when audio calls are off', () => {
		const onSave = renderGated({ video: true, audio: false });
		expect(tile('video')).toBeTruthy();
		expect(tile('phone')).toBeNull();
		expect(savedKind(onSave)).toBe('video');
	});

	it('offers neither video nor phone when both calls are off', () => {
		const onSave = renderGated({ video: false, audio: false });
		expect(tile('video')).toBeNull();
		expect(tile('phone')).toBeNull();
		expect(tile('onsite')).toBeTruthy();
		expect(tile('chat')).toBeTruthy();
		const kind = savedKind(onSave);
		expect(kind).not.toBe('video');
		expect(kind).not.toBe('phone');
		expect(kind).toBe('onsite');
	});

	it('passes the gates through the wired dialog', async () => {
		api.apiGetCalendarColleagues.mockResolvedValue({
			colleagues: [colleagueDto('sup-1')]
		});
		const onClose = vi.fn();
		render(
			<SupervisorAppointmentDialogWired
				supervisor={SUPERVISOR}
				ownerId="me"
				callGates={{ video: false, audio: false }}
				onClose={onClose}
			/>
		);
		const save = await screen.findByTestId('calendar-appointment-save');
		await waitFor(() =>
			expect((save as HTMLButtonElement).disabled).toBe(false)
		);
		expect(tile('video')).toBeNull();
		fireEvent.click(save);
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(api.apiCreateColleagueAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'ONSITE' })
		);
	});
});
