import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchData = vi.hoisted(() => vi.fn());
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { calendarBase: 'https://api.test/service/users/calendar' }
}));

const api = await import('./apiCalendar');

const BASE = 'https://api.test/service/users/calendar/working-hours';

/** Working hours contract v1.2: holiday region and day exceptions. */
describe('apiCalendar working hours (FE#1050)', () => {
	beforeEach(() => fetchData.mockReset().mockResolvedValue({}));

	it('always sends windows and the holiday region, never the exceptions', async () => {
		await api.apiSetCalendarWorkingHours({
			windows: [{ weekday: 1, start: '08:00', end: '12:00' }],
			holidayRegion: 'SN',
			exceptions: [{ date: '2026-11-16', windows: [] }]
		} as never);
		const call = fetchData.mock.calls[0][0];
		expect(call).toEqual(
			expect.objectContaining({ url: BASE, method: 'PUT' })
		);
		expect(JSON.parse(call.bodyData)).toEqual({
			windows: [{ weekday: 1, start: '08:00', end: '12:00' }],
			holidayRegion: 'SN'
		});
	});

	it('sends a missing region as null (holidays off)', async () => {
		await api.apiSetCalendarWorkingHours({ windows: [] });
		expect(JSON.parse(fetchData.mock.calls[0][0].bodyData)).toEqual({
			windows: [],
			holidayRegion: null
		});
	});

	it('puts the exception of one date', async () => {
		await api.apiPutWorkingDayException('2026-11-16', [
			{ start: '07:30', end: '12:00' },
			{ start: '13:00', end: '18:00' }
		]);
		const call = fetchData.mock.calls[0][0];
		expect(call).toEqual(
			expect.objectContaining({
				url: `${BASE}/exceptions/2026-11-16`,
				method: 'PUT'
			})
		);
		expect(JSON.parse(call.bodyData)).toEqual({
			windows: [
				{ start: '07:30', end: '12:00' },
				{ start: '13:00', end: '18:00' }
			]
		});
	});

	it('deletes the exception of one date', async () => {
		await api.apiDeleteWorkingDayException('2026-11-16');
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: `${BASE}/exceptions/2026-11-16`,
				method: 'DELETE'
			})
		);
	});
});

/** Move proposals, contract v1 (ADR-032 addendum). */
describe('apiCalendar move proposals (FE#1050)', () => {
	const PROPOSALS = 'https://api.test/service/users/calendar/proposals';
	beforeEach(() => fetchData.mockReset().mockResolvedValue({}));

	const call = () => fetchData.mock.calls[0][0];

	it('reads the open proposals', async () => {
		await api.apiGetCalendarProposals();
		expect(call()).toEqual(
			expect.objectContaining({ url: PROPOSALS, method: 'GET' })
		);
	});

	it('proposes a new time for an appointment', async () => {
		await api.apiCreateCalendarProposal({
			entryId: 'k1',
			start: '2026-11-17T13:00:00.000Z',
			end: '2026-11-17T14:00:00.000Z'
		});
		expect(call()).toEqual(
			expect.objectContaining({ url: PROPOSALS, method: 'POST' })
		);
		expect(JSON.parse(call().bodyData)).toEqual({
			entryId: 'k1',
			start: '2026-11-17T13:00:00.000Z',
			end: '2026-11-17T14:00:00.000Z'
		});
		// The created proposal comes back as JSON.
		expect(call().responseHandling).toContain('CONTENT');
	});

	it('withdraws one proposal', async () => {
		await api.apiWithdrawCalendarProposal('p 1');
		expect(call()).toEqual(
			expect.objectContaining({
				url: `${PROPOSALS}/p%201`,
				method: 'DELETE'
			})
		);
	});

	it('accepts and reads the moved appointment, a 409 rejects as a conflict', async () => {
		await api.apiAcceptCalendarProposal('p1');
		expect(call()).toEqual(
			expect.objectContaining({
				url: `${PROPOSALS}/p1/accept`,
				method: 'POST'
			})
		);
		expect(call().responseHandling).toEqual(
			expect.arrayContaining(['CONTENT', 'CONFLICT'])
		);
	});

	it('declines one proposal', async () => {
		await api.apiDeclineCalendarProposal('p1');
		expect(call()).toEqual(
			expect.objectContaining({
				url: `${PROPOSALS}/p1/decline`,
				method: 'POST'
			})
		);
	});

	it('hands a refused or unknown proposal (400, 403, 404) to the page notice, never the error page', async () => {
		await api.apiCreateCalendarProposal({
			entryId: 'k1',
			start: '2026-11-17T13:00:00.000Z',
			end: '2026-11-17T14:00:00.000Z'
		});
		await api.apiAcceptCalendarProposal('p1');
		await api.apiWithdrawCalendarProposal('p1');
		await api.apiDeclineCalendarProposal('p1');
		await api.apiGetCalendarProposals();
		expect(fetchData).toHaveBeenCalledTimes(5);
		for (const [request] of fetchData.mock.calls) {
			// Any status but 401 rejects as CATCH_ALL ("Speichern
			// fehlgeschlagen"); 401 keeps the session handling.
			expect(request.responseHandling).toContain(
				'CATCH_ALL_EXCEPT_UNAUTHORIZED'
			);
			// 204, also for a proposal already decided, is done.
			expect(request.responseHandling).not.toContain('EMPTY');
		}
	});
});

/** Sprechstunden (FE#2287): the counsellor's bookable windows and settings. */
describe('apiCalendar consultation hours (FE#2287)', () => {
	beforeEach(() => fetchData.mockReset().mockResolvedValue({}));

	it("reads the caller's Sprechstunden", async () => {
		await api.apiGetCalendarConsultationHours();
		expect(fetchData.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				url: 'https://api.test/service/users/calendar/consultation-hours',
				method: 'GET'
			})
		);
	});

	it('puts windows and the three settings at once', async () => {
		await api.apiSetCalendarConsultationHours({
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
			autoAccept: false,
			noticeDays: 2,
			slotMinutes: 30
		});
		const call = fetchData.mock.calls[0][0];
		expect(call).toEqual(
			expect.objectContaining({
				url: 'https://api.test/service/users/calendar/consultation-hours',
				method: 'PUT'
			})
		);
		expect(JSON.parse(call.bodyData)).toEqual({
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
			autoAccept: false,
			noticeDays: 2,
			slotMinutes: 30
		});
	});
});
