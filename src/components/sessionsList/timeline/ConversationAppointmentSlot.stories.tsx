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

/** The next 1:1 appointment below the conversation header (FE#1960). */
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
type Route = { get: unknown[] | number; write?: number };

const installFetch = ({ get, write = 200 }: Route) => {
	const previous = window.fetch;
	window.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : (input as Request).url;
		const method = init?.method ?? (input as Request).method ?? 'GET';
		if (!/\/appointments/.test(url)) return previous(input, init);
		if (method !== 'GET')
			return new Response(JSON.stringify(appointment), { status: write });
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
	canChange
}: {
	route: Route;
	role: 'asker' | 'consultant';
	canChange: boolean;
}) => {
	const [restore] = useState(() => installFetch(route));
	React.useEffect(() => restore, [restore]);
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
							/>
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

export const CounsellorNoAppointment: Story = {
	args: { route: { get: [] }, role: 'consultant', canChange: true },
	play: async ({ canvasElement }) => {
		const button = await within(canvasElement).findByRole('button');
		await expect(button).toBeVisible();
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
		await userEvent.click(await within(canvasElement).findByRole('button'));
		await expect(
			await within(document.body).findByTestId('appointment-date-dialog')
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
		const body = within(document.body);
		const bar = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="room-next-appointment"] .splitButton__main'
			);
			expect(found).not.toBeNull();
			return found!;
		});
		await userEvent.click(bar);
		await userEvent.click(await body.findByText('Termin verschieben'));
		const dialog = await body.findByTestId('appointment-date-dialog');
		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Verschieben' })
		);
		await expect(await within(dialog).findByRole('alert')).toBeVisible();
	}
};
