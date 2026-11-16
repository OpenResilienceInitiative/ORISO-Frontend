// @vitest-environment oriso-jsdom
/**
 * One row of "Ihre nächsten Termine" (FE#1050, item 4; review 4581640883):
 * the symbol and word of the appointment's real kind, the calendar's own;
 * no "Video-Termine sind derzeit nicht verfügbar."; and shortly before a
 * video appointment "Starten": its conversation, opened the way the
 * calendar does and asked to start the video call (item 5).
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as roomApi from '../../../../api/apiGetSessionRooms';
import * as conversation from '../../../../components/calendar/appointmentConversation';
import { CalendarEntryGlyph } from '../../../../components/calendar/CalendarEntryGlyph';
import type { CalendarEntry } from '../../../../components/calendar/calendarModel';
import { startCallState } from '../../../../components/call/startCallIntent';
import { BookingEvent } from './index';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: vi.fn()
}));
vi.mock(
	'../../../../components/calendar/appointmentConversation',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../../../components/calendar/appointmentConversation')
			>();
		return {
			...actual,
			appointmentRoomOf: vi.fn(actual.appointmentRoomOf)
		};
	}
);

const NOW = new Date(2026, 10, 16, 9, 0);
const MINUTE = 60_000;
const ROOM = '!room:oriso.local';

const appointment = (
	extra: Partial<CalendarEntry> & { inMinutes?: number } = {}
): CalendarEntry => {
	const { inMinutes = 3, ...rest } = extra;
	const start = new Date(NOW.getTime() + inMinutes * MINUTE);
	return {
		id: 'a1',
		type: 'appointment',
		kind: 'video',
		ownerId: 'me',
		title: 'mutige_eule',
		sessionId: 42,
		start: start.toISOString(),
		end: new Date(start.getTime() + 45 * MINUTE).toISOString(),
		...rest
	} as CalendarEntry;
};

const KINDS: [string, Partial<CalendarEntry>, string][] = [
	['video', { kind: 'video' }, 'calendar.kinds.video'],
	['phone', { kind: 'phone' }, 'calendar.kinds.phone'],
	['onsite', { kind: 'onsite' }, 'calendar.kinds.onsite'],
	['chat', { kind: 'chat' }, 'calendar.kinds.chat'],
	[
		'group',
		{ type: 'group', kind: undefined, sessionId: undefined },
		'calendar.types.group'
	]
];

const OLD_TEXT = 'legacyVideoAppointment.unavailable.message';
const START = 'overview.start';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	vi.setSystemTime(NOW);
	vi.clearAllMocks();
	vi.mocked(roomApi.apiGetSessionRoomBySessionId).mockResolvedValue({
		sessions: [{ session: { id: 42, matrixRoomId: ROOM } }]
	} as never);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('BookingEvent — the overview row of one appointment', () => {
	it.each(KINDS)(
		'shows a %s appointment with the symbol and word the calendar gives its kind',
		(_kind, extra, word) => {
			const entry = appointment({ ...extra, inMinutes: 120 });
			render(<BookingEvent appointment={entry} />);
			const icon = screen.getByRole('img', { name: word });
			expect(icon.innerHTML).toBe(
				renderToStaticMarkup(<CalendarEntryGlyph entry={entry} />)
			);
		}
	);

	it.each(KINDS)(
		'never says video calls are unavailable, also not for a %s appointment about to start (review 4581640883)',
		(_kind, extra) => {
			render(
				<BookingEvent
					appointment={appointment({ ...extra, inMinutes: 3 })}
				/>
			);
			expect(screen.queryByText(OLD_TEXT)).toBeNull();
		}
	);

	it('offers "Starten" only for a video appointment within five minutes of its start', () => {
		const rows = [
			appointment({ id: 'video-soon', inMinutes: 3 }),
			appointment({ id: 'video-later', inMinutes: 10 }),
			appointment({ id: 'phone-soon', kind: 'phone', inMinutes: 3 }),
			appointment({ id: 'onsite-soon', kind: 'onsite', inMinutes: 3 }),
			appointment({ id: 'chat-soon', kind: 'chat', inMinutes: 3 }),
			appointment({
				id: 'group-soon',
				type: 'group',
				kind: undefined,
				sessionId: undefined,
				inMinutes: 3
			})
		];
		render(
			<>
				{rows.map((row) => (
					<BookingEvent key={row.id} appointment={row} />
				))}
			</>
		);
		const buttons = screen.getAllByRole('button', { name: START });
		expect(buttons).toHaveLength(1);
		expect(
			screen.getAllByTestId('booking-event')[0].contains(buttons[0])
		).toBe(true);

		// The later video row gets it once its window opens.
		act(() => {
			vi.advanceTimersByTime(6 * MINUTE);
		});
		expect(screen.getAllByRole('button', { name: START })).toHaveLength(2);
	});

	it('"Starten" opens the conversation through the calendar\'s own path and asks it to start the video call', async () => {
		render(<BookingEvent appointment={appointment({ inMinutes: 3 })} />);
		fireEvent.click(screen.getByRole('button', { name: START }));
		expect(conversation.appointmentRoomOf).toHaveBeenCalledWith(42);
		await act(async () => {
			await vi.mocked(conversation.appointmentRoomOf).mock.results[0]
				.value;
		});
		expect(navigate).toHaveBeenCalledWith(
			conversation.appointmentConversationPath(ROOM, 42, true),
			{ state: startCallState(42, 'video') }
		);
		expect(roomApi.apiGetSessionRoomBySessionId).toHaveBeenCalledWith(42);
		expect(navigate).toHaveBeenCalledWith(
			`/sessions/consultant/sessionView/${ROOM}/42`,
			{ state: { startCall: { sessionId: 42, kind: 'video' } } }
		);
	});

	it('says so when the conversation cannot be opened', async () => {
		vi.mocked(roomApi.apiGetSessionRoomBySessionId).mockResolvedValue({
			sessions: []
		} as never);
		render(<BookingEvent appointment={appointment({ inMinutes: 3 })} />);
		fireEvent.click(screen.getByRole('button', { name: START }));
		expect((await screen.findByRole('alert')).textContent).toBe(
			'calendar.chatUnavailable'
		);
		expect(navigate).not.toHaveBeenCalled();
	});
});
