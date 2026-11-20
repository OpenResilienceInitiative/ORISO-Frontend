import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../../globalState';
import { ConversationAppointmentSlot } from './ConversationAppointmentSlot';
import {
	appointmentsEpoch,
	forgetKnownAppointments,
	rememberUpcomingAppointments
} from './conversationAppointments';

/**
 * The next 1:1 appointment below the conversation header (FE#1960).
 * "Termin anlegen" is a row of the header's ⋮ menu; the stand-in button
 * below plays that row and appears only while the slot offers an opener.
 */
const inDays = (days: number, hour: number) => {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};
const appointment = {
	id: '6f1c1a70-0000-4000-8000-000000000001',
	sessionId: 4401,
	startTime: inDays(2, 16),
	endTime: inDays(2, 17),
	status: 'SCHEDULED',
	counterpart: { username: 'ruhiges_yak_kim' }
};
const request = {
	...appointment,
	id: '6f1c1a70-0000-4000-8000-000000000002',
	startTime: inDays(3, 10),
	endTime: inDays(3, 11),
	status: 'REQUESTED'
};
/** `hang`: the conversation's own load never answers (a slow network). */
type Route = {
	get: unknown[] | number | 'hang';
	write?: number;
	reason?: string;
};

const installFetch = ({ get, write = 200, reason }: Route) => {
	const previous = window.fetch;
	window.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : (input as Request).url;
		const method = init?.method ?? (input as Request).method ?? 'GET';
		if (!/\/appointments/.test(url)) return previous(input, init);
		if (method !== 'GET')
			return new Response(JSON.stringify(appointment), {
				status: write,
				headers: reason ? { 'X-Reason': reason } : undefined
			});
		if (get === 'hang') return new Promise<Response>(() => undefined);
		return typeof get === 'number'
			? new Response('', { status: get })
			: new Response(JSON.stringify(get), { status: 200 });
	};
	return () => {
		window.fetch = previous;
	};
};

const Slot = ({
	route,
	role,
	canChange,
	known
}: {
	route: Route;
	role: 'asker' | 'consultant';
	canChange: boolean;
	/** What the list already loaded ("my upcoming appointments"). */
	known?: unknown[];
}) => {
	const [restore] = useState(() => {
		forgetKnownAppointments();
		if (known)
			rememberUpcomingAppointments(known as never, appointmentsEpoch());
		return installFetch(route);
	});
	React.useEffect(() => restore, [restore]);
	const [openCreate, setOpenCreate] = useState<() => void>();
	const onCreateChange = React.useCallback(
		(open?: () => void) => setOpenCreate(() => open),
		[]
	);
	return (
		<>
			<NotificationsContext.Provider
				value={{ addNotification: () => undefined } as never}
			>
				<SessionTypeContext.Provider
					value={{ path: '/sessions' } as never}
				>
					<UserDataContext.Provider
						value={
							{
								userData: {
									userId: 'u1',
									grantedAuthorities: [
										role === 'asker'
											? AUTHORITIES.ASKER_DEFAULT
											: AUTHORITIES.CONSULTANT_DEFAULT
									]
								}
							} as never
						}
					>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession: {
										item: {
											id: 4401,
											matrixRoomId: '!room:storybook.test'
										},
										rid: '!room:storybook.test'
									}
								} as never
							}
						>
							<ConversationAppointmentSlot
								canChange={canChange}
								onCreateChange={onCreateChange}
							/>
							{openCreate && (
								<button
									type="button"
									data-cy="story-menu-create-appointment"
									onClick={openCreate}
								>
									⋮ Termin anlegen
								</button>
							)}
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</SessionTypeContext.Provider>
			</NotificationsContext.Provider>
		</>
	);
};

const meta = {
	title: 'Components/Session/ConversationAppointmentSlot',
	component: Slot
} satisfies Meta<typeof Slot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CounsellorWithAppointment: Story = {
	args: { route: { get: [appointment] }, role: 'consultant', canChange: true }
};

/** No appointment: no row under the header; creating is offered to the menu. */
export const CounsellorNoAppointment: Story = {
	args: { route: { get: [] }, role: 'consultant', canChange: true },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-cy="story-menu-create-appointment"]'
				)
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelector('[data-cy="room-next-appointment"]')
		).toBeNull();
	}
};

