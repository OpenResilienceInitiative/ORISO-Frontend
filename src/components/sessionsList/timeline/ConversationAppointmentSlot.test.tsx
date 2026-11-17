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
import {
	appointmentsEpoch,
	forgetKnownAppointments,
	rememberSessionAppointments,
	rememberUpcomingAppointments
} from './conversationAppointments';
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
	forgetKnownAppointments();
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

	describe('no layout jump on a conversation switch', () => {
		const row = (container: HTMLElement) =>
			container.querySelector('[data-cy="room-next-appointment"]');

		it('draws a known appointment in the first frame, before its own load', () => {
			getAppointments.mockReturnValue(new Promise(() => undefined));
			rememberUpcomingAppointments(
				[upcoming() as never],
				appointmentsEpoch()
			);
			const { container } = renderSlot(vi.fn());
			expect(row(container)).not.toBeNull();
		});

		it('draws no row in the first frame for a conversation the list knows has none', () => {
			getAppointments.mockReturnValue(new Promise(() => undefined));
			rememberUpcomingAppointments(
				[{ ...upcoming(), sessionId: 9999 } as never],
				appointmentsEpoch()
			);
			const { container } = renderSlot(vi.fn());
			expect(row(container)).toBeNull();
		});

		it("lets the conversation's own load replace the guess", async () => {
			rememberUpcomingAppointments(
				[upcoming() as never],
				appointmentsEpoch()
			);
			getAppointments.mockResolvedValue([]);
			const { container } = renderSlot(vi.fn());
			expect(row(container)).not.toBeNull();
			await waitFor(() => expect(row(container)).toBeNull());
		});

		it('prefers the newer of the two sources', async () => {
			rememberUpcomingAppointments(
				[upcoming() as never],
				appointmentsEpoch()
			);
			rememberSessionAppointments(4401, [], appointmentsEpoch());
			getAppointments.mockReturnValue(new Promise(() => undefined));
			const { container } = renderSlot(vi.fn());
			expect(row(container)).toBeNull();
		});
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
