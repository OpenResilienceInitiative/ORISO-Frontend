import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchData = vi.hoisted(() => vi.fn());
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		sessionAppointments: (id: number) =>
			`https://api.test/service/users/sessions/${id}/appointments`,
		sessionAppointmentSlots: (id: number) =>
			`https://api.test/service/users/sessions/${id}/appointment-slots`
	}
}));

const api = await import('./apiSessionAppointments');

/** Self-booking (FE#1050): the asker reads free slots and books one. */
describe('apiSessionAppointments self-booking', () => {
	beforeEach(() => fetchData.mockReset().mockResolvedValue([]));

	it('reads the free slots of a window for one medium', async () => {
		await api.apiGetAppointmentSlots(
			7,
			new Date('2026-11-18T00:00:00Z'),
			new Date('2026-12-02T00:00:00Z'),
			'VIDEO'
		);
		const call = fetchData.mock.calls[0][0];
		expect(call.method).toBe('GET');
		const url = new URL(call.url);
		expect(url.origin + url.pathname).toBe(
			'https://api.test/service/users/sessions/7/appointment-slots'
		);
		expect(url.searchParams.get('from')).toBe('2026-11-18T00:00:00.000Z');
		expect(url.searchParams.get('to')).toBe('2026-12-02T00:00:00.000Z');
		expect(url.searchParams.get('medium')).toBe('VIDEO');
	});

	it('books one slot with its kind and hands a conflict on with its reason', async () => {
		await api.apiBookAppointmentSlot(7, {
			startTime: '2026-11-19T14:00:00Z',
			endTime: '2026-11-19T15:00:00Z',
			kind: 'PHONE'
		});
		const call = fetchData.mock.calls[0][0];
		expect(call.url).toBe(
			'https://api.test/service/users/sessions/7/appointment-slots/booking'
		);
		expect(call.method).toBe('POST');
		expect(JSON.parse(call.bodyData)).toEqual({
			startTime: '2026-11-19T14:00:00Z',
			endTime: '2026-11-19T15:00:00Z',
			kind: 'PHONE'
		});
		expect(call.responseHandling).toEqual(
			expect.arrayContaining(['CONFLICT_WITH_RESPONSE'])
		);
	});
});
