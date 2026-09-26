// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchData, FETCH_METHODS } from './fetchData';
import { apiRequestContactSheetEmail } from './apiRequestContactSheetEmail';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		contactSheetEmail: (sessionId: number) =>
			`https://dev.example.org/service/users/sessions/${sessionId}/contact-sheet-email`
	}
}));

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn(() => Promise.resolve()) };
});

beforeEach(() => vi.clearAllMocks());

it('requests the session contact sheet without sending an address or contact data', async () => {
	await apiRequestContactSheetEmail(42);

	const call = vi.mocked(fetchData).mock.calls[0][0];
	expect(call.url).toContain(
		'/service/users/sessions/42/contact-sheet-email'
	);
	expect(call.method).toBe(FETCH_METHODS.POST);
	expect(call.bodyData).toBeUndefined();
});
