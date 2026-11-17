// @vitest-environment oriso-jsdom
/**
 * FE#1960 follow-up: "Termin anlegen" lives in the conversation's ⋮ menu.
 * The row under the header shows only an existing appointment (ADR-021 §5);
 * without one, the header stays as it was.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	UserDataContext
} from '../../../globalState';
import { ConversationAppointmentSlot } from './ConversationAppointmentSlot';
import { notifyAppointmentsChanged } from './conversationAppointments';
import { useAppointmentCreate } from './appointmentCreateBridge';

const { getAppointments, onAction, claimNotice, sendNotice } = vi.hoisted(
	() => ({
		getAppointments: vi.fn(),
		onAction: vi.fn(),
		claimNotice: vi.fn(),
		sendNotice: vi.fn()
	})
);
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiGetSessionAppointments: getAppointments,
	apiClaimSessionAppointmentExpiryNotice: claimNotice
}));
vi.mock('./useAppointmentNotice', () => ({
	useAppointmentNotice: () => sendNotice
}));
vi.mock('./AppointmentDateDialog', () => ({
	AppointmentDateDialog: () => <div data-testid="appointment-date-dialog" />
}));
vi.mock('./useAppointmentActions', () => ({
	useAppointmentActions: () => onAction
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const upcoming = (days = 2) => {
	const start = new Date(Date.now() + days * 24 * 3600 * 1000);
	return {
		id: 'a1',
		sessionId: 4401,
		startTime: start.toISOString(),
		endTime: new Date(start.getTime() + 3600 * 1000).toISOString(),
		status: 'SCHEDULED',
		counterpart: { username: 'ruhiges_yak_kim' }
	};
};

const requested = (days = 2) => ({
	...upcoming(days),
	id: 'r1',
	status: 'REQUESTED'
});

const MARKER = 'sessionList.timeline.appointment.request.marker';
const splitButtonLabel = async (container: HTMLElement) => {
	const main = await waitFor(() => {
		const found = container.querySelector<HTMLElement>(
			'[data-cy="room-next-appointment"] .splitButton__main'
		);
		expect(found).not.toBeNull();
		return found!;
	});
	return main;
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
	canChange = true,
	authority: string = AUTHORITIES.CONSULTANT_DEFAULT
) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: 'c1',
						grantedAuthorities: [authority]
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
	onAction.mockReset();
	claimNotice.mockReset();
	sendNotice.mockReset();
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

	describe('a request nobody answered by its start (FE#2287, Frank 17 Nov)', () => {
		const expired = () => ({
			...requested(-1),
			id: 'x1',
			status: 'DECLINED',
			expired: true,
			noticePending: true
		});

		it('claims its notice and posts it into the conversation once', async () => {
			getAppointments.mockResolvedValue([expired()]);
			claimNotice.mockResolvedValue(undefined);
			sendNotice.mockResolvedValue(undefined);
			renderSlot(vi.fn(), false, AUTHORITIES.ASKER_DEFAULT);
			await waitFor(() => expect(sendNotice).toHaveBeenCalledTimes(1));
			expect(claimNotice).toHaveBeenCalledWith(4401, 'x1');
			expect(sendNotice).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: 'expired',
					sessionId: 4401,
					matrixRoomId: '!r:x'
				})
			);
		});

		it('posts nothing when the other side claimed it first', async () => {
			getAppointments.mockResolvedValue([expired()]);
			claimNotice.mockRejectedValue(new Error('409'));
			renderSlot(vi.fn());
			await waitFor(() => expect(claimNotice).toHaveBeenCalled());
			await act(async () => undefined);
			expect(sendNotice).not.toHaveBeenCalled();
		});

		it('claims nothing for an expired request whose notice is out', async () => {
			getAppointments.mockResolvedValue([
				{ ...expired(), noticePending: undefined }
			]);
			renderSlot(vi.fn());
			await act(async () => undefined);
			expect(claimNotice).not.toHaveBeenCalled();
		});
	});

	describe('a request waiting for the counsellor (FE#2287)', () => {
		it('shows in the same split button, marked as requested', async () => {
			getAppointments.mockResolvedValue([requested()]);
			const { container } = renderSlot(vi.fn());
			const main = await splitButtonLabel(container);
			expect(main.textContent).toMatch(new RegExp(`^${MARKER} · `));
			expect(
				container.querySelector(
					'[data-testid="appointment-request-card"]'
				)
			).toBeNull();
			expect(
				container.querySelectorAll(
					'[data-cy="room-next-appointment"] button'
				)
			).toHaveLength(2);
		});

		it('leaves the split button when its start passes, without a reload', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			try {
				const soon = new Date(Date.now() + 5_000);
				getAppointments.mockResolvedValue([
					{
						...requested(),
						startTime: soon.toISOString(),
						endTime: new Date(
							soon.getTime() + 3600_000
						).toISOString()
					}
				]);
				const { container } = renderSlot(vi.fn());
				await splitButtonLabel(container);

				await act(async () => {
					await vi.advanceTimersByTimeAsync(6_000);
				});

				expect(
					container.querySelector('[data-cy="room-next-appointment"]')
				).toBeNull();
				expect(getAppointments).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});

		it('lets the counsellor confirm or decline it from the menu', async () => {
			getAppointments.mockResolvedValue([requested()]);
			const { container } = renderSlot(vi.fn());
			fireEvent.click(await splitButtonLabel(container));
			const items = screen.getAllByRole('menuitem');
			expect(items.map((item) => item.textContent)).toEqual([
				expect.stringContaining('Termin bestätigen'),
				expect.stringContaining('Termin ablehnen')
			]);
			fireEvent.click(items[0]);
			expect(onAction).toHaveBeenCalledWith(
				'confirm',
				expect.objectContaining({
					requested: true,
					sessionId: 4401,
					booking: expect.objectContaining({ appointmentId: 'r1' })
				})
			);
		});

		it('lets the advice seeker withdraw it from the menu', async () => {
			getAppointments.mockResolvedValue([requested()]);
			const { container } = renderSlot(
				vi.fn(),
				false,
				AUTHORITIES.ASKER_DEFAULT
			);
			const main = await splitButtonLabel(container);
			expect(main.textContent).toContain(MARKER);
			fireEvent.click(main);
			const items = screen.getAllByRole('menuitem');
			expect(items.map((item) => item.textContent)).toEqual([
				expect.stringContaining('Anfrage zurückziehen')
			]);
			fireEvent.click(items[0]);
			expect(onAction).toHaveBeenCalledWith(
				'cancel',
				expect.objectContaining({ requested: true })
			);
		});

		it('shows the nearer of a confirmed appointment and a request', async () => {
			getAppointments.mockResolvedValue([upcoming(2), requested(3)]);
			const first = renderSlot(vi.fn());
			expect(
				(await splitButtonLabel(first.container)).textContent
			).not.toContain(MARKER);
			cleanup();

			getAppointments.mockResolvedValue([upcoming(2), requested(1)]);
			const second = renderSlot(vi.fn());
			expect(
				(await splitButtonLabel(second.container)).textContent
			).toContain(MARKER);
		});
	});
});
