// @vitest-environment oriso-jsdom
/**
 * FE#1960 follow-up: "Termin anlegen" lives in the conversation's ⋮ menu.
 * The row under the header shows only an existing appointment (ADR-021 §5);
 * without one, the header stays as it was.
 */
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	UserDataContext
} from '../../../globalState';
import { ConversationAppointmentSlot } from './ConversationAppointmentSlot';
import { notifyAppointmentsChanged } from './conversationAppointments';
import { useAppointmentCreate } from './appointmentCreateBridge';

const { getAppointments } = vi.hoisted(() => ({ getAppointments: vi.fn() }));
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiGetSessionAppointments: getAppointments
}));
vi.mock('./AppointmentDateDialog', () => ({
	AppointmentDateDialog: () => <div data-testid="appointment-date-dialog" />
}));
vi.mock('./useAppointmentActions', () => ({
	useAppointmentActions: () => vi.fn()
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const upcoming = () => {
	const start = new Date(Date.now() + 2 * 24 * 3600 * 1000);
	return {
		id: 'a1',
		sessionId: 4401,
		startTime: start.toISOString(),
		endTime: new Date(start.getTime() + 3600 * 1000).toISOString(),
		status: 'SCHEDULED',
		counterpart: { username: 'ruhiges_yak_kim' }
	};
};

/** What a chat card in this conversation borrows. */
const Borrower = () => {
	const loan = useAppointmentCreate(4401);
	return (
		<div data-testid="loan">
			{loan ? (loan.hasUpcoming ? 'upcoming' : 'free') : 'none'}
		</div>
	);
};

const renderSlot = (
	onCreateChange: (open?: () => void) => void,
	canChange = true
) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: 'c1',
						grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
					}
				} as never
			}
		>
			<ActiveSessionContext.Provider
				value={
					{
						activeSession: {
							item: { id: 4401, matrixRoomId: '!r:x' },
							rid: '!r:x'
						}
					} as never
				}
			>
				<ConversationAppointmentSlot
					canChange={canChange}
					onCreateChange={onCreateChange}
				/>
				<Borrower />
			</ActiveSessionContext.Provider>
		</UserDataContext.Provider>
	);

afterEach(() => {
	cleanup();
	getAppointments.mockReset();
});

describe('ConversationAppointmentSlot', () => {
	it('shows no row and no create button without an appointment', async () => {
		getAppointments.mockResolvedValue([]);
		const onCreateChange = vi.fn();
		const { container } = renderSlot(onCreateChange);
		await waitFor(() =>
			expect(onCreateChange).toHaveBeenLastCalledWith(
				expect.any(Function)
			)
		);
		expect(
			container.querySelector('[data-cy="room-next-appointment"]')
		).toBeNull();
		expect(
			container.querySelector(
				'[data-cy="create-conversation-appointment"]'
			)
		).toBeNull();
	});

	it('opens the create dialog through the opener it hands to the menu', async () => {
		getAppointments.mockResolvedValue([]);
		const onCreateChange = vi.fn();
		renderSlot(onCreateChange);
		await waitFor(() =>
			expect(onCreateChange).toHaveBeenLastCalledWith(
				expect.any(Function)
			)
		);
		act(() => onCreateChange.mock.lastCall![0]());
		expect(screen.getByTestId('appointment-date-dialog')).toBeTruthy();
	});

	it('keeps the open dialog when a refresh after saving fails (FE#2279 review)', async () => {
		// A refused link keeps the saved appointment in the dialog for the
		// retry and asks for a refresh; a failed refresh must not unmount it.
		getAppointments.mockResolvedValue([]);
		const onCreateChange = vi.fn();
		renderSlot(onCreateChange);
		await waitFor(() =>
			expect(onCreateChange).toHaveBeenLastCalledWith(
				expect.any(Function)
			)
		);
		act(() => onCreateChange.mock.lastCall![0]());
		getAppointments.mockRejectedValue(new Error('503'));
		await act(async () => notifyAppointmentsChanged());
		expect(getAppointments).toHaveBeenCalledTimes(2);
		expect(screen.getByTestId('appointment-date-dialog')).toBeTruthy();
		expect(onCreateChange).toHaveBeenLastCalledWith(expect.any(Function));
	});

	it('shows the next appointment without a create button beside it', async () => {
		getAppointments.mockResolvedValue([upcoming()]);
		const { container } = renderSlot(vi.fn());
		await waitFor(() =>
			expect(
				container.querySelector('[data-cy="room-next-appointment"]')
			).not.toBeNull()
		);
		expect(
			container.querySelector(
				'[data-cy="create-conversation-appointment"]'
			)
		).toBeNull();
	});

	it('offers no opener when the backend has no appointment endpoint', async () => {
		getAppointments.mockRejectedValue(new Error('404'));
		const onCreateChange = vi.fn();
		renderSlot(onCreateChange);
		await act(async () => undefined);
		expect(onCreateChange).not.toHaveBeenCalledWith(expect.any(Function));
	});

	it('offers no opener to someone who may not change appointments', async () => {
		getAppointments.mockResolvedValue([]);
		const onCreateChange = vi.fn();
		renderSlot(onCreateChange, false);
		await act(async () => undefined);
		expect(onCreateChange).not.toHaveBeenCalledWith(expect.any(Function));
	});

	it('lends the chat cards its create dialog, saying whether one is booked', async () => {
		getAppointments.mockResolvedValue([]);
		renderSlot(vi.fn());
		await waitFor(() =>
			expect(screen.getByTestId('loan').textContent).toBe('free')
		);
		cleanup();
		getAppointments.mockResolvedValue([upcoming()]);
		renderSlot(vi.fn());
		await waitFor(() =>
			expect(screen.getByTestId('loan').textContent).toBe('upcoming')
		);
	});

	it('lends nothing to someone who may not change appointments', async () => {
		getAppointments.mockResolvedValue([]);
		renderSlot(vi.fn(), false);
		await act(async () => undefined);
		expect(screen.getByTestId('loan').textContent).toBe('none');
	});

	it('takes the dialog back when the room closes', async () => {
		getAppointments.mockResolvedValue([]);
		renderSlot(vi.fn());
		await waitFor(() =>
			expect(screen.getByTestId('loan').textContent).toBe('free')
		);
		cleanup();
		render(<Borrower />);
		expect(screen.getByTestId('loan').textContent).toBe('none');
	});
});