export const AskerReadsAndCancels: Story = {
	args: { route: { get: [appointment] }, role: 'asker', canChange: false }
};

/** A backend without the endpoint: the header stays as it was. */
export const BackendWithoutEndpoint: Story = {
	args: { route: { get: 404 }, role: 'consultant', canChange: true },
	play: async ({ canvasElement }) => {
		await new Promise((resolve) => setTimeout(resolve, 200));
		await expect(canvasElement.querySelector('button')).toBeNull();
	}
};

export const CreateDialog: Story = {
	args: { route: { get: [] }, role: 'consultant', canChange: true },
	play: async ({ canvasElement }) => {
		await userEvent.click(
			await within(canvasElement).findByRole('button', {
				name: '⋮ Termin anlegen'
			})
		);
		await expect(
			await within(document.body).findByTestId('invitation-dialog')
		).toBeInTheDocument();
	}
};

/** The appointment was cancelled meanwhile: the dialog stays open and says so. */
export const MoveConflict: Story = {
	args: {
		route: { get: [appointment], write: 409 },
		role: 'consultant',
		canChange: true
	},
	play: async ({ canvasElement }) => {
		// CI runs this on a busy shared runner: every step waits for the
		// real ready state, not the default 1 s (FE#2298 CI, 18 Nov).
		const ready = { timeout: 5000 };
		const body = within(document.body);
		const bar = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="room-next-appointment"] .splitButton__main'
			);
			expect(found).not.toBeNull();
			return found!;
		}, ready);
		await userEvent.click(bar);
		await userEvent.click(
			await body.findByText('Termin verschieben', {}, ready)
		);
		const dialog = await body.findByTestId('invitation-dialog', {}, ready);
		const move = await within(dialog).findByRole(
			'button',
			{ name: 'Verschieben' },
			ready
		);
		await waitFor(() => expect(move).toBeEnabled(), ready);
		await userEvent.click(move);
		await waitFor(
			() => expect(within(dialog).getByRole('alert')).toBeVisible(),
			ready
		);
	}
};

const openSlotMenu = async (canvasElement: HTMLElement) => {
	const main = await waitFor(() => {
		const found = canvasElement.querySelector<HTMLElement>(
			'[data-cy="room-next-appointment"] .splitButton__main'
		);
		expect(found).not.toBeNull();
		return found!;
	});
	await expect(main).toHaveTextContent(/^Angefragt · /);
	await userEvent.click(main);
	return within(document.body);
};

/**
 * FE#2287: the advice seeker asked for a time outside instant booking. It
 * shows in the same split button, marked "angefragt"; the counsellor answers
 * it from the button's menu, and the advice seeker gets a chat notice.
 */
export const CounsellorDecidesRequest: Story = {
	args: { route: { get: [request] }, role: 'consultant', canChange: true },
	play: async ({ canvasElement }) => {
		const body = await openSlotMenu(canvasElement);
		await expect(
			await body.findByRole('menuitem', { name: /Termin bestätigen/ })
		).toBeEnabled();
		await expect(
			body.getByRole('menuitem', { name: /Termin ablehnen/ })
		).toBeEnabled();
	}
};

/** The advice seeker withdraws the request through the cancel entry. */
export const AskerRequestWaiting: Story = {
	args: { route: { get: [request] }, role: 'asker', canChange: false },
	play: async ({ canvasElement }) => {
		const body = await openSlotMenu(canvasElement);
		await expect(
			await body.findByRole('menuitem', { name: /Anfrage zurückziehen/ })
		).toBeEnabled();
		await expect(
			body.queryByRole('menuitem', { name: /Termin bestätigen/ })
		).toBeNull();
	}
};

/**
 * The jumping appointment button (Frank, 17.11.2026): the row used to appear
 * 100–250 ms after the header on every conversation switch and push the
 * messages down. With the list's appointments already known, the row is in
 * the header's first frame although the conversation's own load is still
 * running.
 */
export const KnownAppointmentInFirstFrame: Story = {
	args: {
		route: { get: 'hang' },
		role: 'consultant',
		canChange: true,
		known: [appointment]
	},
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="room-next-appointment"]')
		).not.toBeNull();
	}
};
