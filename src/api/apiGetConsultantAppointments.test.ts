import { describe, expect, it, vi } from 'vitest';
import { BookingsStatus } from '../utils/consultant';
import { fetchData } from './fetchData';
import { apiGetConsultantAppointments } from './apiGetConsultantAppointments';

const appointmentsServiceConsultantBookings = vi.hoisted(() =>
	vi.fn(
		() =>
			'/service/appointservice/consultants/consultant-1/bookings?status=ACTIVE'
	)
);

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		appointmentsServiceConsultantBookings
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn(() => Promise.resolve([]))
}));

describe('apiGetConsultantAppointments', () => {
	it('requests the optional appointment service with catch-all response handling', async () => {
		await apiGetConsultantAppointments(
			'consultant-1',
			BookingsStatus.ACTIVE
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: '/service/appointservice/consultants/consultant-1/bookings?status=ACTIVE',
			method: 'GET',
			responseHandling: ['CATCH_ALL']
		});
		expect(appointmentsServiceConsultantBookings).toHaveBeenCalledWith(
			'consultant-1',
			BookingsStatus.ACTIVE
		);
	});
});
