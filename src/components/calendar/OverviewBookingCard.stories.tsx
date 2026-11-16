import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { CalendarEntryDTO } from '../../api/apiCalendar';
import { UserDataContext } from '../../globalState';
import { startCallRequestOf } from '../call/startCallIntent';
import { BookingCard } from '../../containers/overview/components/BookingCard/BookingCard';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import '../../containers/overview/overview.styles.scss';

const ME = 'sb-counsellor';
const ROOM = '!story-room:oriso.local';
const MINUTE = 60_000;

/**
 * The counsellor's next appointments, relative to the moment the story
 * opens: a video call in three minutes (inside the "starts soon" window),
 * then one of every other kind.
 */
const entriesFrom = (now: number): CalendarEntryDTO[] => {
	const at = (minutes: number, length = 45) => ({
		start: new Date(now + minutes * MINUTE).toISOString(),
		end: new Date(now + (minutes + length) * MINUTE).toISOString()
	});
	const own = { ownerId: ME, movable: true };
	return [
		{
			id: 'video',
			type: 'APPOINTMENT',
			kind: 'VIDEO',
			title: 'mutige_eule',
			sessionId: 42,
			...own,
			...at(3)
		},
		{
			id: 'phone',
			type: 'APPOINTMENT',
			kind: 'PHONE',
			title: 'stiller_fuchs',
			sessionId: 43,
			...own,
			...at(3 * 60)
		},
		{
			id: 'onsite',
			type: 'APPOINTMENT',
			kind: 'ONSITE',
			title: 'kluger_rabe',
			sessionId: 44,
			...own,
			...at(26 * 60)
		},
		{
			id: 'chat',
			type: 'APPOINTMENT',
			kind: 'CHAT',
			title: 'frohe_amsel',
			sessionId: 45,
			...own,
			...at(50 * 60)
		},
		{
			id: 'group',
			type: 'GROUP',
			title: 'Gruppe Angehörige',
			...own,
			...at(74 * 60, 90)
		}
	];
};

/**
 * Answers the calendar and the conversation lookup while the story is
 * shown. Installed during the first render: the card asks in its own
 * effect, before this component's effects run.
 */
const useOverviewFeed = () => {
	const restore = useRef<(() => void) | null>(null);
	const install = () => {
		const entries = entriesFrom(Date.now());
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const method = (
				init?.method ??
				(input instanceof Request ? input.method : 'GET')
			).toUpperCase();
			const { pathname } = new URL(url, window.location.href);
			const json = (body: unknown) =>
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			if (
				method === 'GET' &&
				pathname === '/service/users/calendar/entries'
			)
				return json(entries);
			if (
				method === 'GET' &&
				pathname === '/service/users/sessions/room/42'
			)
				return json({
					sessions: [{ session: { id: 42, matrixRoomId: ROOM } }]
				});
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
			restore.current = null;
		};
	};
	if (!restore.current) install();
	useEffect(() => {
		if (!restore.current) install();
		return () => restore.current?.();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
};

/**
 * Stands in for the conversation the card opens, and shows whether it was
 * asked to start its video call (the conversation's own call controls take
 * that request up; their tests live with `SessionMenu`).
 */
const OpenedConversation = () => {
	const { roomId, sessionId } = useParams();
	const { state } = useLocation();
	const request = startCallRequestOf(state);
	const startRequested =
		request?.kind === 'video' && request.sessionId === Number(sessionId);
	return (
		<p data-cy="opened-conversation">
			{`Gespräch ${sessionId} (${roomId})`}
			{startRequested ? ' · Video-Call wird gestartet' : ''}
		</p>
	);
};

const Overview = () => {
	useOverviewFeed();
	return (
		<UserDataContext.Provider
			value={
				{
					userData: { userId: ME },
					setUserData: () => undefined,
					reloadUserData: () => Promise.resolve(null)
				} as never
			}
		>
			<Routes>
				<Route
					path="/sessions/consultant/sessionView/:roomId/:sessionId"
					element={<OpenedConversation />}
				/>
				<Route
					path="*"
					element={
						<div className="overviewPage" style={{ padding: 24 }}>
							<div className="overviewPage__cardGroup">
								<BookingCard />
							</div>
						</div>
					}
				/>
			</Routes>
		</UserDataContext.Provider>
	);
};

const meta: Meta<typeof Overview> = {
	title: 'Templates/Calendar/Overview card',
	component: Overview,
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/overview' },
		docs: {
			description: {
				component:
					'"Ihre nächsten Termine" on the overview (FE#1050): the counsellor\'s next own appointments from the calendar. Sample data relative to now.'
			}
		}
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Each row names its kind with the calendar's symbol and word; no row says
 * video calls are unavailable; only the video appointment about to start
 * offers "Starten", which opens its conversation and asks it to start the
 * video call (FE#1050 item 5).
 */
const play: Story['play'] = async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const rows = await canvas.findAllByTestId('booking-event');
	await expect(rows).toHaveLength(5);
	const kinds = rows.map((row) =>
		within(row).getByRole('img').getAttribute('aria-label')
	);
	await expect(kinds).toEqual([
		'Video',
		'Telefon',
		'Vor Ort',
		'Chat',
		'Gruppentermin'
	]);
	await expect(
		canvas.queryByText('Video-Termine sind derzeit nicht verfügbar.')
	).toBeNull();
	await expect(canvas.queryByRole('button', { name: 'Zum Chat' })).toBeNull();
	const start = canvas.getAllByRole('button', { name: 'Starten' });
	await expect(start).toHaveLength(1);
	await expect(rows[0]).toContainElement(start[0]);
	await userEvent.click(start[0]);
	await expect(
		await canvas.findByText(
			`Gespräch 42 (${ROOM}) · Video-Call wird gestartet`
		)
	).toBeInTheDocument();
};

export const NextAppointments: Story = { globals: desktop1440Globals, play };

export const NextAppointmentsPhone: Story = {
	globals: phone390Globals,
	play
};
