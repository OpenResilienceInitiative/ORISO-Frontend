// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchData } from './fetchData';
import {
	apiConfirmSupportHandshake,
	apiDeclineSupportHandshake,
	apiGetActiveSupportSessions,
	apiGetPendingSupportHandshakes,
	apiRegisterSupportCallRoom,
	apiTerminateSupportSession
} from './apiSupportHandshake';

vi.mock('./fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_METHODS: { GET: 'GET', POST: 'POST', PUT: 'PUT' },
	FETCH_ERRORS: { BAD_REQUEST: 'BAD_REQUEST', FORBIDDEN: 'FORBIDDEN' }
}));

describe('support access API', () => {
	beforeEach(() => vi.mocked(fetchData).mockReset());

	it('loads only the authenticated consultant pending approvals', async () => {
		await apiGetPendingSupportHandshakes();

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/requests/pending'
				),
				method: 'GET'
			})
		);
	});

	it('confirms with a fresh password and never sends an identity', async () => {
		await apiConfirmSupportHandshake('hs-1', 'secret');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/requests/hs-1/confirm'
				),
				method: 'POST',
				// The consultant is taken from the token server-side; sending one here would be a
				// way to confirm in somebody else's name.
				bodyData: JSON.stringify({ password: 'secret' })
			})
		);
	});

	it('declines explicitly, which is a decision and gets audited', async () => {
		await apiDeclineSupportHandshake('hs-1');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/requests/hs-1/decline'
				),
				method: 'POST'
			})
		);
	});

	it('reads active sessions from the scoped endpoint', async () => {
		await apiGetActiveSupportSessions();

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/sessions/active'
				),
				method: 'GET'
			})
		);
	});

	it('terminates a session early', async () => {
		await apiTerminateSupportSession('sess-1');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/sessions/sess-1/terminate'
				),
				method: 'POST'
			})
		);
	});

	it('registers the call room so revocation can close it too', async () => {
		await apiRegisterSupportCallRoom('sess-1', '!call:oriso');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining(
					'/service/users/support-access/sessions/sess-1/call-room'
				),
				method: 'PUT',
				bodyData: JSON.stringify({ callRoomId: '!call:oriso' })
			})
		);
	});
});
