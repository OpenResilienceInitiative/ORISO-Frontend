import { describe, expect, it, vi } from 'vitest';
import { BookingsStatus } from '../utils/consultant';
import { fetchData } from './fetchData';
import { apiGetConsultantAppointments } from './apiGetConsultantAppointments';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		appointmentsServiceConsultantBookings: () =>
			'/service/appointservice/consultants/consultant-1/bookings?status=ACTIVE'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn(() => Promise.resolve([]))
}));

describe('apiGetConsultantAppointments', () => {
	it('handles an unavailable optional appointment service without global navigation', async () => {
		await apiGetConsultantAppointments(
			'consultant-1',
			BookingsStatus.ACTIVE
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: '/service/appointservice/consultants/consultant-1/bookings?status=ACTIVE',
			method: 'GET',
			responseHandling: ['CATCH_ALL']
		});
	});
});
