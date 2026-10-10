// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';
import {
	forgetInviteSession,
	readRememberedInviteSession,
	rememberInviteSession,
	resolveReusableInviteSession
} from './inviteSessionReuse';

vi.mock('../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn()
}));

const details = vi.mocked(apiGetAnonymousEnquiryDetails);

describe('inviteSessionReuse', () => {
	beforeEach(() => {
		localStorage.clear();
		details.mockReset();
	});

	it('remembers and reads back the session an invite link opened', () => {
		rememberInviteSession('tok', 4711);

		expect(readRememberedInviteSession('tok')).toBe(4711);
	});

	it('keeps invite links apart', () => {
		rememberInviteSession('tok-a', 1);

		expect(readRememberedInviteSession('tok-b')).toBeNull();
	});

	it('forgets a session on request', () => {
		rememberInviteSession('tok', 1);

		forgetInviteSession('tok');

		expect(readRememberedInviteSession('tok')).toBeNull();
	});

	it('ignores a stored value that is not a session id', () => {
		localStorage.setItem('oriso.invite.session.tok', 'not-a-number');

		expect(readRememberedInviteSession('tok')).toBeNull();
	});

	it('reuses a session that is still waiting, without redeeming again', async () => {
		rememberInviteSession('tok', 4711);
		details.mockResolvedValue({
			numAvailableConsultants: 1,
			status: 'NEW'
		});

		await expect(resolveReusableInviteSession('tok')).resolves.toBe(4711);
		expect(details).toHaveBeenCalledWith(4711);
	});

	it('reuses a session a counsellor has already accepted', async () => {
		rememberInviteSession('tok', 4711);
		details.mockResolvedValue({
			numAvailableConsultants: 1,
			status: 'IN_PROGRESS'
		});

		await expect(resolveReusableInviteSession('tok')).resolves.toBe(4711);
	});

	it('does not reuse a finished conversation', async () => {
		rememberInviteSession('tok', 4711);
		details.mockResolvedValue({
			numAvailableConsultants: 0,
			status: 'DONE'
		});

		await expect(resolveReusableInviteSession('tok')).resolves.toBeNull();
		expect(readRememberedInviteSession('tok')).toBeNull();
	});

	it('does not reuse an archived conversation', async () => {
		rememberInviteSession('tok', 4711);
		details.mockResolvedValue({
			numAvailableConsultants: 0,
			status: 'IN_ARCHIVE'
		});

		await expect(resolveReusableInviteSession('tok')).resolves.toBeNull();
	});

	it('falls back to redeeming when the stored session can no longer be read', async () => {
		rememberInviteSession('tok', 4711);
		details.mockRejectedValue(new Error('UNAUTHORIZED'));

		await expect(resolveReusableInviteSession('tok')).resolves.toBeNull();
		expect(readRememberedInviteSession('tok')).toBeNull();
	});

	it.each(['CATCH_ALL', 'TIMEOUT', 'ABORT', 'NetworkError'])(
		'preserves the session on transient %s and retries the read',
		async (message) => {
			rememberInviteSession('tok', 4711);
			details.mockRejectedValueOnce(new Error(message));
			await expect(resolveReusableInviteSession('tok')).rejects.toThrow();
			expect(readRememberedInviteSession('tok')).toBe(4711);
			details.mockResolvedValue({
				numAvailableConsultants: 1,
				status: 'NEW'
			});
			await expect(resolveReusableInviteSession('tok')).resolves.toBe(
				4711
			);
		}
	);

	it('asks the server nothing when no session is remembered', async () => {
		await expect(resolveReusableInviteSession('tok')).resolves.toBeNull();
		expect(details).not.toHaveBeenCalled();
	});
});
